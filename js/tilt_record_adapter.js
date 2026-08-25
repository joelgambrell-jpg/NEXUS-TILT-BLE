/* ARC Completed Test Record v3. Customer-facing readings remain clean; full audit stays internal. */
window.NEXUSTiltRecordAdapter=class{
  constructor({store,onStatus}={}){this.store=store||window.NEXUSTiltStore;this.onStatus=onStatus||(()=>{});this.mode='STANDALONE'}
  setMode(m){this.mode=m==='NEXUS'?'NEXUS':'STANDALONE';return this.mode}
  buildCompletedTest(s,c={}){
    const at=s.completedAt||new Date().toISOString(),p=s.plan||{},r=Array.isArray(s.records)?s.records:[],end=s.testEnd||{};
    return{
      format:'ARC-COMPLETED-TEST-3',recordType:'ARC_COMPLETED_TEST',recordVersion:3,
      completedTestId:`ARC-COMPLETE-${Date.now()}`,
      mode:this.mode,runId:s.runId||'',
      plan:{id:p.planId||'',name:p.name||'TILT Test',version:p.version||1,type:p.planType||'CUSTOM',templateId:p.templateId||'STANDARD',matrixName:p.matrixName||'Pre Torque Tilt Test'},
      projectName:p.projectName||c.projectName||'',projectId:p.projectId||c.projectId||'',
      equipmentId:p.equipmentId||p.equipmentName||c.equipmentId||'',equipmentType:p.equipmentType||c.equipmentType||'',
      specialNotes:p.specialNotes||c.specialNotes||'',
      tester:{name:p.testerName||c.technicianName||r[0]?.technicianName||end.endedBy||''},
      calibrationVerification:structuredClone(p.calibrationVerification||c.calibrationVerification||{method:'NONE',manualInformation:'',photoDataUrl:'',photoName:'',capturedAt:''}),
      arcDevice:{deviceId:r.find(x=>x.deviceId)?.deviceId||'',firmwareVersion:r.find(x=>x.firmwareVersion)?.firmwareVersion||'',lastBatteryPct:r.filter(x=>x.batteryPct!=null).at(-1)?.batteryPct??null},
      startedAt:s.startedAt||c.startedAt||'',completedAt:at,
      localTimeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'',
      finalStatus:end.endedByTester?'ENDED':'COMPLETED',
      acceptedReadingCount:r.length,plannedReadingCount:p.tests?.length||r.length,
      sessions:structuredClone(s.sessions||[]),testEnd:structuredClone(end),testPlan:structuredClone(p),readings:r.map(x=>structuredClone(x)),internalAudit:structuredClone(s.audit||[]),
      integration:{destination:this.mode==='NEXUS'?'NEXUS':'LOCAL_ARC_RECORD',state:'LOCAL',syncState:'SAVED_LOCALLY',deliveredAt:null}
    }
  }
  async finalize(s,c={}){
    const x=this.buildCompletedTest(s,c);
    this.store.saveCompletedTest(x);
    if(window.NEXUSTiltDB)await window.NEXUSTiltDB.saveCompletedTest(x);
    if(this.mode==='STANDALONE'){
      this.onStatus({state:'LOCAL',message:'ARC test record saved locally.',completed:x});
      return x
    }
    return this._deliverCompletedRecordToNexus(x)
  }
  async _deliverCompletedRecordToNexus(x){
    let ok=false;
    try{
      if(window.parent&&window.parent!==window){window.parent.postMessage({type:'ARC_COMPLETED_TEST',protocol:'ARC-HOST-1',payload:x},'*');ok=true}
      window.dispatchEvent(new CustomEvent('arc-completed-test',{detail:x}))
    }catch(e){}
    x.integration.state=ok?'DELIVERED_TO_HOST':'HOST_UNAVAILABLE';x.integration.deliveredAt=ok?new Date().toISOString():null;
    this.store.saveCompletedTest(x);if(window.NEXUSTiltDB)await window.NEXUSTiltDB.saveCompletedTest(x);
    this.onStatus({state:ok?'DELIVERED':'HOST_UNAVAILABLE',message:ok?'ARC test record delivered to NEXUS.':'ARC test record is safely stored locally.',completed:x});
    return x
  }
  exportStandalone(id){
    const x=this.store.getCompletedTest(id);if(!x)throw Error('Completed ARC test not found.');
    const n=(x.equipmentId||x.plan?.name||'ARC-Test').replace(/[^a-z0-9-_]+/gi,'-');
    const b=new Blob([JSON.stringify(x,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');
    a.href=u;a.download=`${n}-${x.completedTestId}.arc.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)
  }
};
