/*
 * Network sync coordinator.
 * A test is ALWAYS valid locally first. Remote sync is optional and retryable.
 * Configure a sender later with setSender(async item => ({ acknowledged: true })).
 */
window.NEXUSTiltSync = (() => {
  let sender = null;
  let running = false;
  const listeners = new Set();

  function notify(detail) { listeners.forEach(fn => { try { fn(detail); } catch {} }); }
  function setSender(fn) { sender = typeof fn === 'function' ? fn : null; }
  function onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  async function enqueueCompleted(test, destination = 'STANDALONE_CLOUD') {
    const syncId = test.completedTestId;
    await window.NEXUSTiltDB.queueSync({ syncId, completedTestId: test.completedTestId, destination, record: test });
    notify({ state: 'PENDING', syncId });
    if (navigator.onLine) processQueue();
    return syncId;
  }

  async function processQueue() {
    if (running || !navigator.onLine || !sender) return;
    running = true;
    try {
      const queue = await window.NEXUSTiltDB.listSyncQueue();
      for (const item of queue) {
        try {
          const response = await sender(item);
          if (!response || response.acknowledged !== true) throw new Error('Remote service did not acknowledge persistence');
          await window.NEXUSTiltDB.removeSync(item.syncId);
          notify({ state: 'SYNCED', syncId: item.syncId, acknowledgedAt: new Date().toISOString() });
        } catch (error) {
          await window.NEXUSTiltDB.markSyncAttempt(item.syncId, error?.message || 'Sync failed');
          notify({ state: 'PENDING', syncId: item.syncId, error: error?.message || 'Sync failed' });
        }
      }
    } finally { running = false; }
  }

  window.addEventListener('online', () => processQueue());
  return { setSender, onStatus, enqueueCompleted, processQueue };
})();
