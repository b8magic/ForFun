import initSqlJs from 'sql.js';
import { bootstrap } from '@/data/bootstrap';
import { MIGRATIONS, migrate } from '@/data/migrations';
import { createRepositories } from '@/data/repositories';
import { createSqlJsDriver } from '@/data/sqljs';

it('upgrades a populated v1 database without changing any existing row or identifier', async () => {
  const SQL = await initSqlJs();
  let bytes: Uint8Array | null = null;
  const db = createSqlJsDriver(SQL, null, { load: async () => bytes, save: async (snapshot) => { bytes = snapshot; } });
  await db.exec(MIGRATIONS[0]);
  await db.exec('PRAGMA user_version = 1');
  let id = 0;
  const deps = { newId: () => `fixture-${++id}`, now: () => '2026-10-10T08:00:00.000Z' };
  const repos = createRepositories(db, deps);
  const { activeId } = await bootstrap(repos);
  const { sessions } = await repos.sessions.saveBatch({ categoryId: activeId!, dates: ['2026-10-01', '2026-10-02'], requestId: 'existing-batch', shared: { notes: 'Conserva questi dati' } });
  await repos.settings.set('motionPref', 'reduced');
  await repos.settings.set('calendarSettings', { automatic: true, destination: 'calendar-1' });
  await repos.provenance.insert(db, { sessionId: sessions[0].id, provider: 'google', accountId: 'owner', calendarId: 'calendar-1', externalEventId: 'external-1', recurringEventId: 'series-1', occurrenceKey: 'occurrence-1', originalTitle: 'Surf', sourceAllDay: true, sourceStart: '2026-10-01', sourceEnd: '2026-10-02', importBatchId: 'import-1', importedAt: deps.now() });
  await repos.exportLinks.upsert({ sessionId: sessions[1].id, provider: 'apple', accountId: 'icloud', calendarId: 'calendar-2', externalEventId: 'written-1', occurrenceKey: null, status: 'created', opId: 'operation-1', snapshot: { title: 'Surf', notes: null, location: null, allDay: true, start: '2026-10-02', end: '2026-10-03', timeZone: null, timingState: 'date_only', durationSec: null, durationSource: null, schedulingPlaceholder: false, categoryName: 'Surf' }, exportedAt: deps.now() });
  await repos.exportJobs.enqueue({ sessionId: sessions[0].id, opId: 'pending-1', provider: 'google', accountId: 'owner', calendarId: 'calendar-1', kind: 'auto', nextAttemptAt: '2026-10-10T09:00:00.000Z' });
  const tables = ['categories', 'sessions', 'settings', 'import_provenance', 'export_links', 'export_jobs'];
  const before = await Promise.all(tables.map((table) => db.all(`SELECT * FROM ${table} ORDER BY rowid`)));
  await db.close();

  // Open exactly the bytes an existing installation would have on disk.
  const restored = createSqlJsDriver(SQL, bytes);
  expect(await migrate(restored)).toBe(2);
  const after = await Promise.all(tables.map((table) => restored.all(`SELECT * FROM ${table} ORDER BY rowid`)));
  expect(after).toEqual(before);
  expect(await restored.all('PRAGMA foreign_key_check')).toEqual([]);
  const upgraded = createRepositories(restored, deps);
  expect(await upgraded.drafts.list()).toEqual([]);
  expect(await upgraded.periods.list()).toEqual([]);
  expect(await migrate(restored)).toBe(2);
  await restored.close();
});
