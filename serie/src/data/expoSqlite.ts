/**
 * expo-sqlite driver (native). One connection, WAL mode, foreign keys on.
 * Transactions use withExclusiveTransactionAsync so no other query can
 * interleave with a save.
 */
import * as SQLite from 'expo-sqlite';
import type { RunResult, SqlDriver, SqlExecutor, SqlParam } from './driver';

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
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const base = wrap(db);
  return {
    kind: 'expo-sqlite',
    ...base,
    transaction: async <T>(fn: (tx: SqlExecutor) => Promise<T>) => {
      let result: T | undefined;
      await db.withExclusiveTransactionAsync(async (txn) => {
        result = await fn(wrap(txn));
      });
      return result as T;
    },
    close: () => db.closeAsync(),
  };
}
