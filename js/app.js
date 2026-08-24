(() => {
  const $ = id => document.getElementById(id);
  let planType = 'STANDARD';
  let draftTests = window.NEXUSTiltTemplates.cloneTests('STANDARD');
  let operatingMode = 'STANDALONE';
  let currentRunStartedAt = '';

  const recordAdapter = new window.NEXUSTiltRecordAdapter({
    store: window.NEXUSTiltStore,
    onStatus: renderCompletionStatus
  });
  recordAdapter.setMode(operatingMode);

  const engine = new window.NEXUSTiltEngine({
    onStateChange: state => {
      renderRunState(state);
      if (state.runId && state.plan && state.status !== 'COMPLETE' && window.NEXUSTiltDB) {
        window.NEXUSTiltDB.saveRun(engine.snapshot()).catch(console.error);
      }
    },
    onCandidate: renderCandidate,
    onAccepted: record => {
      window.NEXUSTiltStore.saveRecord(record);
      if (window.NEXUSTiltDB) window.NEXUSTiltDB.saveRecord(record).catch(console.error);
    },
    onComplete: async summary => {
      $('runStatus').className = 'status good';
      $('runStatus').textContent = summary.testEnd?.endedByTester
        ? `TEST ENDED BY TESTER — ${summary.records.length} accepted reading${summary.records.length === 1 ? '' : 's'} recorded.`
        : `TEST SEQUENCE COMPLETE — ${summary.records.length} accepted reading${summary.records.length === 1 ? '' : 's'} recorded.`;

      try {
        await recordAdapter.finalize(summary, {
          technicianName: $('technicianName').value.trim() || 'POC User',
          startedAt: currentRunStartedAt
        });
        if (window.NEXUSTiltDB && summary.runId) await window.NEXUSTiltDB.removeRun(summary.runId);
      } catch (error) {
        $('completedStatus').className = 'status bad';
        $('completedStatus').textContent = error?.message || 'ARC test record could not be finalized.';
      }

      $('endTestPanel').hidden = true;
      $('endTest').disabled = true;
      renderCompletedTests();
    }
  });

  const ble = new window.NEXUSTiltBLEBridge({
    onEvent: handleDeviceEvent,
    onStatus: renderBleStatus,
    onError: error => {
      $('bleStatus').className = 'status bad';
      $('bleStatus').textContent = error?.message || 'BLE connection error.';
    }
  });

  function makePlanId() { return `PLAN-${Date.now()}`; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }

  function setOperatingMode(mode) {
    operatingMode = mode === 'NEXUS' ? 'NEXUS' : 'STANDALONE';
    recordAdapter.setMode(operatingMode);
    $('modeNexus').className = operatingMode === 'NEXUS' ? 'primary' : 'secondary';
    $('modeStandalone').className = operatingMode === 'STANDALONE' ? 'primary' : 'secondary';
    $('modeStatus').textContent = operatingMode;
    $('modeNote').textContent = operatingMode === 'NEXUS'
      ? 'NEXUS mode will return the finished ARC record to the NEXUS host. Testing and local saving still do not depend on internet access.'
      : 'Standalone mode runs and stores tests locally. Internet access is not required during testing.';
    renderCompletedTests();
  }

  function markCustom() { planType = 'CUSTOM'; $('planType').textContent = 'CUSTOM'; }
  function loadStandard() { planType = 'STANDARD'; draftTests = window.NEXUSTiltTemplates.cloneTests('STANDARD'); $('planType').textContent = 'STANDARD'; renderDraftTests(); }

  function renderDraftTests() {
    const wrap = $('planTests'); wrap.innerHTML = '';
    draftTests.forEach((test, index) => {
      const row = document.createElement('div'); row.className = 'test-row';
      row.innerHTML = `<strong>${index + 1}</strong><div><span class="small muted">${escapeHtml(test.group || 'Custom')}</span><input aria-label="Test ${index + 1}" value="${escapeHtml(test.label)}"></div><button type="button" class="secondary">REMOVE</button>`;
      const input = row.querySelector('input'); const remove = row.querySelector('button');
      input.addEventListener('input', () => { test.label = input.value.trim(); test.from = ''; test.to = ''; test.group = test.group || 'Custom'; markCustom(); });
      remove.addEventListener('click', () => { draftTests.splice(index, 1); markCustom(); renderDraftTests(); });
      wrap.appendChild(row);
    });
  }

  async function savePlan() {
    const equipmentName = $('equipmentName').value.trim();
    const name = $('planName').value.trim() || 'TILT Test Plan';
    const cleanTests = draftTests.map((t, i) => ({ id:t.id || `T${i+1}`, group:t.group || 'Custom', label:(t.label || '').trim(), from:t.from || '', to:t.to || '', expected:t.expected || 'TRANSFORMER_OK', order:i+1 })).filter(t => t.label);
    if (!cleanTests.length) { alert('Add at least one test point before saving.'); return; }
    const plan = { format:'ARC-TILT-PLAN-1', planId:makePlanId(), name, equipmentName, projectId:'', equipmentId:'', templateId:'STANDARD', planType, operatingMode, createdAt:new Date().toISOString(), status:'PLANNED', tests:cleanTests };
    window.NEXUSTiltStore.savePlan(plan);
    if (window.NEXUSTiltDB) await window.NEXUSTiltDB.savePlan(plan);
    refreshSavedPlans(plan.planId);
    $('completedStatus').className = 'status good'; $('completedStatus').textContent = `Test plan saved with ${cleanTests.length} required points.`;
  }

  function refreshSavedPlans(selectId) {
    const plans = window.NEXUSTiltStore.listPlans(); const select = $('savedPlans'); select.innerHTML = '';
    if (!plans.length) { const option=document.createElement('option'); option.value=''; option.textContent='No saved plans'; select.appendChild(option); $('startTest').disabled=true; return; }
    plans.forEach(plan => { const option=document.createElement('option'); option.value=plan.planId; option.textContent=`${plan.equipmentName ? plan.equipmentName + ' — ' : ''}${plan.name} (${plan.tests.length} tests)`; select.appendChild(option); });
    $('startTest').disabled=false; if (selectId) select.value=selectId;
  }

  function startSelectedPlan() {
    const plan = window.NEXUSTiltStore.getPlan($('savedPlans').value); if (!plan) return;
    currentRunStartedAt = new Date().toISOString(); engine.loadPlan(plan); engine.start(); $('endTest').disabled=false;
  }

  function renderRunState(state) {
    const status=$('runStatus'), current=$('currentTest'), panel=$('candidatePanel');
    if (state.status==='IDLE') { status.className='status'; status.textContent='No test running.'; current.textContent='—'; panel.hidden=true; $('endTest').disabled=true; }
    else if (state.status==='READY') { status.className='status'; status.textContent='Plan loaded.'; }
    else if (state.status==='WAITING') { status.className='status warn'; status.textContent='Perform the displayed test point. ARC is waiting for a valid reading.'; current.textContent=state.currentTest?.label || '—'; panel.hidden=true; $('endTest').disabled=false; }
    else if (state.status==='REVIEW') { status.className='status'; status.textContent='Reading detected. Accept it or Reject it.'; current.textContent=state.currentTest?.label || '—'; panel.hidden=false; $('endTest').disabled=false; }
    else if (state.status==='COMPLETE') { current.textContent='COMPLETE'; panel.hidden=true; $('endTest').disabled=true; }
    renderRunList(state);
  }

  function renderCandidate(candidate) {
    const box=$('candidateResult'); box.className='status';
    box.innerHTML=`<strong>${escapeHtml(candidate.observedIndication)}</strong><br><span class="small">Detected ${new Date(candidate.detectedAt).toLocaleTimeString()} · Cadence valid · Confidence ${(candidate.deviceEvent.signalConfidence*100).toFixed(0)}%</span>`;
  }

  function renderRunList(state) {
    const wrap=$('runList'); wrap.innerHTML=''; if (!state.plan) return;
    state.plan.tests.forEach((test,index)=>{ const accepted=state.accepted.find(r=>r.testId===test.id); const row=document.createElement('div'); row.className='test-row'; if(accepted)row.classList.add('done'); if(index===state.currentIndex&&state.status!=='COMPLETE')row.classList.add('current'); row.innerHTML=`<strong>${index+1}</strong><span>${escapeHtml(test.label)}</span><span class="pill">${accepted ? escapeHtml(accepted.reading) : index===state.currentIndex&&state.status!=='COMPLETE' ? 'CURRENT' : 'WAITING'}</span>`; wrap.appendChild(row); });
  }

  function handleDeviceEvent(evt) {
    const result=engine.receiveDeviceEvent(evt);
    if(!result.accepted&&result.reason==='NOT_WAITING'){ $('runStatus').className='status warn'; $('runStatus').textContent='Open a test or resolve the current Accept/Reject decision first.'; }
    else if(!result.accepted&&result.reason==='INVALID_EVENT'){ $('runStatus').className='status warn'; $('runStatus').textContent='Ignored: light event did not contain a valid TILT cadence.'; }
  }

  function emitSim(channel){ window.NEXUSTiltSimulator.emit(channel,handleDeviceEvent); }
  function emitBadCadence(){ window.NEXUSTiltSimulator.emitBadCadence(handleDeviceEvent); }

  function renderBleStatus(info) {
    const status=$('bleStatus'), deviceName=$('bleDeviceName'), connected=info.state==='CONNECTED';
    status.className=info.state==='CONNECTING'?'status warn':connected?'status good':'status';
    status.textContent=info.message || 'ARC device not connected.'; deviceName.textContent=connected?(info.deviceName||'ARC DEVICE'):'NO DEVICE'; $('connectBle').disabled=connected||!ble.supported; $('disconnectBle').disabled=!connected;
  }

  async function connectBle(){ try{await ble.connect();}catch(error){if(error?.name==='NotFoundError'){$('bleStatus').className='status';$('bleStatus').textContent='Device selection canceled.';}} }

  function renderCompletionStatus(info){ const box=$('completedStatus'); box.className=info.state==='LOCAL'||info.state==='DELIVERED'?'status good':info.state==='PENDING'?'status warn':'status'; box.textContent=info.message||'ARC test record saved.'; }

  function renderCompletedTests() {
    const wrap=$('completedTests'), tests=window.NEXUSTiltStore.listCompletedTests(); wrap.innerHTML='';
    if(!tests.length){wrap.innerHTML='<p class="muted">No ARC test records saved yet.</p>';return;}
    tests.slice(0,25).forEach(test=>{ const div=document.createElement('div'); div.className='record'; const endText=test.testEnd?.endedByTester?`Ended by tester: ${test.testEnd.reason}`:'Test sequence completed'; div.innerHTML=`<strong>${escapeHtml(test.equipmentName||test.planName)}</strong><br><span>${test.acceptedReadingCount ?? test.readings?.length ?? 0} accepted reading(s) · ${new Date(test.completedAt).toLocaleString()}</span><br><span class="small muted">${escapeHtml(endText)}</span>`; if(test.mode==='STANDALONE'){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='SAVE TEST FILE';button.style.marginTop='8px';button.addEventListener('click',()=>recordAdapter.exportStandalone(test.completedTestId));div.appendChild(button);} wrap.appendChild(div); });
  }

  function openEndTest(){ if(!engine.plan||engine.status==='COMPLETE'||engine.status==='IDLE')return; $('endTestPanel').hidden=false; $('endTestReason').focus(); }
  function cancelEndTest(){ $('endTestPanel').hidden=true; $('endTestReason').value=''; }
  function confirmEndTest(){ const reason=$('endTestReason').value.trim(); if(!reason){alert('Enter a reason for ending the test.');return;} try{engine.endTest({reason,technicianName:$('technicianName').value.trim()||'POC User'}); $('endTestReason').value='';}catch(error){alert(error.message);} }

  $('modeNexus').addEventListener('click',()=>setOperatingMode('NEXUS'));
  $('modeStandalone').addEventListener('click',()=>setOperatingMode('STANDALONE'));
  $('loadStandard').addEventListener('click',loadStandard);
  $('addTest').addEventListener('click',()=>{markCustom();draftTests.push({id:`T${Date.now()}`,group:'Custom',label:'New test point',expected:'TRANSFORMER_OK'});renderDraftTests();});
  $('savePlan').addEventListener('click',savePlan);
  $('startTest').addEventListener('click',startSelectedPlan);
  $('acceptResult').addEventListener('click',()=>engine.accept({technicianName:$('technicianName').value.trim()||'POC User'}));
  $('rejectResult').addEventListener('click',()=>engine.reject());
  $('endTest').addEventListener('click',openEndTest);
  $('confirmEndTest').addEventListener('click',confirmEndTest);
  $('cancelEndTest').addEventListener('click',cancelEndTest);
  $('simOpen').addEventListener('click',()=>emitSim(window.NEXUSTiltProtocol.CHANNELS.OPEN));
  $('simShort').addEventListener('click',()=>emitSim(window.NEXUSTiltProtocol.CHANNELS.SHORT));
  $('simOk').addEventListener('click',()=>emitSim(window.NEXUSTiltProtocol.CHANNELS.OK));
  $('simBad').addEventListener('click',emitBadCadence);
  $('connectBle').addEventListener('click',connectBle);
  $('disconnectBle').addEventListener('click',()=>ble.disconnect());

  if(!ble.supported){$('connectBle').disabled=true;$('bleSupportNote').textContent='This browser does not support direct Web Bluetooth. The simulator can still be used for development; iPad deployment will use the native BLE bridge.';}

  setOperatingMode('STANDALONE');
  renderDraftTests(); refreshSavedPlans(); renderCompletedTests(); renderBleStatus({state:'DISCONNECTED',message:'ARC device not connected.'});
})();
