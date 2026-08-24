window.NEXUSTiltStore = {
  KEYS: {
    plans: 'nexus_tilt_plans_v1',
    records: 'nexus_tilt_records_v1',
    completedTests: 'nexus_tilt_completed_tests_v1',
    pendingSync: 'nexus_tilt_pending_sync_v1'
  },
  _read(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
  },
  _write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  savePlan(plan) {
    const plans = this._read(this.KEYS.plans);
    const idx = plans.findIndex(p => p.planId === plan.planId);
    if (idx >= 0) plans[idx] = plan; else plans.unshift(plan);
    this._write(this.KEYS.plans, plans);
    return plan;
  },
  listPlans() { return this._read(this.KEYS.plans); },
  getPlan(planId) { return this.listPlans().find(p => p.planId === planId) || null; },
  saveRecord(record) {
    const records = this._read(this.KEYS.records);
    records.unshift(record);
    this._write(this.KEYS.records, records);
    return record;
  },
  listRecords() { return this._read(this.KEYS.records); },
  saveCompletedTest(completed) {
    const tests = this._read(this.KEYS.completedTests);
    const idx = tests.findIndex(t => t.completedTestId === completed.completedTestId);
    if (idx >= 0) tests[idx] = completed; else tests.unshift(completed);
    this._write(this.KEYS.completedTests, tests);
    return completed;
  },
  listCompletedTests() { return this._read(this.KEYS.completedTests); },
  getCompletedTest(completedTestId) {
    return this.listCompletedTests().find(t => t.completedTestId === completedTestId) || null;
  },
  queuePendingSync(completed) {
    const queue = this._read(this.KEYS.pendingSync);
    const idx = queue.findIndex(t => t.completedTestId === completed.completedTestId);
    if (idx >= 0) queue[idx] = completed; else queue.unshift(completed);
    this._write(this.KEYS.pendingSync, queue);
    return completed;
  },
  listPendingSync() { return this._read(this.KEYS.pendingSync); },
  removePendingSync(completedTestId) {
    const queue = this._read(this.KEYS.pendingSync).filter(t => t.completedTestId !== completedTestId);
    this._write(this.KEYS.pendingSync, queue);
  }
};
