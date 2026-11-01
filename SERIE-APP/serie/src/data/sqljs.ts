/**
 * sql.js driver: real SQLite compiled to WASM. Used by Jest and by the web build.
 * On web the database bytes are persisted to IndexedDB after each write.
 */
import type { Database, SqlJsStatic } from 'sql.js';
import { Mutex, type RunResult, type SqlDriver, type SqlExecutor, type SqlParam } from './driver';

export interface SqlJsPersistence {
  load(): Promise<Uint8Array | null>;
  save(bytes: Uint8Array): Promise<void>;
}

export function createSqlJsDriver(SQL: SqlJsStatic, initial: Uint8Array | null, persistence?: SqlJsPersistence): SqlDriver {
  const db: Database = initial ? new SQL.Database(initial) : new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON;');
  const mutex = new Mutex();
  let dirty = false;
  let saving: Promise<void> | null = null;

  const flush = async () => {
    if (!persistence || !dirty) return;
    dirty = false;
    const bytes = db.export();
    // db.export() resets pragmas on some builds; re-assert FK enforcement.
    db.exec('PRAGMA foreign_keys = ON;');
    await persistence.save(bytes);
  };
  const scheduleFlush = () => {
    dirty = true;
    if (!saving) saving = Promise.resolve().then(flush).finally(() => (saving = null));
    return saving;
  };

  const runRaw = (sql: string, params: SqlParam[] = []): RunResult => {
    db.run(sql, params as never);
    const changes = db.getRowsModified();
    const row = db.exec('SELECT last_insert_rowid() AS id');
    const id = row.length ? Number(row[0].values[0][0]) : 0;
    return { changes, lastInsertRowId: id };
  };
  const allRaw = <T>(sql: string, params: SqlParam[] = []): T[] => {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params as never);
      const out: T[] = [];
      while (stmt.step()) out.push(stmt.getAsObject() as T);
      return out;
    } finally {
      stmt.free();
    }
  };

  const exec: SqlExecutor = {
    exec: async (sql) => {
      db.exec(sql);
    },
    run: async (sql, params) => runRaw(sql, params),
    all: async <T>(sql: string, params?: SqlParam[]) => allRaw<T>(sql, params),
    first: async <T>(sql: string, params?: SqlParam[]) => allRaw<T>(sql, params)[0] ?? null,
  };

  return {
    kind: 'sql.js',
    exec: (sql) => mutex.lock(async () => {
      await exec.exec(sql);
      await scheduleFlush();
    }),
    run: (sql, params) => mutex.lock(async () => {
      const r = await exec.run(sql, params);
      await scheduleFlush();
      return r;
    }),
    all: (sql, params) => mutex.lock(() => exec.all(sql, params)),
    first: (sql, params) => mutex.lock(() => exec.first(sql, params)),
    transaction: <T>(fn: (tx: SqlExecutor) => Promise<T>) =>
      mutex.lock(async () => {
        db.exec('BEGIN IMMEDIATE');
        try {
          const r = await fn(exec);
          db.exec('COMMIT');
          await scheduleFlush();
          return r;
        } catch (e) {
          try {
            db.exec('ROLLBACK');
          } catch {
            /* already rolled back */
          }
          throw e;
        }
      }),
    close: async () => {
      await flush();
      db.close();
    },
  };
}
