import type { Repositories } from '@/data/repositories';
import { testRepos } from '@/test/sqljs';
import { useApp } from '@/state/store';
import * as A from '@/state/actions';
import { onCommit } from '@/state/hooks';
import { withExportLock } from '@/calendar/exportCore';
import { defaultConfig, enqueueForSessions, runJobs } from '@/calendar/autoExport';
import { EMAIL, FakeProvider, G_CAL, G_CONN } from '@/calendar/__tests__/fakeCalendar';

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
  useApp.setState({ status: 'booting', categories: [], sessions: [], drafts: {}, namedPeriods: [], activeId: null, selection: [], pendingDetails: null, saving: false, saveError: null, homeSessionMode: 'new', bulkSelection: [], bulkSaving: false, lastSave: null, toast: null });
  await A.boot();
  useApp.setState({ today: '2026-10-13' });
});

afterEach(async () => {
  await A.flushDrafts();
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function existing() {
  const categoryId = useApp.getState().activeId!;
  const { sessions } = await mockRepos.sessions.saveBatch({ categoryId, dates: ['2026-10-01', '2026-10-02'], requestId: 'existing', shared: { notes: 'Originale' } });
  await A.refreshAll();
  return { categoryId, sessions };
}

function select(ids: string[]) {
  A.setHomeSessionMode('edit');
  for (const id of ids) A.toggleBulkSession(id);
}

it('keeps new-session dates/details durable through edit mode and blocks accidental creation', async () => {
  const { categoryId, sessions } = await existing();
  A.toggleDate('2026-10-03');
  A.setPendingDetails({ notes: 'Bozza nuova' });
  await A.flushDrafts();
  const draft = await mockRepos.drafts.get(categoryId);
  select(sessions.map((session) => session.id));
  expect(A.toggleDate('2026-10-04')).toBe(false);
  expect(await A.save()).toBe(false);
  const result = await A.updateSelectedSessions({ categoryId, expected: sessions, patch: { notes: 'Modificate' } });
  expect(result.changed).toBe(2);
  expect(useApp.getState()).toMatchObject({ homeSessionMode: 'edit', bulkSelection: [], selection: ['2026-10-03'], pendingDetails: { notes: 'Bozza nuova' }, bulkSaving: false });
  expect(await mockRepos.drafts.get(categoryId)).toEqual(draft);
  A.setHomeSessionMode('new');
  expect(await A.save()).toBe(true);
  expect(await mockRepos.sessions.listAll()).toHaveLength(3);
});

it('selects same-day records independently and limits select-all to the active activity and date', async () => {
  const { categoryId, sessions } = await existing();
  const otherId = useApp.getState().categories.find((category) => category.id !== categoryId)!.id;
  const duplicate = (await mockRepos.sessions.saveBatch({ categoryId, dates: ['2026-10-01'], requestId: 'duplicate' })).sessions[0];
  const other = (await mockRepos.sessions.saveBatch({ categoryId: otherId, dates: ['2026-10-01'], requestId: 'other' })).sessions[0];
  await A.refreshAll();
  select([duplicate.id, other.id, sessions[1].id]);
  expect(useApp.getState().bulkSelection).toEqual([duplicate.id, sessions[1].id]);
  A.selectBulkDay('2026-10-01', true);
  expect(new Set(useApp.getState().bulkSelection)).toEqual(new Set([...sessions.map((session) => session.id), duplicate.id]));
  A.selectBulkDay('2026-10-01', false);
  expect(useApp.getState().bulkSelection).toEqual([sessions[1].id]);
});

it('exits edit mode on activity switch without consuming either activity draft', async () => {
  const { categoryId, sessions } = await existing();
  const other = useApp.getState().categories.find((category) => category.id !== categoryId)!;
  A.toggleDate('2026-10-03');
  A.setPendingDetails({ notes: 'A' });
  select([sessions[0].id]);
  await A.switchActivity(other.id);
  expect(useApp.getState()).toMatchObject({ homeSessionMode: 'new', bulkSelection: [] });
  A.toggleDate('2026-10-04');
  A.setPendingDetails({ notes: 'B' });
  await A.switchActivity(categoryId);
  expect(useApp.getState()).toMatchObject({ selection: ['2026-10-03'], pendingDetails: { notes: 'A' } });
  expect((await mockRepos.drafts.get(other.id))?.details?.notes).toBe('B');
});

it('rejects a changed selection or activity before writing any row', async () => {
  const { categoryId, sessions } = await existing();
  select([sessions[0].id]);
  await expect(A.updateSelectedSessions({ categoryId, expected: sessions, patch: { notes: 'Wrong targets' } })).rejects.toMatchObject({ code: 'bulk_selection_changed' });
  await A.switchActivity(null);
  await expect(A.updateSelectedSessions({ categoryId, expected: sessions, patch: { notes: 'Wrong activity' } })).rejects.toMatchObject({ code: 'bulk_category_changed' });
  expect(await mockRepos.sessions.listAll()).toEqual(sessions);
});

it('keeps the complete selection on write failure, then supports a safe retry', async () => {
  const { categoryId, sessions } = await existing();
  select(sessions.map((session) => session.id));
  jest.spyOn(mockRepos.sessions, 'updateDetailsBatch').mockRejectedValueOnce(new Error('disk full'));
  const input = { categoryId, expected: sessions, patch: { notes: 'New' } };
  await expect(A.updateSelectedSessions(input)).rejects.toThrow('disk full');
  expect(useApp.getState()).toMatchObject({ bulkSaving: false, bulkSelection: sessions.map((session) => session.id), sessions });
  expect((await A.updateSelectedSessions(input)).changed).toBe(2);
  expect(await mockRepos.sessions.listAll()).toHaveLength(2);
});

it('merges committed records if the follow-up read fails and never invokes new-session export hooks', async () => {
  const { categoryId, sessions } = await existing();
  select(sessions.map((session) => session.id));
  const hook = jest.fn(async () => undefined);
  const off = onCommit(hook);
  jest.spyOn(mockRepos.sessions, 'listAll').mockRejectedValueOnce(new Error('read unavailable'));
  try {
    expect((await A.updateSelectedSessions({ categoryId, expected: sessions, patch: { notes: 'Committed' } })).changed).toBe(2);
    expect(useApp.getState().sessions.every((session) => session.notes === 'Committed')).toBe(true);
    expect(useApp.getState().bulkSelection).toEqual([]);
    expect(hook).not.toHaveBeenCalled();
  } finally { off(); }
});

it('orders edits after an in-flight export and rejects an activity switch while waiting', async () => {
  const { categoryId, sessions } = await existing();
  select(sessions.map((session) => session.id));
  const entered = deferred(), release = deferred();
  const exportWork = withExportLock(mockRepos.exportJobs, async () => { entered.resolve(); await release.promise; });
  await entered.promise;
  const update = jest.spyOn(mockRepos.sessions, 'updateDetailsBatch');
  const work = A.updateSelectedSessions({ categoryId, expected: sessions, patch: { notes: 'After export' } });
  const failed = expect(work).rejects.toMatchObject({ code: 'bulk_category_changed' });
  await Promise.resolve();
  expect(useApp.getState().bulkSaving).toBe(true);
  expect(update).not.toHaveBeenCalled();
  await A.switchActivity(null);
  release.resolve();
  await exportWork;
  await failed;
  expect(update).not.toHaveBeenCalled();
  expect(useApp.getState().bulkSaving).toBe(false);
});

it('queued automatic export reads the edited values; later edits leave exported events unchanged', async () => {
  const { categoryId, sessions } = await existing();
  const provider = new FakeProvider('google', [G_CAL], G_CONN);
  const config = defaultConfig();
  config.enabled = true;
  config.destinations.google = { accountId: EMAIL, calendarId: G_CAL.calendarId, labelId: null };
  await enqueueForSessions(mockRepos, sessions, useApp.getState().categories, config);
  select(sessions.map((session) => session.id));
  const edited = await A.updateSelectedSessions({ categoryId, expected: sessions, patch: { notes: 'Latest local values' } });
  await runJobs({ repos: mockRepos, providers: { google: provider }, now: new Date('2026-10-15T08:00:00Z'), config });
  expect(provider.events).toHaveLength(2);
  expect(provider.events.every((event) => event.notes?.includes('Latest local values'))).toBe(true);
  select(edited.sessions.map((session) => session.id));
  await A.updateSelectedSessions({ categoryId, expected: edited.sessions, patch: { notes: 'Only Serie changes now' } });
  await runJobs({ repos: mockRepos, providers: { google: provider }, now: new Date('2026-10-15T09:00:00Z'), config });
  expect(provider.events).toHaveLength(2);
  expect(provider.events.every((event) => event.notes?.includes('Latest local values'))).toBe(true);
  expect((await mockRepos.exportJobs.list()).every((job) => job.status === 'succeeded')).toBe(true);
});
