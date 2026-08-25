/* ARC runtime recovery/controller v32 */
(()=>{
  const $=id=>document.getElementById(id);
  const set=(id,text,cls)=>{const el=$(id);if(!el)return;if(cls)el.className=cls;el.textContent=text};
  function bootMessage(text,kind='info'){
    const el=$('networkStatus');
    if(el){el.className=`status ${kind}`;el.textContent=text}
  }

  let engine=window.ARCApp?.engine||null;
  if(!engine&&window.NEXUSTiltEngine){
    engine=new window.NEXUSTiltEngine({
      onStateChange:render,
      onCandidate:c=>{
        const p=$('candidatePanel'); if(p)p.hidden=false;
        set('candidateResult',`${c.observedIndication} detected`,'status');
      }
    });
  }

  function visiblePlan(){
    const rows=[...document.querySelectorAll('#planTests .test-row input')];
    const tests=(rows.length?rows.map((x,i)=>({id:`T${i+1}`,order:i+1,label:String(x.value||'').trim(),group:'TILT Test',expected:'TRANSFORMER_OK'})):
      (window.NEXUSTiltTemplates?.cloneTests?.('STANDARD')||[])).filter(t=>t.label);
    const manual=$('calManual')?.value.trim()||'';
    return {
      format:'ARC-TILT-PLAN-3',planId:`DRAFT-${Date.now()}`,name:$('planName')?.value.trim()||'Standard TILT Test',
      projectName:$('projectName')?.value.trim()||'',projectId:'',equipmentId:$('equipmentName')?.value.trim()||'',equipmentName:$('equipmentName')?.value.trim()||'',equipmentType:$('equipmentType')?.value.trim()||'',specialNotes:$('specialNotes')?.value.trim()||'',
      calibrationVerification:{method:manual?'MANUAL':'NONE',manualInformation:manual,photoDataUrl:'',capturedAt:''},
      planType:'CURRENT_SCREEN',version:0,createdAt:new Date().toISOString(),tests
    };
  }

  function render(s){
    if(!s)return;
    set('runCounter',s.status==='COMPLETE'?'COMPLETE':s.plan?`${Math.min((s.currentIndex||0)+1,s.plan.tests.length)} / ${s.plan.tests.length}`:'NOT STARTED','pill');
    set('currentTest',s.currentTest?.label||(s.status==='COMPLETE'?'COMPLETE':'—'),'result-big');
    if(s.status==='WAITING')set('runStatus','TEST OPEN — perform the displayed test point.','status good');
    else if(s.status==='REVIEW')set('runStatus','Reading detected — ACCEPT or REJECT / RETEST.','status info');
    else if(s.status==='COMPLETE')set('runStatus','TEST COMPLETE — choose how to save or send this test.','status good');
    const cp=$('candidatePanel');if(cp)cp.hidden=s.status!=='REVIEW';
    const p=$('pauseTest');if(p)p.disabled=!['WAITING','REVIEW'].includes(s.status);
    const r=$('resumeTest');if(r)r.disabled=s.status!=='PAUSED';
    const e=$('endTest');if(e)e.disabled=!['WAITING','REVIEW','PAUSED'].includes(s.status);
  }

  function bindStart(){
    const b=$('startTest'); if(!b||!engine)return;
    b.disabled=false;
    b.onclick=()=>{
      try{
        const p=visiblePlan(),missing=[];
        if(!$('technicianName')?.value.trim())missing.push('Tester Name');
        if(!p.projectName)missing.push('Project Name');
        if(!p.equipmentId)missing.push('Equipment ID');
        if(!p.equipmentType)missing.push('Equipment Type');
        if(!p.tests.length)missing.push('Test Plan');
        if(p.calibrationVerification.method==='NONE')missing.push('Calibration Verification');
        if(missing.length){set('runStatus','Missing: '+missing.join(', '),'status warn');return;}
        const panel=$('completionActions');if(panel)panel.hidden=true;
        engine.loadPlan(p);engine.start();render({status:engine.status,plan:engine.plan,currentIndex:engine.currentIndex,currentTest:engine.currentTest});
      }catch(err){set('runStatus','OPEN TEST ERROR: '+(err?.message||String(err)),'status bad');console.error(err)}
    };
  }

  function bindSimulation(){
    const map=[['simOpen','OPEN'],['simShort','SHORT'],['simOk','TRANSFORMER_OK']];
    map.forEach(([id,ch])=>{const b=$(id);if(!b)return;b.onclick=()=>{try{const evt=window.NEXUSTiltProtocol?.createSimulatedEvent?window.NEXUSTiltProtocol.createSimulatedEvent(ch):null;if(!evt)throw Error('Simulator unavailable');engine.receiveDeviceEvent(evt);render({status:engine.status,plan:engine.plan,currentIndex:engine.currentIndex,currentTest:engine.currentTest});}catch(e){set('runStatus','SIMULATOR ERROR: '+e.message,'status bad')}}});
    const a=$('acceptResult');if(a)a.onclick=()=>{engine.accept({technicianName:$('technicianName')?.value.trim()||'POC User'});render({status:engine.status,plan:engine.plan,currentIndex:engine.currentIndex,currentTest:engine.currentTest})};
    const r=$('rejectResult');if(r)r.onclick=()=>{engine.reject();render({status:engine.status,plan:engine.plan,currentIndex:engine.currentIndex,currentTest:engine.currentTest})};
  }

  function bindBle(){
    const b=$('connectBle');if(!b)return;
    b.disabled=false;
    b.onclick=async()=>{
      try{
        if(!window.isSecureContext)throw Error('Chrome requires HTTPS for Bluetooth.');
        if(!navigator.bluetooth)throw Error('Web Bluetooth is unavailable in this Chrome session.');
        const bridge=window.ARCApp?.ble||new window.NEXUSTiltBLEBridge({onEvent:e=>engine?.receiveDeviceEvent(e),onStatus:i=>set('bleStatus',i.message||i.state,'status')});
        set('bleStatus','Opening Chrome Bluetooth chooser...','status info');
        await bridge.connect();
      }catch(err){set('bleStatus','CONNECT ERROR: '+(err?.message||String(err)),'status bad');console.error(err)}
    };
  }

  function installCompletionUI(){
    if($('completionActions'))return loadCompletionController();
    const runCard=document.querySelector('.run-card');
    if(!runCard)return;
    const panel=document.createElement('div');
    panel.id='completionActions';
    panel.className='end-panel';
    panel.hidden=true;
    panel.innerHTML=`
      <div class="section-title-row"><h2>SAVE COMPLETED TEST</h2><span class="pill accent">COMPLETE</span></div>
      <p class="muted">Choose what to do with this completed ARC test.</p>
      <div class="field"><label>Email Recipient (optional)</label><input id="completionEmail" type="email" placeholder="name@company.com"></div>
      <div class="row">
        <button id="saveCompletedLocal" class="good">SAVE LOCALLY</button>
        <button id="emailCompletedTest" class="secondary">EMAIL TEST</button>
        <button id="saveAndEmailCompleted" class="primary">SAVE LOCALLY + EMAIL</button>
      </div>
      <div id="completionActionStatus" class="status">Complete the test to enable save options.</div>`;
    const endPanel=$('endTestPanel');
    if(endPanel?.parentNode)endPanel.parentNode.insertBefore(panel,endPanel.nextSibling);
    else runCard.appendChild(panel);
    loadCompletionController();
  }

  function loadCompletionController(){
    if(window.ARC_COMPLETION_ACTIONS_LOADING)return;
    window.ARC_COMPLETION_ACTIONS_LOADING=true;
    const s=document.createElement('script');
    s.src='js/arc_completion_actions.js?v=32';
    s.onload=()=>{window.ARC_COMPLETION_ACTIONS_LOADED=true};
    s.onerror=()=>set('runStatus','ARC completion controls failed to load.','status bad');
    document.body.appendChild(s);
  }

  try{
    bindStart();bindSimulation();bindBle();installCompletionUI();
    window.ARC_RUNTIME_V26={ok:true,engine,version:32};
    bootMessage(`ARC UI READY v32 · ${window.isSecureContext?'HTTPS OK':'NOT SECURE'}`,'good');
  }catch(err){
    window.ARC_RUNTIME_V26={ok:false,error:String(err),version:32};
    bootMessage('ARC STARTUP ERROR: '+(err?.message||String(err)),'bad');
  }
})();
