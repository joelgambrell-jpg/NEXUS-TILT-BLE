/*
 * ARC completed-record adapter.
 * ARC records observed readings and tester actions. It does not assign PASS/FAIL conclusions.
 */
window.NEXUSTiltRecordAdapter = class {
  constructor({ store, onStatus } = {}) {
    this.store = store || window.NEXUSTiltStore;
    this.onStatus = onStatus || (() => {});
    this.mode = 'STANDALONE';
  }

  setMode(mode) {
    this.mode = mode === 'NEXUS' ? 'NEXUS' : 'STANDALONE';
    return this.mode;
  }

  buildCompletedTest(summary, context = {}) {
    const completedAt = summary.completedAt || new Date().toISOString();
    const plan = summary.plan || {};
    const records = Array.isArray(summary.records) ? summary.records : [];
    const testEnd = summary.testEnd || {
      type: 'SEQUENCE_COMPLETE',
      endedByTester: false,
      reason: '',
      endedAt: completedAt,
      endedBy: context.technicianName || records[0]?.technicianName || ''
    };

    return {
      format: 'ARC-TILT-COMPLETED-1',
      recordType: 'ARC_TILT_TEST_RECORD',
      completedTestId: `ARC-COMPLETE-${Date.now()}`,
      mode: this.mode,
      runId: summary.runId || '',
      planId: plan.planId || '',
      planName: plan.name || 'TILT Test',
      planType: plan.planType || 'CUSTOM',
      projectId: plan.projectId || context.projectId || '',
      equipmentId: plan.equipmentId || context.equipmentId || '',
      equipmentName: plan.equipmentName || context.equipmentName || '',
      technicianName: context.technicianName || records[0]?.technicianName || testEnd.endedBy || '',
      startedAt: summary.startedAt || context.startedAt || '',
      completedAt,
      acceptedReadingCount: records.length,
      plannedReadingCount: plan.tests?.length || records.length,
      testEnd: structuredClone(testEnd),
      testPlan: structuredClone(plan),
      readings: records.map(record => structuredClone(record)),
      integration: {
        destination: this.mode === 'NEXUS' ? 'NEXUS' : 'STANDALONE',
        state: this.mode === 'NEXUS' ? 'READY_FOR_HOST' : 'LOCAL',
        deliveredAt: null
      }
    };
  }

  async finalize(summary, context = {}) {
    const completed = this.buildCompletedTest(summary, context);
    this.store.saveCompletedTest(completed);
    if (window.NEXUSTiltDB) await window.NEXUSTiltDB.saveCompletedTest(completed);

    if (this.mode === 'STANDALONE') {
      this.onStatus({ state: 'LOCAL', message: 'ARC test record saved locally.', completed });
      return completed;
    }

    return this._deliverCompletedRecordToNexus(completed);
  }

  async _deliverCompletedRecordToNexus(completed) {
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
      completed.integration.state = 'DELIVERED_TO_HOST';
      completed.integration.deliveredAt = new Date().toISOString();
      this.store.saveCompletedTest(completed);
      if (window.NEXUSTiltDB) await window.NEXUSTiltDB.saveCompletedTest(completed);
      this.onStatus({ state: 'DELIVERED', message: 'ARC test record delivered to NEXUS.', completed });
    } else {
      completed.integration.state = 'HOST_UNAVAILABLE';
      this.store.saveCompletedTest(completed);
      if (window.NEXUSTiltDB) await window.NEXUSTiltDB.saveCompletedTest(completed);
      this.onStatus({ state: 'HOST_UNAVAILABLE', message: 'ARC test record is safely stored locally.', completed });
    }
    return completed;
  }

  exportStandalone(completedTestId) {
    const completed = this.store.getCompletedTest(completedTestId);
    if (!completed) throw new Error('Completed ARC test not found.');
    const safeName = (completed.equipmentName || completed.planName || 'ARC-Test')
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'ARC-Test';
    const blob = new Blob([JSON.stringify(completed, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}-${completed.completedTestId}.arc.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};
