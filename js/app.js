(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const clone=v=>structuredClone(v);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PENDING_COMPLETE_KEY='arc_pending_completion_v1';

  let planType='STANDARD';
  let draftTests=window.NEXUSTiltTemplates.cloneTests('STANDARD');
  let editingPlanId='';
  let calPhoto='';
  let calPhotoName='';
  let pendingCompletion=null;
  let lastSavedCompletedId='';
  let deviceConnected=false;

  const adapter=new window.NEXUSTiltRecordAdapter({
    store:window.NEXUSTiltStore,
    onStatus:i=>{
      if($('completedStatus')){
        $('completedStatus').className='status good';
        $('completedStatus').textContent=i.message||'ARC record saved locally.';
      }
    }
  });
  adapter.setMode('STANDALONE');

  const engine=new window.NEXUSTiltEngine({
    onStateChange:state=>{
      renderState(state);
      if(state.runId&&state.plan&&!['IDLE','COMPLETE'].includes(state.status)){
        window.NEXUSTiltDB?.saveRun(engine.snapshot()).catch(console.error);
      }
    },
    onCandidate:c=>renderCandidate(c),
    onAccepted:()=>{},
    onComplete:s=>handleEngineComplete(s)
  });

  const ble=new window.NEXUSTiltBLEBridge({
    onEvent:e=>engine.receiveDeviceEvent(e),
    onStatus:i=>{
      const connected=i.state==='CONNECTED';
      if(connected)deviceConnected=true;
      $('bleStatus').textContent=i.message||'ARC device not connected.';
      $('bleDeviceName').textContent=connected?(i.deviceName||'ARC DEVICE'):'NO DEVICE';
      renderLiveDevice();
      if(i.state==='DISCONNECTED'&&deviceConnected&&['WAITING','REVIEW'].includes(engine.status)){
        engine.pause({reason:'ARC device disconnected',technicianName:engine.plan?.testerName||'POC User'});
      }
    },
    onError:e=>console.error('ARC BLE error',e)
  });

  function active(){return !!(engine.plan&&!['IDLE','COMPLETE'].includes(engine.status));}

  function matrixKeyFor(test){
    if(test?.matrixKey)return test.matrixKey;
    return String(test?.label||'').replace(/[^A-Z0-9]/gi,'').toUpperCase();
  }

  function setupMeta(){
    const manual=$('calManual').value.trim();
    return{
      projectName:$('projectName').value.trim(),
      equipmentId:$('equipmentName').value.trim(),
      equipmentName:$('equipmentName').value.trim(),
      equipmentType:$('equipmentType').value.trim(),
      testerName:$('testerName').value.trim(),
      specialNotes:$('specialNotes').value.trim(),
      calibrationVerification:{
        method:calPhoto&&manual?'MANUAL_AND_PHOTO':calPhoto?'PHOTO':manual?'MANUAL':'NONE',
        manualInformation:manual,
        photoDataUrl:calPhoto,
        photoName:calPhotoName,
        capturedAt:calPhoto?new Date().toISOString():''
      }
    };
  }

  function currentDraftPlan(){
    const m=setupMeta();
    return{
      format:'ARC-TILT-PLAN-4',
      planId:editingPlanId||`DRAFT-${Date.now()}`,
      name:$('planName').value.trim()||'Pre-Torque TILT Test',
      ...m,
      projectId:'',
      templateId:'STANDARD',
      matrixName:'Pre Torque Tilt Test',
      planType,
      version:editingPlanId?(window.NEXUSTiltStore.getPlan(editingPlanId)?.version||1):0,
      createdAt:new Date().toISOString(),
      tests:draftTests.map((t,i)=>({...t,id:t.id||`T${i+1}`,matrixKey:t.matrixKey||matrixKeyFor(t),order:i+1,label:String(t.label||'').trim()})).filter(t=>t.label)
    };
  }

  function missingSetup(plan){
    const missing=[];
    if(!plan.projectName)missing.push('Project Name');
    if(!plan.equipmentId)missing.push('Equipment ID');
    if(!plan.equipmentType)missing.push('Equipment Type');
    if(!plan.testerName)missing.push('Tester Name');
    if(!plan.tests?.length)missing.push('Test Plan');
    const c=plan.calibrationVerification||{};
    if(!c.manualInformation?.trim()&&!c.photoDataUrl)missing.push('Calibration Verification');
    return missing;
  }

  function setPhoto(data,name){
    calPhoto=data||'';
    calPhotoName=name||'';
    $('calPhotoStatus').textContent=calPhoto?`Photo attached: ${calPhotoName||'calibration sticker'}`:'No calibration photo attached.';
    renderDraftPreview();
  }

  function readPhoto(file){
    if(!file){setPhoto('','');return;}
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        try{
          const max=1600,scale=Math.min(1,max/Math.max(img.width,img.height));
          const c=document.createElement('canvas');
          c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));
          c.getContext('2d').drawImage(img,0,0,c.width,c.height);
          setPhoto(c.toDataURL('image/jpeg',.78),file.name);
        }catch(e){setPhoto(reader.result,file.name);}
      };
      img.onerror=()=>setPhoto(reader.result,file.name);
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  }

  function renderDraft(){
    const box=$('planTests');
    box.innerHTML='';
    draftTests.forEach((t,i)=>{
      const row=document.createElement('div');
      row.className='test-row';
      row.innerHTML=`<strong>${i+1}</strong><div><input class="plan-test-label" value="${esc(t.label)}"><span class="small muted">${esc(t.group||'Custom')}</span></div><div class="row"><button class="secondary up" type="button">↑</button><button class="secondary down" type="button">↓</button><button class="secondary remove" type="button">REMOVE</button></div>`;
      row.querySelector('input').addEventListener('input',e=>{t.label=e.target.value;t.matrixKey=matrixKeyFor(t);planType='CUSTOM';$('planType').textContent='CUSTOM';renderDraftPreview();});
      row.querySelector('.up').onclick=()=>moveTest(i,-1);
      row.querySelector('.down').onclick=()=>moveTest(i,1);
      row.querySelector('.remove').onclick=()=>{if(active())return;draftTests.splice(i,1);planType='CUSTOM';$('planType').textContent='CUSTOM';renderDraft();renderDraftPreview();};
      box.appendChild(row);
    });
  }

  function moveTest(i,delta){
    if(active())return;
    const n=i+delta;if(n<0||n>=draftTests.length)return;
    [draftTests[i],draftTests[n]]=[draftTests[n],draftTests[i]];
    planType='CUSTOM';$('planType').textContent='CUSTOM';renderDraft();renderDraftPreview();
  }

  function renderDraftPreview(){
    if(active()||pendingCompletion)return;
    const p=currentDraftPlan();
    $('runPlanSummary').textContent=`${p.name} · ${p.equipmentId||'No equipment'} · Tester: ${p.testerName||'—'}`;
    fillLiveMeta(p,null);
    clearMatrix();
  }

  async function savePlan(){
    if(active())return alert('A test is already in progress.');
    const p=currentDraftPlan();
    const miss=missingSetup(p);
    if(miss.length)return alert('Complete the plan before saving:\n\n'+miss.join('\n'));
    const prior=editingPlanId?window.NEXUSTiltStore.getPlan(editingPlanId):null;
    p.planId=`PLAN-${Date.now()}`;
    p.version=(prior?.version||0)+1;
    p.sourcePlanId=prior?.planId||'';
    p.createdAt=new Date().toISOString();
    window.NEXUSTiltStore.savePlan(p);
    await window.NEXUSTiltDB?.savePlan(p);
    editingPlanId=p.planId;
    refreshSavedPlans(p.planId);
    $('runPlanSummary').textContent=`Plan saved: ${p.name} v${p.version}`;
  }

  function refreshSavedPlans(selectId=''){
    const select=$('savedPlans');
    const plans=window.NEXUSTiltStore.listPlans();
    select.innerHTML=plans.length?'':'<option value="">No saved plans</option>';
    plans.forEach(p=>{
      const o=document.createElement('option');o.value=p.planId;o.textContent=`${p.equipmentId?p.equipmentId+' — ':''}${p.name} v${p.version||1}`;select.appendChild(o);
    });
    if(selectId)select.value=selectId;
  }

  function loadPlanIntoForm(p){
    if(!p)return;
    editingPlanId=p.planId||'';planType=p.planType||'CUSTOM';draftTests=clone(p.tests||[]);
    $('planName').value=p.name||'';$('projectName').value=p.projectName||'';$('equipmentName').value=p.equipmentId||p.equipmentName||'';$('equipmentType').value=p.equipmentType||'';$('testerName').value=p.testerName||p.tester?.name||'';$('specialNotes').value=p.specialNotes||'';$('calManual').value=p.calibrationVerification?.manualInformation||'';
    calPhoto=p.calibrationVerification?.photoDataUrl||'';calPhotoName=p.calibrationVerification?.photoName||'';
    $('calPhotoStatus').textContent=calPhoto?`Saved calibration photo attached${calPhotoName?': '+calPhotoName:''}.`:'No calibration photo attached.';
    $('planType').textContent=planType;
    renderDraft();renderDraftPreview();updateFooterTester();
  }

  function startTest(){
    if(active())return;
    if(pendingCompletion)return alert('Finish saving or sending the completed test first.');
    const p=currentDraftPlan();
    const miss=missingSetup(p);
    if(miss.length){$('runStatus').className='status warn';$('runStatus').textContent='Missing: '+miss.join(', ');return;}
    p.planId=p.planId.startsWith('PLAN-')?p.planId:`RUNPLAN-${Date.now()}`;
    engine.loadPlan(p);engine.start();
    $('runCard').scrollIntoView({behavior:'smooth',block:'start'});
  }

  function renderCandidate(c){
    $('candidatePanel').hidden=false;
    $('candidateResult').innerHTML=`<strong>${esc(displayReading(c.observedIndication))}</strong><br><span class="small">Detected ${new Date(c.detectedAt).toLocaleTimeString()}</span>`;
  }

  function displayReading(reading){
    if(reading==='TRANSFORMER_OK')return 'TRANSFORMER OK';
    return reading||'—';
  }

  function matrixState(reading){
    return reading==='TRANSFORMER_OK'?{main:'GO',sub:'TRANSFORMER OK',cls:'matrix-go'}:{main:'NO GO',sub:displayReading(reading),cls:'matrix-nogo'};
  }

  function clearMatrix(){
    ['AB','AC','BC','AG','BG','CG','AN','BN','CN','NG'].forEach(k=>{
      const el=$(`live-${k}`);if(!el)return;el.className='matrix-cell';el.innerHTML='—';
    });
  }

  function fillLiveMeta(plan,state){
    $('liveProject').textContent=plan?.projectName||'—';
    $('liveEquipment').textContent=plan?.equipmentId||plan?.equipmentName||'—';
    $('liveEquipmentType').textContent=plan?.equipmentType||'—';
    $('liveTester').textContent=plan?.testerName||'—';
    const c=plan?.calibrationVerification||{};
    const parts=[];if(c.manualInformation)parts.push(c.manualInformation);if(c.photoDataUrl)parts.push('Calibration photo attached');
    $('liveCalibration').textContent=parts.join(' · ')||'—';
    $('liveRecordStatus').textContent=state?.status||'DRAFT';
    renderLiveDevice(state);
  }

  function renderLiveDevice(state){
    let device='NO DEVICE';
    const accepted=state?.accepted||engine.accepted||[];
    const hit=accepted.find(r=>r.deviceId);
    if(hit)device=`${hit.deviceId}${hit.firmwareVersion?' · '+hit.firmwareVersion:''}`;
    else if(ble.connected)device=ble.device?.name||'ARC DEVICE CONNECTED';
    $('liveDevice').textContent=device;
  }

  function renderLiveMatrix(state){
    const p=state?.plan||engine.plan||currentDraftPlan();
    fillLiveMeta(p,state);
    clearMatrix();
    const accepted=state?.accepted||[];
    accepted.forEach(r=>{
      const test=p.tests?.find(t=>t.id===r.testId)||{};
      const key=matrixKeyFor(test)||matrixKeyFor({label:r.testPoint});
      const el=$(`live-${key}`);if(!el)return;
      const m=matrixState(r.reading);
      const retests=(state?.audit||[]).filter(a=>a.action==='REJECT_RETEST'&&a.testId===r.testId).length;
      el.className=`matrix-cell ${m.cls}`;
      el.innerHTML=`<strong>${m.main}</strong><span>${esc(m.sub)}</span><small>${esc(r.technicianName||p.testerName||'')} · ${new Date(r.acceptedAt).toLocaleTimeString()}${retests?` · ${retests} retest${retests===1?'':'s'}`:''}</small>`;
    });
    if(['WAITING','REVIEW'].includes(state?.status)&&state.currentTest){
      const key=matrixKeyFor(state.currentTest),el=$(`live-${key}`);
      if(el&&!accepted.some(r=>r.testId===state.currentTest.id)){
        el.className='matrix-cell matrix-current';
        el.innerHTML='<strong>CURRENT</strong><span>Waiting for ARC reading</span>';
      }
    }
  }

  function renderState(s){
    const status=s?.status||'IDLE';
    $('runCounter').textContent=status==='COMPLETE'?'COMPLETE':s?.plan?`${Math.min((s.currentIndex||0)+1,s.plan.tests.length)} / ${s.plan.tests.length}`:'NOT STARTED';
    $('currentTest').textContent=s?.currentTest?.label||(status==='COMPLETE'?'COMPLETE':'—');
    $('candidatePanel').hidden=status!=='REVIEW';
    $('pauseTest').disabled=!['WAITING','REVIEW'].includes(status);
    $('resumeTest').disabled=status!=='PAUSED';
    $('endTest').disabled=!['WAITING','REVIEW','PAUSED'].includes(status);
    $('startTest').disabled=active()||!!pendingCompletion;
    if(status==='WAITING'){$('runStatus').className='status good';$('runStatus').textContent='TEST OPEN — perform the displayed test point.';}
    else if(status==='REVIEW'){$('runStatus').className='status info';$('runStatus').textContent='Reading detected — ACCEPT or REJECT / RETEST.';}
    else if(status==='PAUSED'){$('runStatus').className='status warn';$('runStatus').textContent='TEST PAUSED — resume when ready.';}
    else if(status==='COMPLETE'){$('runStatus').className='status good';$('runStatus').textContent='TEST COMPLETE — choose Save Locally, Email Test, or Both.';}
    else {$('runStatus').className='status';$('runStatus').textContent='No test running.';}
    if(s?.plan){$('runPlanSummary').textContent=`${s.plan.name} · ${s.plan.equipmentId||''} · Tester: ${s.plan.testerName||'—'}`;renderLiveMatrix(s);}else renderDraftPreview();
  }

  function handleEngineComplete(snapshot){
    pendingCompletion=clone(snapshot);
    try{localStorage.setItem(PENDING_COMPLETE_KEY,JSON.stringify(pendingCompletion));}catch(e){console.error(e);}
    renderState({status:'COMPLETE',plan:snapshot.plan,currentIndex:snapshot.plan?.tests?.length||0,currentTest:null,accepted:snapshot.records||[],audit:snapshot.audit||[],testEnd:snapshot.testEnd});
    showCompletionModal();
  }

  function showCompletionModal(){
    if(!pendingCompletion)return;
    $('completionModal').hidden=false;
    $('completionActionStatus').className='status info';
    $('completionActionStatus').textContent='The completed test has not been finalized yet.';
  }

  function clearPendingCompletion(){
    pendingCompletion=null;
    try{localStorage.removeItem(PENDING_COMPLETE_KEY);}catch(e){}
  }

  async function finalizeLocal(){
    if(!pendingCompletion)throw Error('No completed test is waiting to be saved.');
    const existing=window.NEXUSTiltStore.listCompletedTests().find(x=>x.runId===pendingCompletion.runId);
    if(existing){lastSavedCompletedId=existing.completedTestId;return existing;}
    const saved=await adapter.finalize(pendingCompletion,{technicianName:pendingCompletion.plan?.testerName||''});
    lastSavedCompletedId=saved.completedTestId;
    await window.NEXUSTiltDB?.removeRun(pendingCompletion.runId);
    renderCompletedTests();
    return saved;
  }

  function emailSubject(snapshot){
    const p=snapshot?.plan||{};
    return `ARC TILT Test — ${p.equipmentId||'Equipment'} — ${p.projectName||'Project'}`;
  }

  function emailBody(snapshot){
    const p=snapshot?.plan||{},records=snapshot?.records||[];
    const rows=records.map((r,i)=>{
      const m=matrixState(r.reading);
      return `${i+1}. ${r.testPoint}: ${m.main} — ${m.sub} — accepted ${new Date(r.acceptedAt).toLocaleString()}`;
    }).join('\n');
    const cal=p.calibrationVerification||{};
    return[
      'ARC Systems Completed TILT Test','',
      `Project: ${p.projectName||''}`,
      `Equipment ID: ${p.equipmentId||''}`,
      `Equipment Type: ${p.equipmentType||''}`,
      `Tester: ${p.testerName||''}`,
      `Calibration / Tool ID: ${cal.manualInformation||''}`,
      `Calibration Photo: ${cal.photoDataUrl?'Captured with ARC record':'Not attached'}`,
      `Started: ${snapshot?.startedAt?new Date(snapshot.startedAt).toLocaleString():''}`,
      `Completed: ${snapshot?.completedAt?new Date(snapshot.completedAt).toLocaleString():new Date().toLocaleString()}`,'',
      'Pre Torque Tilt Test:',rows,'','Generated by ARC Systems'
    ].join('\n');
  }

  function openEmail(snapshot){
    const to=$('completionEmail').value.trim();
    const href=`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(emailSubject(snapshot))}&body=${encodeURIComponent(emailBody(snapshot))}`;
    window.location.href=href;
  }

  async function completeEmailOnly(){
    if(!pendingCompletion)return;
    const snap=clone(pendingCompletion);
    openEmail(snap);
    await window.NEXUSTiltDB?.removeRun(snap.runId);
    clearPendingCompletion();
    $('completionModal').hidden=true;
    $('runStatus').className='status good';
    $('runStatus').textContent='TEST COMPLETE — EMAIL PREPARED. No local completed record was stored.';
    $('startTest').disabled=false;
  }

  async function saveOnly(){
    try{
      $('completionActionStatus').textContent='Saving completed test locally...';
      const saved=await finalizeLocal();
      clearPendingCompletion();
      $('completionModal').hidden=true;
      $('runStatus').className='status good';$('runStatus').textContent='TEST COMPLETE — SAVED LOCALLY.';
      $('startTest').disabled=false;
      renderCompletedTests();showRecord(saved.completedTestId);
      $('recordsCard').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){$('completionActionStatus').className='status bad';$('completionActionStatus').textContent='SAVE ERROR: '+(e?.message||e);}
  }

  async function saveAndEmail(){
    try{
      $('completionActionStatus').textContent='Saving locally, then opening email...';
      const snap=clone(pendingCompletion);
      const saved=await finalizeLocal();
      openEmail(snap);
      clearPendingCompletion();
      $('completionModal').hidden=true;
      $('runStatus').className='status good';$('runStatus').textContent='TEST COMPLETE — SAVED LOCALLY + EMAIL PREPARED.';
      $('startTest').disabled=false;
      renderCompletedTests();lastSavedCompletedId=saved.completedTestId;
    }catch(e){$('completionActionStatus').className='status bad';$('completionActionStatus').textContent='SAVE / EMAIL ERROR: '+(e?.message||e);}
  }

  function recordMatches(x,q){
    if(!q)return true;
    const hay=[x.projectName,x.equipmentId,x.equipmentType,x.tester?.name,x.completedTestId].join(' ').toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function renderCompletedTests(){
    const q=$('recordSearch').value.trim();
    const records=window.NEXUSTiltStore.listCompletedTests().filter(x=>recordMatches(x,q));
    $('completedStatus').textContent=records.length?`${records.length} completed ARC test record(s) available locally.`:'No matching completed tests saved on this browser.';
    $('completedTests').innerHTML=records.map(x=>`<div class="record"><div><strong>${esc(x.equipmentId||'ARC Test')}</strong><div class="muted">${esc(x.projectName||'')} · ${new Date(x.completedAt).toLocaleString()} · ${esc(x.tester?.name||'')}</div></div><div class="row"><button class="primary view-record" data-id="${esc(x.completedTestId)}">VIEW RECORD</button><button class="secondary download-record" data-id="${esc(x.completedTestId)}">DOWNLOAD FILE</button><button class="secondary email-record" data-id="${esc(x.completedTestId)}">EMAIL</button></div></div>`).join('');
    document.querySelectorAll('.view-record').forEach(b=>b.onclick=()=>showRecord(b.dataset.id));
    document.querySelectorAll('.download-record').forEach(b=>b.onclick=()=>adapter.exportStandalone(b.dataset.id));
    document.querySelectorAll('.email-record').forEach(b=>b.onclick=()=>emailSavedRecord(b.dataset.id));
  }

  function emailSavedRecord(id){
    const x=window.NEXUSTiltStore.getCompletedTest(id);if(!x)return;
    const snap={plan:x.testPlan,records:x.readings,startedAt:x.startedAt,completedAt:x.completedAt,testEnd:x.testEnd};
    const href=`mailto:?subject=${encodeURIComponent(emailSubject(snap))}&body=${encodeURIComponent(emailBody(snap))}`;
    window.location.href=href;
  }

  function completedMatrixHtml(x){
    const cells={};
    (x.readings||[]).forEach(r=>{const t=x.testPlan?.tests?.find(t=>t.id===r.testId)||{};cells[matrixKeyFor(t)||matrixKeyFor({label:r.testPoint})]=r;});
    const cell=k=>{
      const r=cells[k];if(!r)return '<td>—</td>';
      const m=matrixState(r.reading);
      return `<td class="${m.cls}"><strong>${m.main}</strong><br>${esc(m.sub)}<br><small>${new Date(r.acceptedAt).toLocaleString()}</small></td>`;
    };
    return `<div class="tilt-matrix record-matrix"><table><thead><tr><th>Pre Torque Tilt Test</th><th>A-B</th><th>A-C</th><th>B-C</th></tr></thead><tbody><tr><td class="matrix-group">Phase to Phase</td>${cell('AB')}${cell('AC')}${cell('BC')}</tr></tbody></table><table><thead><tr><th></th><th>A-G</th><th>B-G</th><th>C-G</th></tr></thead><tbody><tr><td class="matrix-group">Phase to Ground</td>${cell('AG')}${cell('BG')}${cell('CG')}</tr></tbody></table><table><thead><tr><th></th><th>A-N</th><th>B-N</th><th>C-N</th></tr></thead><tbody><tr><td class="matrix-group">Phase to Neutral</td>${cell('AN')}${cell('BN')}${cell('CN')}</tr></tbody></table><table class="ng-table"><thead><tr><th></th><th>N-G</th></tr></thead><tbody><tr><td class="matrix-group">Neutral to Ground</td>${cell('NG')}</tr></tbody></table></div>`;
  }

  function showRecord(id){
    const x=window.NEXUSTiltStore.getCompletedTest(id);if(!x)return;
    const c=x.calibrationVerification||{},d=x.arcDevice||{};
    const box=$('recordDetail');box.hidden=false;
    box.innerHTML=`<div class="row record-actions"><button id="closeRecord" class="secondary">CLOSE</button><button id="downloadRecord" class="secondary">DOWNLOAD FILE</button><button id="emailRecord" class="secondary">EMAIL</button><button id="printRecord" class="primary">PRINT / SAVE PDF</button></div><div class="arc-report"><div class="report-head"><img src="assets/arc-header.svg" alt="ARC Systems"><div><h1>Completed TILT Test Record</h1><p>Pre Torque Tilt Test</p></div><div class="report-status">${esc(x.finalStatus)}</div></div><div class="report-meta"><div><span>Project</span><strong>${esc(x.projectName)}</strong></div><div><span>Equipment ID</span><strong>${esc(x.equipmentId)}</strong></div><div><span>Equipment Type</span><strong>${esc(x.equipmentType)}</strong></div><div><span>Tester</span><strong>${esc(x.tester?.name)}</strong></div><div><span>Calibration / Tool ID</span><strong>${esc(c.manualInformation||'Photo verification')}</strong></div><div><span>ARC Device</span><strong>${esc(d.deviceId||'Simulator / not recorded')}</strong></div><div><span>Started</span><strong>${new Date(x.startedAt).toLocaleString()}</strong></div><div><span>Completed</span><strong>${new Date(x.completedAt).toLocaleString()}</strong></div></div>${completedMatrixHtml(x)}${c.photoDataUrl?`<section class="report-photo"><h3>Calibration Sticker Photo</h3><img src="${c.photoDataUrl}" alt="Calibration sticker"></section>`:''}<div class="report-foot">Record ID: ${esc(x.completedTestId)} · ARC Systems</div></div>`;
    $('closeRecord').onclick=()=>box.hidden=true;
    $('downloadRecord').onclick=()=>adapter.exportStandalone(id);
    $('emailRecord').onclick=()=>emailSavedRecord(id);
    $('printRecord').onclick=()=>window.print();
    box.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function updateFooterTester(){$('footerUser').textContent=$('testerName').value.trim()||'—';}

  function updateNetwork(){
    $('networkStatus').textContent=navigator.onLine?'ARC READY · ONLINE · records remain local-first.':'ARC READY · OFFLINE · testing and local records remain available.';
  }

  function updateClock(){$('footerTime').textContent=new Date().toLocaleString();}

  function loadPendingCompletion(){
    try{
      const raw=localStorage.getItem(PENDING_COMPLETE_KEY);if(!raw)return;
      const x=JSON.parse(raw);if(!x?.runId||!x?.plan)return;
      pendingCompletion=x;loadPlanIntoForm(x.plan);
      renderState({status:'COMPLETE',plan:x.plan,currentIndex:x.plan.tests?.length||0,currentTest:null,accepted:x.records||[],audit:x.audit||[],testEnd:x.testEnd});
      showCompletionModal();
    }catch(e){console.error('Pending ARC completion could not be restored',e);}
  }

  addEventListener('arc-resume-run',e=>{
    const s=e.detail;loadPlanIntoForm(s.plan);engine.restore(s);if(engine.status==='PAUSED')engine.resume({technicianName:s.plan?.testerName||'POC User'});$('runCard').scrollIntoView({behavior:'smooth'});
  });
  addEventListener('arc-abandon-run',e=>{
    const s=e.detail.snapshot;loadPlanIntoForm(s.plan);engine.restore(s);engine.endTest({reason:e.detail.reason,technicianName:s.plan?.testerName||'POC User'});
  });

  $('calPhoto').addEventListener('change',e=>readPhoto(e.target.files?.[0]));
  ['planName','projectName','equipmentName','equipmentType','testerName','specialNotes','calManual'].forEach(id=>$(id).addEventListener('input',()=>{if(id==='testerName')updateFooterTester();renderDraftPreview();}));
  $('loadStandard').onclick=()=>{if(active())return;editingPlanId='';planType='STANDARD';draftTests=window.NEXUSTiltTemplates.cloneTests('STANDARD');$('planName').value='Standard Pre-Torque TILT Test';$('planType').textContent='STANDARD';renderDraft();renderDraftPreview();};
  $('addTest').onclick=()=>{if(active())return;planType='CUSTOM';draftTests.push({id:`CUSTOM_${Date.now()}`,matrixKey:'',label:'New test point',group:'Custom',expected:'TRANSFORMER_OK'});$('planType').textContent='CUSTOM';renderDraft();renderDraftPreview();};
  $('savePlan').onclick=savePlan;
  $('loadSavedPlan').onclick=()=>{if(active())return;const p=window.NEXUSTiltStore.getPlan($('savedPlans').value);if(!p)return alert('No saved plan selected.');loadPlanIntoForm(p);};
  $('duplicatePlan').onclick=async()=>{if(active())return;const p=window.NEXUSTiltStore.getPlan($('savedPlans').value);if(!p)return alert('No saved plan selected.');const c=clone(p);c.planId=`PLAN-${Date.now()}`;c.name=`${c.name} — Copy`;c.version=1;c.sourcePlanId=p.planId;window.NEXUSTiltStore.savePlan(c);await window.NEXUSTiltDB?.savePlan(c);refreshSavedPlans(c.planId);};
  $('startTest').onclick=startTest;
  $('acceptResult').onclick=()=>engine.accept({technicianName:engine.plan?.testerName||'POC User'});
  $('rejectResult').onclick=()=>engine.reject();
  $('pauseTest').onclick=()=>engine.pause({reason:prompt('Pause note (optional):')||'',technicianName:engine.plan?.testerName||'POC User'});
  $('resumeTest').onclick=()=>engine.resume({technicianName:engine.plan?.testerName||'POC User'});
  $('endTest').onclick=()=>{$('endTestPanel').hidden=false;};
  $('cancelEndTest').onclick=()=>{$('endTestPanel').hidden=true;};
  $('confirmEndTest').onclick=()=>{const reason=$('endTestReason').value.trim();if(!reason)return alert('Enter a reason.');$('endTestPanel').hidden=true;engine.endTest({reason,technicianName:engine.plan?.testerName||'POC User'});};
  $('simOpen').onclick=()=>window.NEXUSTiltSimulator.emit(window.NEXUSTiltProtocol.CHANNELS.OPEN,e=>engine.receiveDeviceEvent(e));
  $('simShort').onclick=()=>window.NEXUSTiltSimulator.emit(window.NEXUSTiltProtocol.CHANNELS.SHORT,e=>engine.receiveDeviceEvent(e));
  $('simOk').onclick=()=>window.NEXUSTiltSimulator.emit(window.NEXUSTiltProtocol.CHANNELS.OK,e=>engine.receiveDeviceEvent(e));
  $('connectBle').onclick=()=>ble.connect().catch(()=>{});
  $('disconnectBle').onclick=()=>ble.disconnect();
  $('saveCompletedLocal').onclick=saveOnly;
  $('emailCompletedTest').onclick=completeEmailOnly;
  $('saveAndEmailCompleted').onclick=saveAndEmail;
  $('recordSearch').addEventListener('input',renderCompletedTests);
  addEventListener('online',updateNetwork);addEventListener('offline',updateNetwork);

  window.ARCApp={engine,ble,adapter,active,version:40};
  renderDraft();refreshSavedPlans();renderCompletedTests();renderState({status:'IDLE',plan:null,accepted:[],audit:[]});updateFooterTester();updateNetwork();updateClock();setInterval(updateClock,1000);loadPendingCompletion();
})();
