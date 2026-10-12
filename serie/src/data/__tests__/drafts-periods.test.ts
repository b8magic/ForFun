import initSqlJs from 'sql.js';
import { bootstrap } from '@/data/bootstrap';
import { migrate } from '@/data/migrations';
import { createRepositories } from '@/data/repositories';
import { createSqlJsDriver } from '@/data/sqljs';
import { sessionsForNamedPeriod, summarizeNamedPeriod } from '@/domain/namedPeriods';
import { buildTiming } from '@/domain/timing';
import type { CategoryDraft } from '@/domain/types';
import { testRepos } from '@/test/sqljs';

describe('durable activity drafts', () => {
  it('restores dates, independent details and request ids from persisted database bytes', async () => {
    const SQL = await initSqlJs();
    let bytes: Uint8Array | null = null;
    const db = createSqlJsDriver(SQL, null, { load: async () => bytes, save: async (snapshot) => { bytes = snapshot; } });
    await migrate(db);
    let id = 0;
    const deps = { newId: () => `restart-${++id}`, now: () => '2026-10-10T08:00:00.000Z' };
    const repos = createRepositories(db, deps);
    const { categories } = await bootstrap(repos);
    const drafts: CategoryDraft[] = categories.slice(0, 2).map((category, i) => ({ categoryId: category.id, dates: [`2026-10-0${i + 1}`], details: { notes: `Note ${i}`, place: { label: 'Spiaggia', address: null, mapUrl: null, coords: null, resolution: 'none', resolutionNote: null } }, requestId: `request-${i}`, updatedAt: deps.now() }));
    for (const draft of drafts) await repos.drafts.put(draft);
    await db.close();
    const restored = createSqlJsDriver(SQL, bytes);
    const after = createRepositories(restored, deps);
    expect(await after.drafts.list()).toEqual(drafts);
    await restored.close();
  });

  it('consumes only the matching draft in the same successful session transaction', async () => {
    const repos = await testRepos();
    const { categories } = await bootstrap(repos);
    const a: CategoryDraft = { categoryId: categories[0].id, dates: ['2026-10-01'], details: { notes: 'A' }, requestId: 'a', updatedAt: '2026-10-10T08:00:00Z' };
    const b = { ...a, categoryId: categories[1].id, requestId: 'b' };
    await repos.drafts.put(a);
    await repos.drafts.put(b);
    // A new edit arrives before the older save commits.
    await repos.drafts.put({ ...a, requestId: 'new-a', details: { notes: 'A updated' } });
    await repos.sessions.saveBatch({ categoryId: a.categoryId, dates: a.dates, requestId: a.requestId, consumeDraftRequestId: a.requestId });
    expect((await repos.drafts.get(a.categoryId))?.requestId).toBe('new-a');
    await repos.sessions.saveBatch({ categoryId: a.categoryId, dates: a.dates, requestId: 'new-a', consumeDraftRequestId: 'new-a' });
    expect(await repos.drafts.get(a.categoryId)).toBeNull();
    expect(await repos.drafts.get(b.categoryId)).toEqual(b);
    expect(await repos.sessions.listAll()).toHaveLength(2);
  });

  it('rolls back sessions and draft consumption together if the consumption fails', async () => {
    const repos = await testRepos();
    const { activeId } = await bootstrap(repos);
    const draft: CategoryDraft = { categoryId: activeId!, dates: ['2026-10-01'], details: null, requestId: 'atomic', updatedAt: '2026-10-10T08:00:00Z' };
    await repos.drafts.put(draft);
    await repos.db.exec("CREATE TRIGGER fail_draft_delete BEFORE DELETE ON category_drafts BEGIN SELECT RAISE(ABORT, 'disk failure'); END;");
    await expect(repos.sessions.saveBatch({ categoryId: draft.categoryId, dates: draft.dates, requestId: draft.requestId, consumeDraftRequestId: draft.requestId })).rejects.toThrow('disk failure');
    expect(await repos.sessions.listAll()).toEqual([]);
    expect(await repos.drafts.get(draft.categoryId)).toEqual(draft);
    await repos.db.exec('DROP TRIGGER fail_draft_delete');
    await repos.sessions.saveBatch({ categoryId: draft.categoryId, dates: draft.dates, requestId: draft.requestId, consumeDraftRequestId: draft.requestId });
    expect(await repos.drafts.get(draft.categoryId)).toBeNull();
  });

  it('rolls back an entire save if a newly selected DST date cannot keep the applied interval', async () => {
    const repos = await testRepos();
    const { activeId } = await bootstrap(repos);
    const built = buildTiming('2026-03-30', { state: 'interval', start: '02:30', end: '03:00', endDayOffset: 0, timeZone: 'Europe/Rome' });
    if (!built.ok) throw new Error('invalid timing fixture');
    const draft: CategoryDraft = { categoryId: activeId!, dates: ['2026-03-28', '2026-03-29', '2026-03-30'], details: { timing: built.timing }, requestId: 'dst', updatedAt: '2026-10-10T08:00:00Z' };
    await repos.drafts.put(draft);
    await expect(repos.sessions.saveBatch({ categoryId: draft.categoryId, dates: draft.dates, requestId: draft.requestId, shared: draft.details!, consumeDraftRequestId: draft.requestId })).rejects.toMatchObject({ code: 'timing_invalid_for_date', message: '2026-03-29' });
    expect(await repos.sessions.listAll()).toEqual([]);
    expect(await repos.drafts.get(draft.categoryId)).toEqual(draft);
  });
});

describe('named periods', () => {
  it('allows overlapping duplicate names and dynamically follows session dates, details and deletion', async () => {
    const repos = await testRepos();
    const { categories } = await bootstrap(repos);
    const [a, b] = categories;
    const all = await repos.periods.create({ name: '  Vacanza  ', startDate: '2026-10-01', endDate: '2026-10-07', scope: 'all', note: 'Costa' });
    const selected = await repos.periods.create({ name: 'Vacanza', startDate: '2026-10-03', endDate: '2026-10-10', scope: 'selected', categoryIds: [a.id] });
    expect(await repos.sessions.listAll()).toEqual([]); // periods never manufacture sessions
    expect(all.name).toBe('Vacanza');
    const timing = buildTiming('2026-10-03', { state: 'duration_only', declaredSec: 3600 });
    if (!timing.ok) throw new Error('invalid fixture');
    const first = await repos.sessions.saveBatch({ categoryId: a.id, dates: ['2026-10-03', '2026-10-07'], requestId: 'a', shared: { timing: timing.timing } });
    const second = await repos.sessions.saveBatch({ categoryId: b.id, dates: ['2026-10-07'], requestId: 'b' });
    let sessions = await repos.sessions.listAll();
    expect(summarizeNamedPeriod(sessions, all)).toEqual({ sessions: 3, activeDays: 2, duration: { knownSec: 7200, knownCount: 2, totalCount: 3 } });
    expect(sessionsForNamedPeriod(sessions, selected)).toHaveLength(2);
    await repos.sessions.update(first.sessions[0].id, { date: '2026-10-11' });
    await repos.sessions.remove([second.sessions[0].id]);
    sessions = await repos.sessions.listAll();
    expect(summarizeNamedPeriod(sessions, all).sessions).toBe(1);
    const extended = await repos.periods.update(selected.id, { endDate: '2026-10-11', name: 'Autunno' });
    expect(sessionsForNamedPeriod(sessions, extended)).toHaveLength(2);
    await repos.periods.remove(all.id);
    expect(await repos.sessions.listAll()).toEqual(sessions);
    expect(await repos.periods.list()).toEqual([extended]);
  });

  it('keeps selected scope empty after its activities are deleted; it never widens to all', async () => {
    const repos = await testRepos();
    const { categories } = await bootstrap(repos);
    const period = await repos.periods.create({ name: 'Solo surf', startDate: '2026-10-01', endDate: '2026-10-31', scope: 'selected', categoryIds: [categories[0].id] });
    await repos.sessions.saveBatch({ categoryId: categories[1].id, dates: ['2026-10-10'], requestId: 'another-activity' });
    await repos.categories.remove(categories[0].id);
    const [stored] = await repos.periods.list();
    expect(stored).toMatchObject({ id: period.id, scope: 'selected', categoryIds: [] });
    expect(sessionsForNamedPeriod(await repos.sessions.listAll(), stored)).toEqual([]);
    expect(await repos.periods.update(period.id, { name: 'Surf eliminato' })).toMatchObject({ scope: 'selected', categoryIds: [] });
    expect(await repos.db.all('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('validates real inclusive ranges, bounded names and explicit activity selection', async () => {
    const repos = await testRepos();
    await bootstrap(repos);
    const input = { name: 'Estate', startDate: '2027-06-01', endDate: '2027-06-01', scope: 'all' as const };
    expect(await repos.periods.create(input)).toMatchObject(input); // future ranges are valid views
    await expect(repos.periods.create({ ...input, name: ' '.repeat(5) })).rejects.toMatchObject({ code: 'name_required' });
    await expect(repos.periods.create({ ...input, name: 'x'.repeat(81) })).rejects.toMatchObject({ code: 'name_too_long' });
    await expect(repos.periods.create({ ...input, endDate: '2027-02-30' })).rejects.toMatchObject({ code: 'invalid_date' });
    await expect(repos.periods.create({ ...input, endDate: '2027-05-31' })).rejects.toMatchObject({ code: 'invalid_range' });
    await expect(repos.periods.create({ ...input, scope: 'selected', categoryIds: [] })).rejects.toMatchObject({ code: 'categories_required' });
    await expect(repos.periods.create({ ...input, scope: 'selected', categoryIds: ['missing'] })).rejects.toMatchObject({ code: 'category_missing' });
  });
});
