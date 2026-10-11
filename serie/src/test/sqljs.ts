import initSqlJs from 'sql.js';
import { createSqlJsDriver } from '@/data/sqljs';
import { migrate } from '@/data/migrations';
import { createRepositories } from '@/data/repositories';

let counter = 0;
export async function testRepos(opts: { now?: () => string } = {}) {
  const SQL = await initSqlJs();
  const db = createSqlJsDriver(SQL, null);
  await migrate(db);
  const deps = { newId: () => `id-${++counter}`, now: opts.now ?? (() => new Date(Date.UTC(2026, 9, 10, 8, 0, counter)).toISOString()) };
  return createRepositories(db, deps);
}
