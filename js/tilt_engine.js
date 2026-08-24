window.NEXUSTiltEngine = class {
  constructor({ onStateChange, onCandidate, onAccepted, onComplete } = {}) {
    this.onStateChange = onStateChange || (() => {});
    this.onCandidate = onCandidate || (() => {});
    this.onAccepted = onAccepted || (() => {});
    this.onComplete = onComplete || (() => {});
    this.reset();
  }
  reset() {
    this.plan = null;
    this.currentIndex = 0;
    this.accepted = [];
    this.candidate = null;
    this.status = 'IDLE';
    this._emit();
  }
  loadPlan(plan) {
    this.plan = structuredClone(plan);
    this.currentIndex = 0;
    this.accepted = [];
    this.candidate = null;
    this.status = 'READY';
    this._emit();
  }
  start() {
    if (!this.plan || !this.plan.tests?.length) throw new Error('No TILT plan loaded');
    this.status = 'WAITING';
    this._emit();
  }
  receiveDeviceEvent(evt) {
    if (this.status !== 'WAITING') return { accepted: false, reason: 'NOT_WAITING' };
    if (!window.NEXUSTiltProtocol.validateEvent(evt)) return { accepted: false, reason: 'INVALID_EVENT' };
    const test = this.plan.tests[this.currentIndex];
    this.candidate = {
      test,
      deviceEvent: { ...evt },
      expectedIndication: test.expected,
      observedIndication: evt.channel,
      comparison: evt.channel === test.expected ? 'MATCH' : 'MISMATCH',
      detectedAt: evt.detectedAt || new Date().toISOString()
    };
    this.status = 'REVIEW';
    this.onCandidate(this.candidate);
    this._emit();
    return { accepted: true };
  }
  retest() {
    if (this.status !== 'REVIEW') return;
    this.candidate = null;
    this.status = 'WAITING';
    this._emit();
  }
  accept({ technicianName = 'POC User' } = {}) {
    if (this.status !== 'REVIEW' || !this.candidate) return null;
    const c = this.candidate;
    const record = {
      recordType: 'TILT_TEST',
      recordVersion: 1,
      recordId: `TILT-${Date.now()}-${String(this.currentIndex + 1).padStart(2, '0')}`,
      planId: this.plan.planId,
      planName: this.plan.name,
      projectId: this.plan.projectId || '',
      equipmentId: this.plan.equipmentId || '',
      equipmentName: this.plan.equipmentName || '',
      scope: this.plan.scope,
      testId: c.test.id,
      testPoint: c.test.label,
      expectedIndication: c.expectedIndication,
      observedIndication: c.observedIndication,
      result: c.comparison === 'MATCH' ? 'PASS' : 'REVIEW',
      deviceId: c.deviceEvent.deviceId,
      firmwareVersion: c.deviceEvent.firmwareVersion,
      cadenceValid: c.deviceEvent.cadenceValid,
      measuredCadenceHz: c.deviceEvent.measuredCadenceHz,
      pulseCount: c.deviceEvent.pulseCount,
      durationMs: c.deviceEvent.durationMs,
      signalConfidence: c.deviceEvent.signalConfidence,
      batteryPct: c.deviceEvent.batteryPct,
      detectedAt: c.detectedAt,
      acceptedAt: new Date().toISOString(),
      technicianName,
      source: c.deviceEvent.source || 'BLE',
      status: 'ACCEPTED'
    };
    this.accepted.push(record);
    this.onAccepted(record);
    this.currentIndex += 1;
    this.candidate = null;
    if (this.currentIndex >= this.plan.tests.length) {
      this.status = 'COMPLETE';
      this.onComplete({ plan: this.plan, records: [...this.accepted], completedAt: new Date().toISOString() });
    } else {
      this.status = 'WAITING';
    }
    this._emit();
    return record;
  }
  get currentTest() {
    return this.plan?.tests?.[this.currentIndex] || null;
  }
  _emit() {
    this.onStateChange({
      status: this.status,
      plan: this.plan,
      currentIndex: this.currentIndex,
      currentTest: this.currentTest,
      accepted: [...this.accepted],
      candidate: this.candidate
    });
  }
};
