import { openExpoSqliteDriver } from './expoSqlite';
import type { SqlDriver } from './driver';

export function openDriver(): Promise<SqlDriver> {
  return openExpoSqliteDriver('serie.db');
}
