/* ARC open-test hotfix v24 */
(()=>{
  const $=id=>document.getElementById(id);
  const btn=$('startTest');
  if(!btn||!window.ARCApp?.engine)return;

  function visiblePlan(){
    const tests=[...document.querySelectorAll('#planTests .test-row input')]
      .map((input,i)=>({
        id:`T${i+1}`,
        order:i+1,
        label:String(input.value||'').trim(),
        group:'TILT Test',
        expected:'TRANSFORMER_OK'
      }))
      .filter(t=>t.label);

    const manual=$('calManual')?.value.trim()||'';
    const photoAttached=($('calPhotoStatus')?.textContent||'').toLowerCase().includes('attached');

    return {
      format:'ARC-TILT-PLAN-3',
      planId:`DRAFT-${Date.now()}`,
      name:$('planName')?.value.trim()||'Standard TILT Test',
      projectName:$('projectName')?.value.trim()||'',
      projectId:'',
      equipmentId:$('equipmentName')?.value.trim()||'',
      equipmentName:$('equipmentName')?.value.trim()||'',
      equipmentType:$('equipmentType')?.value.trim()||'',
      specialNotes:$('specialNotes')?.value.trim()||'',
      calibrationVerification:{
        method:manual&&photoAttached?'MANUAL_AND_PHOTO':photoAttached?'PHOTO':manual?'MANUAL':'NONE',
        manualInformation:manual,
        photoDataUrl:photoAttached?'ATTACHED_IN_UI':'',
        capturedAt:photoAttached?new Date().toISOString():''
      },
      templateId:'STANDARD',
      planType:'CURRENT_SCREEN',
      version:0,
      createdAt:new Date().toISOString(),
      tests
    };
  }

  btn.disabled=false;
  btn.onclick=()=>{
    const status=$('runStatus');
    try{
      if(window.ARCApp.active()){
        if(status)status.textContent='A test is already active. Resume, complete, or end it first.';
        return;
      }

      const p=visiblePlan();
      const missing=[];
      if(!$('technicianName')?.value.trim())missing.push('Tester Name');
      if(!p.projectName)missing.push('Project Name');
      if(!p.equipmentId)missing.push('Equipment ID');
      if(!p.equipmentType)missing.push('Equipment Type');
      if(!p.tests.length)missing.push('Test Plan');
      if(p.calibrationVerification.method==='NONE')missing.push('Calibration Verification');

      if(missing.length){
        if(status){
          status.className='status warn';
          status.textContent='Missing: '+missing.join(', ');
        }
        return;
      }

      window.ARCApp.engine.loadPlan(p);
      window.ARCApp.engine.start();
      if(status){
        status.className='status good';
        status.textContent='TEST OPEN — perform the displayed test point.';
      }
      document.querySelector('.run-card')?.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(err){
      console.error('ARC OPEN TEST failed',err);
      if(status){
        status.className='status bad';
        status.textContent='OPEN TEST ERROR: '+(err?.message||String(err));
      }
    }
  };
})();