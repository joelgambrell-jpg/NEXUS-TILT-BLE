(() => {
  const $ = id => document.getElementById(id);
  let scope = 'FULL';
  let draftTests = window.NEXUSTiltTemplates.buildScope(scope);

  const engine = new window.NEXUSTiltEngine({
    onStateChange: renderRunState,
    onCandidate: renderCandidate,
    onAccepted: record => {
      window.NEXUSTiltStore.saveRecord(record);
      renderRecords();
    },
    onComplete: summary => {
      $('runStatus').className = 'status good';
      $('runStatus').textContent = `TILT TEST COMPLETE — ${summary.records.length} accepted tests.`;
    }
  });

  function makePlanId() {
    return `PLAN-${Date.now()}`;
  }

  function buildDraftForScope(nextScope) {
    scope = nextScope;
    document.querySelectorAll('.scope-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.scope === scope);
    });
    if (scope === 'FULL' || scope === 'HALF') {
      draftTests = window.NEXUSTiltTemplates.buildScope(scope);
    }
    renderDraftTests();
  }

  function renderDraftTests() {
    const wrap = $('planTests');
    wrap.innerHTML = '';
    draftTests.forEach((test, index) => {
      const row = document.createElement('div');
      row.className = 'test-row';
      row.innerHTML = `<strong>${index + 1}</strong><input aria-label="Test ${index + 1}" value="${escapeHtml(test.label)}"><button type="button" class="secondary">REMOVE</button>`;
      const input = row.querySelector('input');
      const remove = row.querySelector('button');
      input.addEventListener('input', () => {
        test.label = input.value.trim();
        test.from = '';
        test.to = '';
      });
      remove.addEventListener('click', () => {
        draftTests.splice(index, 1);
        scope = 'CUSTOM';
        document.querySelectorAll('.scope-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.scope === 'CUSTOM'));
        renderDraftTests();
      });
      wrap.appendChild(row);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function savePlan() {
    const equipmentName = $('equipmentName').value.trim();
    const name = $('planName').value.trim() || 'TILT Test Plan';
    const cleanTests = draftTests
      .map((t, i) => ({
        id: t.id || `T${i + 1}`,
        label: (t.label || '').trim(),
        from: t.from || '',
        to: t.to || '',
        expected: t.expected || 'TRANSFORMER_OK'
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
      scope,
      createdAt: new Date().toISOString(),
      status: 'PLANNED',
      tests: cleanTests
    };

    window.NEXUSTiltStore.savePlan(plan);
    refreshSavedPlans(plan.planId);
    alert('TILT test plan saved in the POC.');
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
      option.textContent = `${plan.equipmentName ? plan.equipmentName + ' — ' : ''}${plan.name} (${plan.scope})`;
      select.appendChild(option);
    });
    $('startTest').disabled = false;
    if (selectId) select.value = selectId;
  }

  function startSelectedPlan() {
    const plan = window.NEXUSTiltStore.getPlan($('savedPlans').value);
    if (!plan) return;
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

  function emitSim(channel) {
    window.NEXUSTiltSimulator.emit(channel, evt => {
      const result = engine.receiveDeviceEvent(evt);
      if (!result.accepted && result.reason === 'NOT_WAITING') {
        $('runStatus').className = 'status warn';
        $('runStatus').textContent = 'Start a test or resolve the current Accept/Retest decision first.';
      }
    });
  }

  function emitBadCadence() {
    window.NEXUSTiltSimulator.emitBadCadence(evt => {
      const result = engine.receiveDeviceEvent(evt);
      if (!result.accepted && result.reason === 'INVALID_EVENT') {
        $('runStatus').className = 'status warn';
        $('runStatus').textContent = 'Rejected: light event did not contain a valid TILT cadence.';
      }
    });
  }

  function renderRecords() {
    const records = window.NEXUSTiltStore.listRecords();
    const wrap = $('records');
    if (!records.length) {
      wrap.innerHTML = '<p class="muted">No accepted test records yet.</p>';
      return;
    }
    wrap.innerHTML = '';
    records.slice(0, 50).forEach(record => {
      const div = document.createElement('div');
      div.className = 'record';
      div.innerHTML = `<strong>${escapeHtml(record.equipmentName || 'Equipment not assigned')} — ${escapeHtml(record.testPoint)}</strong><br><span>${escapeHtml(record.observedIndication)} · ${escapeHtml(record.result)}</span><br><span class="small muted">Accepted ${new Date(record.acceptedAt).toLocaleString()} by ${escapeHtml(record.technicianName)} · Device ${escapeHtml(record.deviceId)}</span>`;
      wrap.appendChild(div);
    });
  }

  document.querySelectorAll('.scope-btn').forEach(btn => btn.addEventListener('click', () => buildDraftForScope(btn.dataset.scope)));
  $('addTest').addEventListener('click', () => {
    scope = 'CUSTOM';
    document.querySelectorAll('.scope-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.scope === 'CUSTOM'));
    draftTests.push({ id: `T${Date.now()}`, label: 'New test point', expected: 'TRANSFORMER_OK' });
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

  renderDraftTests();
  refreshSavedPlans();
  renderRecords();
})();
