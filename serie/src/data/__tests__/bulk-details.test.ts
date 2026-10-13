import { bootstrap } from '@/data/bootstrap';
import { testRepos } from '@/test/sqljs';
import { buildTiming, DATE_ONLY } from '@/domain/timing';
import type { BulkDetailsPatch } from '@/domain/bulkDetails';
import type { Place, Timing } from '@/domain/types';

const place: Place = { label: 'Spiaggia', address: 'Via del mare', mapUrl: null, coords: null, resolution: 'none', resolutionNote: null };
const duration: Timing = { ...DATE_ONLY, state: 'duration_only', declaredSec: 3601, durationSec: 3601, durationSource: 'declared' };

async function fixture(dates = ['2026-10-01', '2026-10-02']) {
  const repos = await testRepos();
  const { categories } = await bootstrap(repos);
  const [category, other] = categories;
  const { sessions } = await repos.sessions.saveBatch({ categoryId: category.id, dates, requestId: 'initial', shared: { notes: 'Originale', place, timing: duration } });
  return { repos, categoryId: category.id, otherId: other.id, sessions };
}

it('updates exact IDs across dates and same-day duplicates, preserving untouched details and drafts', async () => {
  const { repos, categoryId, otherId, sessions } = await fixture();
  const duplicate = (await repos.sessions.saveBatch({ categoryId, dates: [sessions[0].date], requestId: 'duplicate' })).sessions[0];
  const other = (await repos.sessions.saveBatch({ categoryId: otherId, dates: [sessions[0].date], requestId: 'other' })).sessions[0];
  const draft = { categoryId, dates: ['2026-10-03'], details: { notes: 'Bozza' }, requestId: 'draft', updatedAt: '2026-10-10T08:00:00Z' };
  await repos.drafts.put(draft);
  const result = await repos.sessions.updateDetailsBatch({ categoryId, expected: sessions, patch: { notes: '  Uguale per queste due  ' } });
  expect(result.changed).toBe(2);
  expect(result.sessions.map((session) => session.id)).toEqual(sessions.map((session) => session.id));
  expect(result.sessions.every((session) => session.notes === 'Uguale per queste due')).toBe(true);
  for (let i = 0; i < sessions.length; i++) {
    expect(result.sessions[i]).toMatchObject({ timing: duration, place, date: sessions[i].date, origin: sessions[i].origin, saveRequestId: sessions[i].saveRequestId, createdAt: sessions[i].createdAt });
  }
  expect(await repos.sessions.get(duplicate.id)).toEqual(duplicate);
  expect(await repos.sessions.get(other.id)).toEqual(other);
  expect(await repos.sessions.listAll()).toHaveLength(4);
  expect(await repos.drafts.get(categoryId)).toEqual(draft);
});

it('keeps omitted fields, treats explicit clears independently, and does not timestamp a no-op', async () => {
  const { repos, categoryId, sessions } = await fixture();
  const unchanged = await repos.sessions.updateDetailsBatch({ categoryId, expected: sessions, patch: {} });
  expect(unchanged).toEqual({ sessions, changed: 0 });
  const cleared = await repos.sessions.updateDetailsBatch({ categoryId, expected: sessions, patch: { notes: null, timing: { ...DATE_ONLY } } });
  expect(cleared.sessions.every((session) => session.notes === null && session.timing.durationSec === null)).toBe(true);
  expect(cleared.sessions.map((session) => session.place)).toEqual([place, place]);
  const removedPlace = await repos.sessions.updateDetailsBatch({ categoryId, expected: cleared.sessions, patch: { place: null } });
  expect(removedPlace.sessions.every((session) => session.place === null)).toBe(true);
});

it('edits two distinct records on the same date without merging their identities', async () => {
  const { repos, categoryId, sessions } = await fixture();
  const duplicate = (await repos.sessions.saveBatch({ categoryId, dates: [sessions[0].date], requestId: 'separate', origin: 'import' })).sessions[0];
  const result = await repos.sessions.updateDetailsBatch({ categoryId, expected: [sessions[0], duplicate], patch: { notes: 'Entrambe' } });
  expect(result.changed).toBe(2);
  expect(result.sessions.map((session) => [session.id, session.origin, session.saveRequestId])).toEqual([[sessions[0].id, 'manual', 'initial'], [duplicate.id, 'import', 'separate']]);
  expect(await repos.sessions.listAll()).toHaveLength(3);
  expect(await repos.sessions.get(sessions[1].id)).toEqual(sessions[1]);
});

it('rejects date/activity reassignment through the details-only API', async () => {
  const { repos, categoryId, sessions } = await fixture();
  await expect(repos.sessions.updateDetailsBatch({ categoryId, expected: sessions, patch: { date: '2026-10-03' } as BulkDetailsPatch })).rejects.toMatchObject({ code: 'invalid_patch' });
  expect(await repos.sessions.listAll()).toEqual(sessions);
});

it('rejects stale values even when their updatedAt has not changed, without editing another target', async () => {
  const { repos, categoryId, sessions } = await fixture();
  await repos.db.run('UPDATE sessions SET notes = ? WHERE id = ?', ['Changed elsewhere', sessions[1].id]);
  await expect(repos.sessions.updateDetailsBatch({ categoryId, expected: sessions, patch: { notes: 'Bulk' } })).rejects.toMatchObject({ code: 'session_changed' });
  expect(await repos.sessions.get(sessions[0].id)).toEqual(sessions[0]);
  expect((await repos.sessions.get(sessions[1].id))?.notes).toBe('Changed elsewhere');
});

it.each(['missing', 'moved-date', 'moved-activity'] as const)('rejects a %s target without changing its siblings', async (change) => {
  const { repos, categoryId, otherId, sessions } = await fixture();
  if (change === 'missing') await repos.sessions.remove([sessions[1].id]);
  if (change === 'moved-date') await repos.sessions.update(sessions[1].id, { date: '2026-10-05' });
  if (change === 'moved-activity') await repos.sessions.update(sessions[1].id, { categoryId: otherId });
  await expect(repos.sessions.updateDetailsBatch({ categoryId, expected: sessions, patch: { notes: 'Bulk' } })).rejects.toMatchObject({ code: change === 'missing' ? 'session_missing' : change === 'moved-activity' ? 'bulk_category_changed' : 'session_changed' });
  expect(await repos.sessions.get(sessions[0].id)).toEqual(sessions[0]);
});

it('rolls back the first SQL update when a later update fails', async () => {
  const { repos, categoryId, sessions } = await fixture();
  await repos.db.exec("CREATE TRIGGER fail_second_bulk BEFORE UPDATE ON sessions WHEN OLD.date = '2026-10-02' BEGIN SELECT RAISE(ABORT, 'disk full'); END;");
  await expect(repos.sessions.updateDetailsBatch({ categoryId, expected: sessions, patch: { notes: 'Bulk' } })).rejects.toThrow('disk full');
  expect(await repos.sessions.listAll()).toEqual(sessions);
});

it('re-derives each interval at its own date across DST', async () => {
  const { repos, categoryId, sessions } = await fixture(['2026-10-24', '2026-10-25']);
  const built = buildTiming('2026-10-24', { state: 'interval', start: '01:30', end: '04:30', endDayOffset: 0, timeZone: 'Europe/Rome' });
  if (!built.ok) throw new Error('invalid test timing');
  const result = await repos.sessions.updateDetailsBatch({ categoryId, expected: sessions, patch: { timing: built.timing } });
  expect(result.sessions.map((session) => session.timing.durationSec)).toEqual([10800, 14400]);
  expect(result.sessions.map((session) => session.date)).toEqual(['2026-10-24', '2026-10-25']);
});

it.each(['interval', 'start_only', 'start_duration'] as const)('refuses a nonexistent %s clock on any target without partial writes', async (state) => {
  const { repos, categoryId, sessions } = await fixture(['2026-03-28', '2026-03-29']);
  const built = buildTiming('2026-03-28', { state, start: '02:30', end: '04:30', endDayOffset: 0, timeZone: 'Europe/Rome', declaredSec: 3600 });
  if (!built.ok) throw new Error('invalid test timing');
  await expect(repos.sessions.updateDetailsBatch({ categoryId, expected: sessions, patch: { notes: 'Bulk', timing: built.timing } })).rejects.toMatchObject({ code: 'timing_invalid_for_date', message: '2026-03-29' });
  expect(await repos.sessions.listAll()).toEqual(sessions);
});
