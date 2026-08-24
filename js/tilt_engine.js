window.NEXUSTiltEngine = class {
  constructor({ onStateChange, onCandidate, onAccepted, onComplete } = {}) {
    this.onStateChange = onStateChange || (() => {});
    this.onCandidate = onCandidate || (() => {});
    this.onAccepted = onAccepted || (() => {});
    this.onComplete = onComplete || (() => {});
    this.reset();
  }
  reset() { this.runId=''; this.startedAt=''; this.plan=null; this.currentIndex=0; this.accepted=[]; this.candidate=null; this.status='IDLE'; this._emit(); }
  loadPlan(plan) { this.runId=`RUN-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; this.startedAt=''; this.plan=structuredClone(plan); this.currentIndex=0; this.accepted=[]; this.candidate=null; this.status='READY'; this._emit(); }
  start() { if (!this.plan || !this.plan.tests?.length) throw new Error('No TILT plan loaded'); this.startedAt=this.startedAt || new Date().toISOString(); this.status='WAITING'; this._emit(); }
  restore(snapshot) {
    if (!snapshot?.plan || !snapshot.runId) throw new Error('Invalid saved TILT run');
    this.runId=snapshot.runId; this.startedAt=snapshot.startedAt || ''; this.plan=structuredClone(snapshot.plan);
    this.currentIndex=Number(snapshot.currentIndex)||0; this.accepted=structuredClone(snapshot.accepted||[]);
    this.candidate=snapshot.candidate ? structuredClone(snapshot.candidate) : null;
    this.status=snapshot.status === 'REVIEW' && this.candidate ? 'REVIEW' : 'WAITING';
    if (this.candidate) this.onCandidate(this.candidate); this._emit();
  }
  snapshot() { return { runId:this.runId, startedAt:this.startedAt, updatedAt:new Date().toISOString(), status:this.status, plan:structuredClone(this.plan), currentIndex:this.currentIndex, accepted:structuredClone(this.accepted), candidate:this.candidate?structuredClone(this.candidate):null }; }
  receiveDeviceEvent(evt) {
    if (this.status !== 'WAITING') return { accepted:false, reason:'NOT_WAITING' };
    if (!window.NEXUSTiltProtocol.validateEvent(evt)) return { accepted:false, reason:'INVALID_EVENT' };
    const test=this.plan.tests[this.currentIndex];
    this.candidate={ test, deviceEvent:{...evt}, expectedIndication:test.expected, observedIndication:evt.channel, comparison:evt.channel===test.expected?'MATCH':'MISMATCH', detectedAt:evt.detectedAt||new Date().toISOString() };
    this.status='REVIEW'; this.onCandidate(this.candidate); this._emit(); return { accepted:true };
  }
  retest() { if(this.status!=='REVIEW') return; this.candidate=null; this.status='WAITING'; this._emit(); }
  accept({ technicianName='POC User' }={}) {
    if(this.status!=='REVIEW'||!this.candidate) return null; const c=this.candidate;
    const record={ recordType:'TILT_TEST', recordVersion:1, recordId:`TILT-${Date.now()}-${String(this.currentIndex+1).padStart(2,'0')}`, runId:this.runId, planId:this.plan.planId, planName:this.plan.name, projectId:this.plan.projectId||'', equipmentId:this.plan.equipmentId||'', equipmentName:this.plan.equipmentName||'', testId:c.test.id, group:c.test.group||'', order:this.currentIndex+1, testPoint:c.test.label, expectedIndication:c.expectedIndication, observedIndication:c.observedIndication, result:c.comparison==='MATCH'?'PASS':'REVIEW', deviceId:c.deviceEvent.deviceId, firmwareVersion:c.deviceEvent.firmwareVersion, cadenceValid:c.deviceEvent.cadenceValid, measuredCadenceHz:c.deviceEvent.measuredCadenceHz, pulseCount:c.deviceEvent.pulseCount, durationMs:c.deviceEvent.durationMs, signalConfidence:c.deviceEvent.signalConfidence, batteryPct:c.deviceEvent.batteryPct, detectedAt:c.detectedAt, acceptedAt:new Date().toISOString(), technicianName, source:c.deviceEvent.source||'BLE', status:'ACCEPTED' };
    this.accepted.push(record); this.onAccepted(record); this.currentIndex+=1; this.candidate=null;
    if(this.currentIndex>=this.plan.tests.length){ this.status='COMPLETE'; this.onComplete({runId:this.runId,startedAt:this.startedAt,plan:this.plan,records:[...this.accepted],completedAt:new Date().toISOString()}); } else this.status='WAITING';
    this._emit(); return record;
  }
  get currentTest(){ return this.plan?.tests?.[this.currentIndex]||null; }
  _emit(){ this.onStateChange({runId:this.runId,startedAt:this.startedAt,status:this.status,plan:this.plan,currentIndex:this.currentIndex,currentTest:this.currentTest,accepted:[...this.accepted],candidate:this.candidate}); }
};
