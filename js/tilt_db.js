/* Durable offline-first storage for TILT field testing. */
window.NEXUSTiltDB = (() => {
  const DB_NAME = 'nexus_tilt_field_db';
  const DB_VERSION = 1;
  const STORES = ['plans', 'records', 'completedTests', 'runs', 'syncQueue'];
  let dbPromise;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        STORES.forEach(name => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let request;
      try { request = action(store); } catch (error) { reject(error); return; }
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error || request?.error);
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
    });
  }

  const put = (store, id, value) => tx(store, 'readwrite', s => s.put({ id, value, updatedAt: new Date().toISOString() }));
  const remove = (store, id) => tx(store, 'readwrite', s => s.delete(id));
  async function get(store, id) { const row = await tx(store, 'readonly', s => s.get(id)); return row?.value ?? null; }
  async function all(store) { const rows = await tx(store, 'readonly', s => s.getAll()); return (rows || []).map(r => r.value); }

  return {
    open,
    savePlan: plan => put('plans', plan.planId, plan),
    listPlans: () => all('plans'),
    getPlan: id => get('plans', id),
    saveRecord: record => put('records', record.recordId, record),
    listRecords: () => all('records'),
    saveCompletedTest: test => put('completedTests', test.completedTestId, test),
    listCompletedTests: () => all('completedTests'),
    getCompletedTest: id => get('completedTests', id),
    saveRun: run => put('runs', run.runId, run),
    getRun: id => get('runs', id),
    removeRun: id => remove('runs', id),
    async getActiveRun() {
      const runs = await all('runs');
      return runs.filter(r => r && r.status !== 'COMPLETE').sort((a,b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || null;
    },
    queueSync(item) {
      const entry = { ...item, syncState: 'PENDING', queuedAt: item.queuedAt || new Date().toISOString(), attempts: item.attempts || 0 };
      return put('syncQueue', entry.syncId || entry.completedTestId, entry);
    },
    listSyncQueue: () => all('syncQueue'),
    removeSync: id => remove('syncQueue', id),
    async markSyncAttempt(id, errorMessage = '') {
      const item = await get('syncQueue', id);
      if (!item) return null;
      item.attempts = (item.attempts || 0) + 1;
      item.lastAttemptAt = new Date().toISOString();
      item.lastError = errorMessage;
      await put('syncQueue', id, item);
      return item;
    }
  };
})();
