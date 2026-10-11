/**
 * Web (verification build only): sql.js with the database bytes persisted in IndexedDB.
 */
import initSqlJs from 'sql.js';
import { createSqlJsDriver, type SqlJsPersistence } from './sqljs';
import type { SqlDriver } from './driver';

const DB_NAME = 'serie';
const STORE = 'sqlite';
const KEY = 'db';

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const persistence: SqlJsPersistence = {
  async load() {
    try {
      const db = await idb();
      return await new Promise<Uint8Array | null>((resolve, reject) => {
        const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
        r.onsuccess = () => resolve(r.result ? new Uint8Array(r.result as ArrayBuffer) : null);
        r.onerror = () => reject(r.error);
      });
    } catch {
      return null;
    }
  },
  async save(bytes) {
    const db = await idb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

export async function openDriver(): Promise<SqlDriver> {
  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
  const initial = await persistence.load();
  return createSqlJsDriver(SQL, initial, persistence);
}
