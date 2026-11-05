/**
 * The user's data lives on this device in IndexedDB (much roomier than localStorage), one record per
 * Google account. Falls back to localStorage if IndexedDB is unavailable (some private windows).
 */
const DB = 'recundle';
const STORE = 'data';
let dbPromise = null;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

const key = (email) => `data:${email}`;

export async function loadData(email) {
  try {
    return (await tx('readonly', (s) => s.get(key(email)))) ?? null;
  } catch {
    try {
      return JSON.parse(localStorage.getItem(`recundle.${key(email)}`) ?? 'null');
    } catch {
      return null;
    }
  }
}

export async function saveData(email, data) {
  try {
    await tx('readwrite', (s) => s.put(data, key(email)));
  } catch {
    localStorage.setItem(`recundle.${key(email)}`, JSON.stringify(data));
  }
}

export async function deleteData(email) {
  try {
    await tx('readwrite', (s) => s.delete(key(email)));
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(`recundle.${key(email)}`);
  } catch {
    /* ignore */
  }
}
