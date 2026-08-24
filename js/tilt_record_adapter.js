/*
 * TILT completed-record adapter.
 *
 * IMPORTANT ARCHITECTURE BOUNDARY:
 * The TILT application owns ALL testing behavior. NEXUS does not run the test
 * engine, interpret BLE indications, decide cadence validity, or build results.
 *
 * Future NEXUS responsibilities are intentionally limited to:
 *   1. Launch/open this TILT application and optionally provide context.
 *   2. Receive the FINAL completed-test record from this application.
 *   3. Persist/display that completed record inside NEXUS.
 *
 * Standalone mode is the primary POC path and must remain fully functional
 * without NEXUS, Firebase, project IDs, equipment IDs, or NEXUS authentication.
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

    return {
      format: 'NEXUS-TILT-COMPLETED-1',
      recordType: 'TILT_COMPLETED_TEST',
      completedTestId: `TILT-COMPLETE-${Date.now()}`,
      mode: this.mode,
      planId: plan.planId || '',
      planName: plan.name || 'TILT Test',
      planType: plan.planType || 'CUSTOM',

      // Optional host context. These fields are not required by standalone use.
      // If NEXUS launches the app later, it may pre-populate them so the final
      // record can be associated with the correct NEXUS equipment record.
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

      // Preserve the exact plan and accepted evidence used during execution.
      // NEXUS should DISPLAY/SAVE this record; it should not reconstruct it.
      testPlan: structuredClone(plan),
      tests: records.map(record => structuredClone(record)),

      integration: {
        destination: this.mode === 'NEXUS' ? 'NEXUS' : 'STANDALONE',
        state: this.mode === 'NEXUS' ? 'READY_FOR_HOST' : 'LOCAL',
        deliveredAt: null
      }
    };
  }

  async finalize(summary, context = {}) {
    const completed = this.buildCompletedTest(summary, context);

    // The TILT application always saves its own finalized record first.
    // Host delivery is secondary and must never be required to complete a test.
    this.store.saveCompletedTest(completed);

    if (this.mode === 'STANDALONE') {
      this.onStatus({
        state: 'LOCAL',
        message: 'Completed test saved locally and ready to view or export.',
        completed
      });
      return completed;
    }

    return this._deliverCompletedRecordToNexus(completed);
  }

  async _deliverCompletedRecordToNexus(completed) {
    let delivered = false;

    try {
      // Future embedded/web-shell integration point. NEXUS only receives the
      // completed record. It is not expected to reach into TILT runtime state.
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'NEXUS_TILT_TEST_COMPLETE',
          protocol: 'NEXUS-TILT-HOST-1',
          payload: completed
        }, '*');
        delivered = true;
      }

      // Same-page/native-wrapper integration point. An iPad host bridge can
      // listen for this event and forward the identical completed object.
      window.dispatchEvent(new CustomEvent('nexus-tilt-test-complete', {
        detail: completed
      }));
    } catch (error) {
      delivered = false;
    }

    if (delivered) {
      completed.integration.state = 'DELIVERED_TO_HOST';
      completed.integration.deliveredAt = new Date().toISOString();
      this.store.saveCompletedTest(completed);
      this.onStatus({
        state: 'DELIVERED',
        message: 'Completed test delivered to NEXUS for saving and display.',
        completed
      });
    } else {
      // The completed TILT record remains valid and safely stored locally.
      // Future NEXUS integration may implement acknowledgement/retry without
      // changing the standalone test engine or completed-record schema.
      completed.integration.state = 'HOST_UNAVAILABLE';
      this.store.saveCompletedTest(completed);
      this.onStatus({
        state: 'HOST_UNAVAILABLE',
        message: 'Test is complete and stored locally. NEXUS host is unavailable.',
        completed
      });
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
