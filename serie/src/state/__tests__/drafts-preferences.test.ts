import { DomainError, type Repositories } from '@/data/repositories';
import { buildTiming } from '@/domain/timing';
import * as A from '@/state/actions';
import { useApp } from '@/state/store';
import { testRepos } from '@/test/sqljs';

let mockRepos: Repositories;
jest.mock('@/data/database', () => ({ getRepositories: () => Promise.resolve(mockRepos) }));
jest.mock('@/platform/haptics', () => ({ haptics: new Proxy({}, { get: () => () => undefined }) }));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(async () => {
  jest.useFakeTimers();
  mockRepos = await testRepos();
  useApp.setState({ status: 'booting', categories: [], sessions: [], drafts: {}, namedPeriods: [], activeId: null, selection: [], pendingDetails: null, saving: false, saveError: null, lastSave: null, toast: null });
  await A.boot();
  useApp.setState({ today: '2026-10-12', viewMonth: { y: 2026, m: 10 } });
  A.setScreenReaderActive(false);
});

afterEach(async () => {
  await A.flushDrafts();
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('preserves A → B → A dates and details, then restores both drafts across boot', async () => {
  const [a, b] = useApp.getState().categories;
  A.toggleDate('2026-10-01');
  A.setPendingDetails({ notes: 'A notes' });
  const requestA = useApp.getState().drafts[a.id].requestId;
  await A.switchActivity(b.id);
  expect(useApp.getState()).toMatchObject({ selection: [], pendingDetails: null, saving: false, saveError: null });
  A.toggleDate('2026-10-02');
  A.setPendingDetails({ notes: 'B notes' });
  const requestB = useApp.getState().drafts[b.id].requestId;
  await A.switchActivity(a.id);
  expect(useApp.getState()).toMatchObject({ selection: ['2026-10-01'], pendingDetails: { notes: 'A notes' } });
  await A.boot();
  expect(useApp.getState()).toMatchObject({ activeId: a.id, selection: ['2026-10-01'], pendingDetails: { notes: 'A notes' } });
  expect(useApp.getState().drafts[a.id].requestId).toBe(requestA);
  await A.switchActivity(b.id);
  expect(useApp.getState()).toMatchObject({ selection: ['2026-10-02'], pendingDetails: { notes: 'B notes' } });
  expect(useApp.getState().drafts[b.id].requestId).toBe(requestB);
});

it('isolates failed saves and request ids, retaining the same retry identity after a restart', async () => {
  const [a, b] = useApp.getState().categories;
  A.toggleDate('2026-10-01');
  const requestA = useApp.getState().drafts[a.id].requestId;
  jest.spyOn(mockRepos.sessions, 'saveBatch').mockRejectedValueOnce(new DomainError('fixture_failure'));
  expect(await A.save()).toBe(false);
  expect(useApp.getState().saveError).toBeTruthy();
  await A.switchActivity(b.id);
  expect(useApp.getState().saveError).toBeNull();
  A.toggleDate('2026-10-02');
  expect(await A.save()).toBe(true);
  await A.switchActivity(a.id);
  expect(useApp.getState().saveError).toBeTruthy();
  expect(useApp.getState().drafts[a.id].requestId).toBe(requestA);
  await A.boot();
  expect(useApp.getState().drafts[a.id].requestId).toBe(requestA);
  expect(await A.save()).toBe(true);
  const sessions = await mockRepos.sessions.listAll();
  expect(sessions).toHaveLength(2);
  expect(sessions.find((session) => session.categoryId === a.id)?.saveRequestId).toBe(requestA);
  expect(await mockRepos.drafts.list()).toEqual([]);
});

it('ignores a double tap and lets another activity save while the first completion is delayed', async () => {
  const [a, b] = useApp.getState().categories;
  const entered = deferred();
  const release = deferred();
  const originalSave = mockRepos.sessions.saveBatch;
  jest.spyOn(mockRepos.sessions, 'saveBatch').mockImplementation(async (input) => {
    if (input.categoryId === a.id) {
      entered.resolve();
      await release.promise;
    }
    return originalSave(input);
  });
  A.toggleDate('2026-10-01');
  const first = A.save();
  expect(await A.save()).toBe(false);
  await entered.promise;
  await A.switchActivity(b.id);
  A.toggleDate('2026-10-02');
  A.setPendingDetails({ notes: 'B stays independent' });
  expect(await A.save()).toBe(true);
  const undoB = useApp.getState().toast!.action!.run;
  A.toggleDate('2026-10-03');
  A.setPendingDetails({ notes: 'Next B draft' });
  release.resolve();
  expect(await first).toBe(true);
  expect(useApp.getState()).toMatchObject({ activeId: b.id, selection: ['2026-10-03'], pendingDetails: { notes: 'Next B draft' }, saving: false });
  expect(useApp.getState().drafts[a.id]).toBeUndefined();
  await A.flushDrafts();
  expect((await mockRepos.drafts.get(b.id))?.dates).toEqual(['2026-10-03']);
  expect(await mockRepos.sessions.listAll()).toHaveLength(2);
  // A later save cannot redirect a previously captured B undo callback.
  const removed = deferred();
  const originalRemove = mockRepos.sessions.remove;
  jest.spyOn(mockRepos.sessions, 'remove').mockImplementation(async (ids) => {
    const count = await originalRemove(ids);
    removed.resolve();
    return count;
  });
  undoB();
  await removed.promise;
  expect((await mockRepos.sessions.listAll()).map((session) => session.categoryId)).toEqual([a.id]);
  expect(useApp.getState().lastSave?.categoryId).toBe(a.id);
});

it('keeps an edit made before an older save completes, both in memory and on disk', async () => {
  const categoryId = useApp.getState().activeId!;
  A.toggleDate('2026-10-01');
  A.setPendingDetails({ notes: 'Original' });
  const saving = A.save();
  // This edit occurs before save's first await resolves.
  A.setPendingDetails({ notes: 'Newer draft' });
  const newRequest = useApp.getState().drafts[categoryId].requestId;
  expect(await saving).toBe(true);
  await A.flushDrafts();
  expect(useApp.getState()).toMatchObject({ selection: ['2026-10-01'], pendingDetails: { notes: 'Newer draft' }, saving: false });
  expect(await mockRepos.drafts.get(categoryId)).toMatchObject({ requestId: newRequest, details: { notes: 'Newer draft' } });
  expect((await mockRepos.sessions.listAll())[0].notes).toBe('Original');
});

it('retains a draft on write failure and retries with its stable request id', async () => {
  jest.spyOn(mockRepos.drafts, 'put').mockRejectedValueOnce(new DomainError('storage_full'));
  A.toggleDate('2026-10-01');
  const categoryId = useApp.getState().activeId!;
  const requestId = useApp.getState().drafts[categoryId].requestId;
  await expect(A.flushDrafts()).rejects.toThrow();
  expect(useApp.getState()).toMatchObject({ selection: ['2026-10-01'], saving: false });
  expect(useApp.getState().saveError).toBeTruthy();
  expect(await A.save()).toBe(true);
  expect((await mockRepos.sessions.listAll())[0].saveRequestId).toBe(requestId);
});

it('does not duplicate after a commit whose completion was lost, including a second save tap', async () => {
  const originalSave = mockRepos.sessions.saveBatch;
  jest.spyOn(mockRepos.sessions, 'saveBatch').mockImplementationOnce(async (input) => {
    await originalSave(input);
    throw new DomainError('completion_lost');
  });
  A.toggleDate('2026-10-01');
  const categoryId = useApp.getState().activeId!;
  const requestId = useApp.getState().drafts[categoryId].requestId;
  expect(await A.save()).toBe(false);
  expect(await mockRepos.sessions.listAll()).toHaveLength(1);
  expect(await mockRepos.drafts.get(categoryId)).toBeNull();
  const retry = A.save();
  expect(await A.save()).toBe(false);
  expect(await retry).toBe(true);
  expect(await mockRepos.sessions.listAll()).toHaveLength(1);
  expect(useApp.getState().lastSave?.requestId).toBe(requestId);
  expect(await mockRepos.drafts.get(categoryId)).toBeNull();
});

it('expires the exact undo batch after its advertised window', async () => {
  A.toggleDate('2026-10-01');
  await A.save();
  const saved = useApp.getState().lastSave!;
  jest.setSystemTime(saved.expiresAt + 1);
  await A.undoSave(saved);
  expect(await mockRepos.sessions.listAll()).toHaveLength(1);
});

it('persists preferences and decodes unsupported stored values to defaults', async () => {
  expect(useApp.getState()).toMatchObject({ themePref: 'cream', homeActivitiesMode: 'all', motionPref: 'system' });
  await A.setThemePref('dark');
  await A.setHomeActivitiesMode('active');
  await A.setMotionPref('reduced');
  await A.boot();
  expect(useApp.getState()).toMatchObject({ themePref: 'dark', homeActivitiesMode: 'active', motionPref: 'reduced' });
  await mockRepos.settings.set('themePref', { unrecognized: 'value' });
  await mockRepos.settings.set('homeActivitiesMode', 'sometimes');
  await mockRepos.settings.set('motionPref', ['reduced']);
  await A.boot();
  expect(useApp.getState()).toMatchObject({ themePref: 'cream', homeActivitiesMode: 'all', motionPref: 'system' });
});

it('treats committed period CRUD as successful even if its refresh fails', async () => {
  const spy = jest.spyOn(mockRepos.periods, 'list');
  spy.mockRejectedValueOnce(new Error('read failed'));
  const period = await A.createNamedPeriod({ name: 'Viaggio', startDate: '2026-10-01', endDate: '2026-10-07', scope: 'all' });
  expect(useApp.getState().namedPeriods).toEqual([period]);
  expect(await mockRepos.periods.list()).toHaveLength(1);
  spy.mockRejectedValueOnce(new Error('read failed'));
  const updated = await A.updateNamedPeriod(period.id, { name: 'Viaggio lungo' });
  expect(useApp.getState().namedPeriods).toEqual([updated]);
  spy.mockRejectedValueOnce(new Error('read failed'));
  await A.deleteNamedPeriod(period.id);
  expect(useApp.getState().namedPeriods).toEqual([]);
  expect(await mockRepos.periods.list()).toEqual([]);
});

it('preserves B save and consumed draft when deleting inactive A finishes a delayed period read', async () => {
  const [a, b] = useApp.getState().categories;
  await A.switchActivity(b.id);
  A.toggleDate('2026-10-01');
  await A.flushDrafts();
  const entered = deferred();
  const release = deferred();
  const originalList = mockRepos.periods.list;
  jest.spyOn(mockRepos.periods, 'list').mockImplementationOnce(async () => {
    const snapshot = await originalList();
    entered.resolve();
    await release.promise;
    return snapshot;
  });
  const deleting = A.deleteCategory(a.id);
  await entered.promise;
  expect(await A.save()).toBe(true);
  expect(useApp.getState().sessions).toHaveLength(1);
  expect(useApp.getState().selection).toEqual([]);
  release.resolve();
  await deleting;
  expect(useApp.getState().sessions).toEqual(await mockRepos.sessions.listAll());
  expect(useApp.getState().sessions).toHaveLength(1);
  expect(useApp.getState().activeId).toBe(b.id);
  expect(useApp.getState().selection).toEqual([]);
  expect(useApp.getState().drafts[b.id]).toBeUndefined();
  expect(await mockRepos.drafts.get(b.id)).toBeNull();
});

it('preserves a newer switch, details and period while an activity deletion reload is delayed', async () => {
  const [a, b, c] = useApp.getState().categories;
  await A.switchActivity(b.id);
  const entered = deferred();
  const release = deferred();
  const originalList = mockRepos.periods.list;
  jest.spyOn(mockRepos.periods, 'list').mockImplementationOnce(async () => {
    const snapshot = await originalList();
    entered.resolve();
    await release.promise;
    return snapshot;
  });
  const deleting = A.deleteCategory(a.id);
  await entered.promise;
  await A.switchActivity(c.id);
  A.toggleDate('2026-10-02');
  A.setPendingDetails({ notes: 'Keep the new activity draft' });
  const period = await A.createNamedPeriod({ name: 'A new period', startDate: '2026-10-01', endDate: '2026-10-07', scope: 'all' });
  release.resolve();
  await deleting;
  expect(useApp.getState()).toMatchObject({ activeId: c.id, selection: ['2026-10-02'], pendingDetails: { notes: 'Keep the new activity draft' }, namedPeriods: [period] });
  expect(await mockRepos.settings.get('lastActiveCategoryId', null)).toBe(c.id);
});

it('rejects an old sessions reload after Undo and an old categories reload after an edit', async () => {
  A.toggleDate('2026-10-01');
  await A.save();
  const entered = deferred();
  const release = deferred();
  const originalList = mockRepos.sessions.listAll;
  jest.spyOn(mockRepos.sessions, 'listAll').mockImplementationOnce(async () => {
    const snapshot = await originalList();
    entered.resolve();
    await release.promise;
    return snapshot;
  });
  const refreshing = A.refreshAll();
  await entered.promise;
  await A.undoLastSave();
  release.resolve();
  await refreshing;
  expect(useApp.getState().sessions).toEqual([]);
  expect(await mockRepos.sessions.listAll()).toEqual([]);

  const categoriesEntered = deferred();
  const categoriesRelease = deferred();
  const originalCategories = mockRepos.categories.list;
  jest.spyOn(mockRepos.categories, 'list').mockImplementationOnce(async () => {
    const snapshot = await originalCategories();
    categoriesEntered.resolve();
    await categoriesRelease.promise;
    return snapshot;
  });
  const oldRefresh = A.refreshAll();
  await categoriesEntered.promise;
  const categoryId = useApp.getState().activeId!;
  await A.updateCategory(categoryId, { name: 'Surf aggiornato' });
  categoriesRelease.resolve();
  await oldRefresh;
  expect(useApp.getState().categories.find((category) => category.id === categoryId)?.name).toBe('Surf aggiornato');
});

it('does not let a delayed boot restore saved drafts or overwrite later records, activity and preferences', async () => {
  const [, b] = useApp.getState().categories;
  A.toggleDate('2026-10-01');
  await A.flushDrafts();
  const entered = deferred();
  const release = deferred();
  const originalList = mockRepos.periods.list;
  jest.spyOn(mockRepos.periods, 'list').mockImplementationOnce(async () => {
    const snapshot = await originalList();
    entered.resolve();
    await release.promise;
    return snapshot;
  });
  const reboot = A.boot();
  expect(A.boot()).toBe(reboot); // a single initialization owns the startup snapshot
  await entered.promise;
  expect(await A.save()).toBe(true);
  await A.switchActivity(b.id);
  A.toggleDate('2026-10-02');
  A.setPendingDetails({ notes: 'New B work' });
  await A.setThemePref('dark');
  await A.setHomeActivitiesMode('active');
  await A.setMotionPref('reduced');
  await A.updateCategory(b.id, { name: 'Corsa nuova' });
  const period = await A.createNamedPeriod({ name: 'October', startDate: '2026-10-01', endDate: '2026-10-07', scope: 'all' });
  A.setViewMonth({ y: 2026, m: 9 });
  release.resolve();
  await reboot;
  expect(useApp.getState()).toMatchObject({ activeId: b.id, selection: ['2026-10-02'], pendingDetails: { notes: 'New B work' }, themePref: 'dark', homeActivitiesMode: 'active', motionPref: 'reduced', namedPeriods: [period], viewMonth: { y: 2026, m: 9 } });
  expect(useApp.getState().sessions).toEqual(await mockRepos.sessions.listAll());
  expect(useApp.getState().sessions).toHaveLength(1);
  expect(useApp.getState().categories.find((category) => category.id === b.id)?.name).toBe('Corsa nuova');
  expect(await mockRepos.settings.get('lastActiveCategoryId', null)).toBe(b.id);
});

it('preserves applied clock fields across restart when a selected DST date is later removed', async () => {
  const timing = buildTiming('2026-03-30', { state: 'interval', start: '02:30', end: '03:00', endDayOffset: 0, timeZone: 'Europe/Rome' });
  if (!timing.ok) throw new Error('invalid timing fixture');
  A.toggleDate('2026-03-30');
  A.setPendingDetails({ timing: timing.timing });
  A.toggleDate('2026-03-29');
  await A.flushDrafts();
  await A.boot();
  expect(await A.save()).toBe(false);
  expect(await mockRepos.sessions.listAll()).toEqual([]);
  expect(useApp.getState().pendingDetails?.timing).toEqual(timing.timing);
  expect(useApp.getState().saveError).toMatch(/orari/);
  A.toggleDate('2026-03-29');
  expect(useApp.getState().selection).toEqual(['2026-03-30']);
  expect(useApp.getState().pendingDetails?.timing).toEqual(timing.timing);
  expect(await A.save()).toBe(true);
  expect((await mockRepos.sessions.listAll())[0].timing).toMatchObject({ state: 'interval', start: '02:30', end: '03:00', durationSec: 1800 });
});
