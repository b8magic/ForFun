/**
 * Minimal SQL driver contract. Two implementations:
 *  - expoSqlite.ts  → expo-sqlite on iOS/Android (the shipping database)
 *  - sqljs.ts       → sql.js (WASM SQLite) for web verification and Jest
 * Repositories only see this interface, so the same SQL runs everywhere.
 */
export type SqlParam = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface SqlExecutor {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlParam[]): Promise<RunResult>;
  all<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]>;
  first<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T | null>;
}

export interface SqlDriver extends SqlExecutor {
  /** Runs `fn` atomically. Statements inside must use the provided executor. */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  readonly kind: 'expo-sqlite' | 'sql.js';
}

/** Simple async mutex so transactions never interleave on single-connection drivers. */
export class Mutex {
  private tail: Promise<void> = Promise.resolve();
  lock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn, fn);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
