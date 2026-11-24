// Thin promise wrapper over IndexedDB. One object store per kind of data.
const NAME = "almanca-kartlar";
const VERSION = 1;

let dbPromise;

export function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("cards", { keyPath: "id" }).createIndex("deckId", "deckId");
      db.createObjectStore("decks", { keyPath: "id" });
      db.createObjectStore("cardState", { keyPath: "cardId" });
      db.createObjectStore("ink", { keyPath: "cardId" });
      db.createObjectStore("kv", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const wrap = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function store(name, mode = "readonly") {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

export const get = async (s, key) => wrap((await store(s)).get(key));
export const getAll = async (s) => wrap((await store(s)).getAll());
export const getByIndex = async (s, index, value) => wrap((await store(s).then((st) => st.index(index))).getAll(value));
export const getAllKeys = async (s) => wrap((await store(s)).getAllKeys());
export const put =async (s, value) => wrap((await store(s, "readwrite")).put(value));
export const del = async (s, key) => wrap((await store(s, "readwrite")).delete(key));
export const clear = async (s) => wrap((await store(s, "readwrite")).clear());

/** Replaces the whole content of the given stores in one transaction: { storeName: [records] }. */
export async function replaceStores(data) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(Object.keys(data), "readwrite");
    for (const [name, records] of Object.entries(data)) {
      const st = tx.objectStore(name);
      st.clear();
      records.forEach((r) => st.put(r));
    }
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

export async function putMany(s, values) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(s, "readwrite");
    const st = tx.objectStore(s);
    values.forEach((v) => st.put(v));
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}
