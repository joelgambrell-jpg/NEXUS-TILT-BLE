window.NEXUSTiltStore = {
  KEYS: {
    plans: 'nexus_tilt_plans_v1',
    records: 'nexus_tilt_records_v1'
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
  listRecords() { return this._read(this.KEYS.records); }
};
