(() => {
  const $ = id => document.getElementById(id);
  let planType = 'STANDARD';
  let draftTests = window.NEXUSTiltTemplates.cloneTests('STANDARD');
  let operatingMode = 'NEXUS';
  let currentRunStartedAt = '';

  const recordAdapter = new window.NEXUSTiltRecordAdapter({
    store: window.NEXUSTiltStore,
    onStatus: renderCompletionStatus
  });
  recordAdapter.setMode(operatingMode);

  const engine = new window.NEXUSTiltEngine({
    onStateChange: renderRunState,
    onCandidate: renderCandidate,
    onAccepted: record => {
      window.NEXUSTiltStore.saveRecord(record);
    },
    onComplete: async summary => {
      $('runStatus').className = 'status good';
      $('runStatus').textContent = `TILT TEST COMPLETE — ${summary.records.length} accepted tests.`;

      try {
        await recordAdapter.finalize(summary, {
          technicianName: $('technicianName').value.trim() || 'POC User',
          startedAt: currentRunStartedAt
        });
      } catch (error) {
        $('completedStatus').className = 'status bad';
        $('completedStatus').textContent = error?.message || 'Completed test could not be finalized.';
      }

      renderCompletedTests();
    }
  });

  const ble = new window.NEXUSTiltBLEBridge({
    onEvent: evt => handleDeviceEvent(evt),
    onStatus: info => renderBleStatus(info),
    onError: error => {
      const box = $('bleStatus');
      box.className = 'status bad';
      box.textContent = error?.message || 'BLE connection error.';
    }
  });

  function makePlanId() {
    return `PLAN-${Date.now()}`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function setOperatingMode(mode) {
    operatingMode = mode === 'STANDALONE' ? 'STANDALONE' : 'NEXUS';
    recordAdapter.setMode(operatingMode);

    $('modeNexus').className = operatingMode === 'NEXUS' ? 'primary' : 'secondary';
    $('modeStandalone').className = operatingMode === 'STANDALONE' ? 'primary' : 'secondary';
    $('modeStatus').textContent = operatingMode;

    if (operatingMode === 'NEXUS') {
      $('modeNote').textContent = 'NEXUS mode returns the completed test to the NEXUS host for immediate storage and viewing. If sync is unavailable, the completed test is held locally until it can sync.';
    } else {
      $('modeNote').textContent = 'Standalone mode keeps the completed test on this device and makes the completed record available for viewing and file export without requiring NEXUS.';
    }

    renderCompletedTests();
  }

  function markCustom() {
    planType = 'CUSTOM';
    $('planType').textContent = 'CUSTOM';
  }

  function loadStandard() {
    planType = 'STANDARD';
    draftTests = window.NEXUSTiltTemplates.cloneTests('STANDARD');
    $('planType').textContent = 'STANDARD';
    renderDraftTests();
  }

  function renderDraftTests() {
    const wrap = $('planTests');
    wrap.innerHTML = '';

    draftTests.forEach((test, index) => {
      const row = document.createElement('div');
      row.className = 'test-row';
      row.innerHTML = `<strong>${index + 1}</strong><div><span class="small muted">${escapeHtml(test.group || 'Custom')}</span><input aria-label="Test ${index + 1}" value="${escapeHtml(test.label)}"></div><button type="button" class="secondary">REMOVE</button>`;

      const input = row.querySelector('input');
      const remove = row.querySelector('button');

      input.addEventListener('input', () => {
        test.label = input.value.trim();
        test.from = '';
        test.to = '';
        test.group = test.group || 'Custom';
        markCustom();
      });

      remove.addEventListener('click', () => {
        draftTests.splice(index, 1);
        markCustom();
        renderDraftTests();
      });

      wrap.appendChild(row);
    });
  }

  function savePlan() {
    const equipmentName = $('equipmentName').value.trim();
    const name = $('planName').value.trim() || 'TILT Test Plan';

    const cleanTests = draftTests
      .map((t, i) => ({
        id: t.id || `T${i + 1}`,
        group: t.group || 'Custom',
        label: (t.label || '').trim(),
        from: t.from || '',
        to: t.to || '',
        expected: t.expected || 'TRANSFORMER_OK',
        order: i + 1
      }))
      .filter(t => t.label);

    if (!cleanTests.length) {
      alert('Add at least one test point before saving.');
      return;
    }

    const plan = {
      format: 'NEXUS-TILT-PLAN-1',
      planId: makePlanId(),
      name,
      equipmentName,
      projectId: '',
      equipmentId: '',
      templateId: 'STANDARD',
      planType,
      operatingMode,
      createdAt: new Date().toISOString(),
      status: 'PLANNED',
      tests: cleanTests
    };

    window.NEXUSTiltStore.savePlan(plan);
    refreshSavedPlans(plan.planId);
    $('completedStatus').className = 'status good';
    $('completedStatus').textContent = `Test plan saved with ${cleanTests.length} required points.`;
  }

  function refreshSavedPlans(selectId) {
    const plans = window.NEXUSTiltStore.listPlans();
    const select = $('savedPlans');
    select.innerHTML = '';

    if (!plans.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No saved plans';
      select.appendChild(option);
      $('startTest').disabled = true;
      return;
    }

    plans.forEach(plan => {
      const option = document.createElement('option');
      option.value = plan.planId;
      option.textContent = `${plan.equipmentName ? plan.equipmentName + ' — ' : ''}${plan.name} (${plan.tests.length} tests)`;
      select.appendChild(option);
    });

    $('startTest').disabled = false;
    if (selectId) select.value = selectId;
  }

  function startSelectedPlan() {
    const plan = window.NEXUSTiltStore.getPlan($('savedPlans').value);
    if (!plan) return;
    currentRunStartedAt = new Date().toISOString();
    engine.loadPlan(plan);
    engine.start();
  }

  function renderRunState(state) {
    const status = $('runStatus');
    const current = $('currentTest');
    const panel = $('candidatePanel');

    if (state.status === 'IDLE') {
      status.className = 'status';
      status.textContent = 'No test running.';
      current.textContent = '—';
      panel.hidden = true;
    } else if (state.status === 'READY') {
      status.className = 'status';
      status.textContent = 'Plan loaded.';
    } else if (state.status === 'WAITING') {
      status.className = 'status warn';
      status.textContent = 'Waiting for valid TILT cadence...';
      current.textContent = state.currentTest?.label || '—';
      panel.hidden = true;
    } else if (state.status === 'REVIEW') {
      status.className = 'status';
      status.textContent = 'TILT indication detected. Accept it or Retest.';
      current.textContent = state.currentTest?.label || '—';
      panel.hidden = false;
    } else if (state.status === 'COMPLETE') {
      current.textContent = 'COMPLETE';
      panel.hidden = true;
    }

    renderRunList(state);
  }

  function renderCandidate(candidate) {
    const box = $('candidateResult');
    const match = candidate.comparison === 'MATCH';
    box.className = `status ${match ? 'good' : 'bad'}`;
    box.innerHTML = `<strong>${escapeHtml(candidate.observedIndication)}</strong><br><span class="small">Expected: ${escapeHtml(candidate.expectedIndication)} · Cadence valid · Confidence ${(candidate.deviceEvent.signalConfidence * 100).toFixed(0)}%</span>`;
  }

  function renderRunList(state) {
    const wrap = $('runList');
    wrap.innerHTML = '';
    if (!state.plan) return;

    state.plan.tests.forEach((test, index) => {
      const accepted = state.accepted.find(r => r.testId === test.id);
      const row = document.createElement('div');
      row.className = 'test-row';
      if (accepted) row.classList.add('done');
      if (index === state.currentIndex && state.status !== 'COMPLETE') row.classList.add('current');
      row.innerHTML = `<strong>${index + 1}</strong><span>${escapeHtml(test.label)}</span><span class="pill">${accepted ? escapeHtml(accepted.observedIndication) : index === state.currentIndex && state.status !== 'COMPLETE' ? 'CURRENT' : 'WAITING'}</span>`;
      wrap.appendChild(row);
    });
  }

  function handleDeviceEvent(evt) {
    const result = engine.receiveDeviceEvent(evt);
    if (!result.accepted && result.reason === 'NOT_WAITING') {
      $('runStatus').className = 'status warn';
      $('runStatus').textContent = 'Start a test or resolve the current Accept/Retest decision first.';
    } else if (!result.accepted && result.reason === 'INVALID_EVENT') {
      $('runStatus').className = 'status warn';
      $('runStatus').textContent = 'Rejected: event did not contain a valid TILT cadence.';
    }
  }

  function emitSim(channel) {
    window.NEXUSTiltSimulator.emit(channel, evt => handleDeviceEvent(evt));
  }

  function emitBadCadence() {
    window.NEXUSTiltSimulator.emitBadCadence(evt => handleDeviceEvent(evt));
  }

  function renderBleStatus(info) {
    const status = $('bleStatus');
    const deviceName = $('bleDeviceName');
    const connected = info.state === 'CONNECTED';

    if (info.state === 'CONNECTING') status.className = 'status warn';
    else if (connected) status.className = 'status good';
    else status.className = 'status';

    status.textContent = info.message || 'TILT device not connected.';
    deviceName.textContent = connected ? (info.deviceName || 'TILT DEVICE') : 'NO DEVICE';
    $('connectBle').disabled = connected || !ble.supported;
    $('disconnectBle').disabled = !connected;
  }

  async function connectBle() {
    try {
      await ble.connect();
    } catch (error) {
      if (error?.name === 'NotFoundError') {
        $('bleStatus').className = 'status';
        $('bleStatus').textContent = 'Device selection canceled.';
      }
    }
  }

  function renderCompletionStatus(info) {
    const box = $('completedStatus');
    if (info.state === 'DELIVERED') box.className = 'status good';
    else if (info.state === 'LOCAL') box.className = 'status good';
    else if (info.state === 'PENDING') box.className = 'status warn';
    else box.className = 'status';
    box.textContent = info.message || 'Completed test saved.';
  }

  function renderCompletedTests() {
    const wrap = $('completedTests');
    const tests = window.NEXUSTiltStore.listCompletedTests();
    wrap.innerHTML = '';

    if (!tests.length) {
      wrap.innerHTML = '<p class="muted">No completed TILT tests saved yet.</p>';
      return;
    }

    tests.slice(0, 25).forEach(test => {
      const div = document.createElement('div');
      div.className = 'record';

      const syncText = test.mode === 'NEXUS'
        ? (test.sync?.state || 'PENDING')
        : 'STANDALONE';

      div.innerHTML = `<strong>${escapeHtml(test.equipmentName || test.planName)} — ${escapeHtml(test.result)}</strong><br><span>${test.acceptedTestCount} of ${test.requiredTestCount} tests accepted · ${new Date(test.completedAt).toLocaleString()}</span><br><span class="small muted">Mode: ${escapeHtml(test.mode)} · Record: ${escapeHtml(test.completedTestId)} · ${escapeHtml(syncText)}</span>`;

      if (test.mode === 'STANDALONE') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary';
        button.textContent = 'SAVE TEST FILE';
        button.style.marginTop = '8px';
        button.addEventListener('click', () => recordAdapter.exportStandalone(test.completedTestId));
        div.appendChild(button);
      }

      wrap.appendChild(div);
    });
  }

  $('modeNexus').addEventListener('click', () => setOperatingMode('NEXUS'));
  $('modeStandalone').addEventListener('click', () => setOperatingMode('STANDALONE'));
  $('loadStandard').addEventListener('click', loadStandard);
  $('addTest').addEventListener('click', () => {
    markCustom();
    draftTests.push({ id: `T${Date.now()}`, group: 'Custom', label: 'New test point', expected: 'TRANSFORMER_OK' });
    renderDraftTests();
  });
  $('savePlan').addEventListener('click', savePlan);
  $('startTest').addEventListener('click', startSelectedPlan);
  $('acceptResult').addEventListener('click', () => engine.accept({ technicianName: $('technicianName').value.trim() || 'POC User' }));
  $('retestResult').addEventListener('click', () => engine.retest());
  $('simOpen').addEventListener('click', () => emitSim(window.NEXUSTiltProtocol.CHANNELS.OPEN));
  $('simShort').addEventListener('click', () => emitSim(window.NEXUSTiltProtocol.CHANNELS.SHORT));
  $('simOk').addEventListener('click', () => emitSim(window.NEXUSTiltProtocol.CHANNELS.OK));
  $('simBad').addEventListener('click', emitBadCadence);
  $('connectBle').addEventListener('click', connectBle);
  $('disconnectBle').addEventListener('click', () => ble.disconnect());

  if (!ble.supported) {
    $('connectBle').disabled = true;
    $('bleSupportNote').textContent = 'This browser does not support direct Web Bluetooth. The simulator can still be used for development; iPad deployment will use the native BLE bridge.';
  }

  setOperatingMode('NEXUS');
  renderDraftTests();
  refreshSavedPlans();
  renderCompletedTests();
  renderBleStatus({ state: 'DISCONNECTED', message: 'TILT device not connected.' });
})();
