window.NEXUSTiltRecordAdapter = class {
  constructor({ store, onStatus } = {}) {
    this.store = store || window.NEXUSTiltStore;
    this.onStatus = onStatus || (() => {});
    this.mode = 'NEXUS';
  }

  setMode(mode) {
    this.mode = mode === 'STANDALONE' ? 'STANDALONE' : 'NEXUS';
    return this.mode;
  }

  buildCompletedTest(summary, context = {}) {
    const completedAt = summary.completedAt || new Date().toISOString();
    const plan = summary.plan || {};
    const records = Array.isArray(summary.records) ? summary.records : [];

    return {
      format: 'NEXUS-TILT-COMPLETED-1',
      recordType: 'TILT_COMPLETED_TEST',
      completedTestId: `TILT-COMPLETE-${Date.now()}`,
      mode: this.mode,
      planId: plan.planId || '',
      planName: plan.name || 'TILT Test',
      planType: plan.planType || 'CUSTOM',
      projectId: plan.projectId || context.projectId || '',
      equipmentId: plan.equipmentId || context.equipmentId || '',
      equipmentName: plan.equipmentName || context.equipmentName || '',
      technicianName: context.technicianName || records[0]?.technicianName || '',
      startedAt: context.startedAt || '',
      completedAt,
      status: 'COMPLETE',
      result: records.every(record => record.result === 'PASS') ? 'PASS' : 'REVIEW',
      requiredTestCount: plan.tests?.length || records.length,
      acceptedTestCount: records.length,
      testPlan: structuredClone(plan),
      tests: records.map(record => structuredClone(record)),
      sync: {
        state: this.mode === 'NEXUS' ? 'PENDING' : 'LOCAL',
        lastAttemptAt: null,
        syncedAt: null
      }
    };
  }

  async finalize(summary, context = {}) {
    const completed = this.buildCompletedTest(summary, context);
    this.store.saveCompletedTest(completed);

    if (this.mode === 'STANDALONE') {
      this.onStatus({ state: 'LOCAL', message: 'Completed test saved locally and ready to view or export.', completed });
      return completed;
    }

    return this._sendToNexus(completed);
  }

  async _sendToNexus(completed) {
    completed.sync.lastAttemptAt = new Date().toISOString();

    let delivered = false;

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'NEXUS_TILT_TEST_COMPLETE',
          protocol: 'NEXUS-TILT-HOST-1',
          payload: completed
        }, '*');
        delivered = true;
      }

      window.dispatchEvent(new CustomEvent('nexus-tilt-test-complete', { detail: completed }));
    } catch (error) {
      delivered = false;
    }

    if (delivered) {
      completed.sync.state = 'DELIVERED_TO_NEXUS_HOST';
      completed.sync.syncedAt = new Date().toISOString();
      this.store.saveCompletedTest(completed);
      this.store.removePendingSync(completed.completedTestId);
      this.onStatus({ state: 'DELIVERED', message: 'Completed test delivered to the NEXUS host for real-time save.', completed });
    } else {
      completed.sync.state = 'PENDING_SYNC';
      this.store.saveCompletedTest(completed);
      this.store.queuePendingSync(completed);
      this.onStatus({ state: 'PENDING', message: 'Test is complete and safely stored locally. NEXUS sync is pending.', completed });
    }

    return completed;
  }

  exportStandalone(completedTestId) {
    const completed = this.store.getCompletedTest(completedTestId);
    if (!completed) throw new Error('Completed TILT test not found.');

    const safeName = (completed.equipmentName || completed.planName || 'TILT-Test')
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'TILT-Test';

    const blob = new Blob([JSON.stringify(completed, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}-${completed.completedTestId}.tilt.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};
