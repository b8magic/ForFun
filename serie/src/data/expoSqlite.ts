/**
 * expo-sqlite driver (native). ONE connection for everything, WAL mode,
 * foreign keys on, every statement serialised through a mutex.
 *
 * Transactions run as BEGIN IMMEDIATE … COMMIT on that same connection
 * (exactly like the sql.js driver), never through
 * `withExclusiveTransactionAsync`: that API opens a second connection, where
 * `PRAGMA foreign_keys` is off (ON DELETE CASCADE / SET NULL would silently
 * not fire) and where concurrent writes on the main connection fail with
 * "database is locked".
 */
import * as SQLite from 'expo-sqlite';
import { Mutex, type RunResult, type SqlDriver, type SqlExecutor, type SqlParam } from './driver';

type Db = SQLite.SQLiteDatabase;

function wrap(db: Pick<Db, 'execAsync' | 'runAsync' | 'getAllAsync' | 'getFirstAsync'>): SqlExecutor {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: SqlParam[] = []): Promise<RunResult> => {
      const r = await db.runAsync(sql, params);
      return { changes: r.changes, lastInsertRowId: r.lastInsertRowId };
    },
    all: <T>(sql: string, params: SqlParam[] = []) => db.getAllAsync<T>(sql, params),
    first: async <T>(sql: string, params: SqlParam[] = []) => (await db.getFirstAsync<T>(sql, params)) ?? null,
  };
}

export async function openExpoSqliteDriver(name = 'serie.db'): Promise<SqlDriver> {
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const raw = wrap(db);
  const mutex = new Mutex();
  return {
    kind: 'expo-sqlite',
    exec: (sql) => mutex.lock(() => raw.exec(sql)),
    run: (sql, params) => mutex.lock(() => raw.run(sql, params)),
    all: <T>(sql: string, params?: SqlParam[]) => mutex.lock(() => raw.all<T>(sql, params)),
    first: <T>(sql: string, params?: SqlParam[]) => mutex.lock(() => raw.first<T>(sql, params)),
    // Statements inside `fn` must use `tx` (the mutex is held for the whole transaction).
    transaction: <T>(fn: (tx: SqlExecutor) => Promise<T>) =>
      mutex.lock(async () => {
        await db.execAsync('BEGIN IMMEDIATE');
        try {
          const result = await fn(raw);
          await db.execAsync('COMMIT');
          return result;
        } catch (e) {
          try {
            await db.execAsync('ROLLBACK');
          } catch {
            // the original error is what matters
          }
          throw e;
        }
      }),
    close: () => mutex.lock(() => db.closeAsync()),
  };
}
