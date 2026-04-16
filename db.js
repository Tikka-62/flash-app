// Flash DB - IndexedDB wrapper
const DB = (() => {
  const NAME = 'flash';
  const VER  = 1;
  const STORE = 'items';
  let _db = null;

  async function open() {
    if (_db) return _db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('tag',       'tag',       { unique: false });
        }
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function getAll() {
    await open();
    return new Promise((resolve, reject) => {
      const tx  = _db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).index('createdAt').getAll();
      req.onsuccess = () => resolve([...req.result].reverse());
      req.onerror   = () => reject(req.error);
    });
  }

  async function put(item) {
    await open();
    return new Promise((resolve, reject) => {
      const tx  = _db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).put(item);
      req.onsuccess = () => resolve(item);
      req.onerror   = () => reject(req.error);
    });
  }

  async function remove(id) {
    await open();
    return new Promise((resolve, reject) => {
      const tx  = _db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  return { open, getAll, put, remove };
})();
