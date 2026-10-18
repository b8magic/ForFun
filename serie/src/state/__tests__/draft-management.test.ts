import type { Repositories } from '@/data/repositories';
import { hasDraftDetails } from '@/domain/drafts';
import { DATE_ONLY } from '@/domain/timing';
import * as A from '@/state/actions';
import { useApp } from '@/state/store';
import { testRepos } from '@/test/sqljs';

let mockRepos: Repositories;
jest.mock('@/data/database', () => ({ getRepositories: () => Promise.resolve(mockRepos) }));
jest.mock('@/platform/haptics', () => ({ haptics: new Proxy({}, { get: () => () => undefined }) }));

beforeEach(async () => {
  jest.useFakeTimers();
  mockRepos = await testRepos();
  useApp.setState(useApp.getInitialState());
  await A.boot();
  useApp.setState({ today: '2026-10-12', viewMonth: { y: 2026, m: 10 } });
});

afterEach(async () => {
  await A.flushDrafts();
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function reload() {
  useApp.setState({ status: 'booting', drafts: {}, selection: [], pendingDetails: null });
  await A.boot();
}

async function prepareTwo() {
  const [a, b] = useApp.getState().categories;
  A.toggleDate('2026-10-01');
  A.setPendingDetails({ notes: 'Surf note' });
  await A.switchActivity(b.id);
  A.toggleDate('2026-10-02');
  A.setPendingDetails({ notes: 'Corsa note' });
  await A.flushDrafts();
  return [a, b];
}

it('clears shared dates and legacy snapshots while keeping every activity’s prepared details across reload', async () => {
  const [a, b] = await prepareTwo();
  expect(await A.discardDraftSelection()).toBe(true);
  expect(useApp.getState().selection).toEqual([]);
  expect(useApp.getState().pendingDetails).toEqual({ notes: 'Corsa note' });
  expect((await mockRepos.drafts.list()).every((draft) => draft.dates.length === 0)).toBe(true);
  await reload();
  expect(useApp.getState().selection).toEqual([]);
  expect(useApp.getState().drafts[a.id].details).toEqual({ notes: 'Surf note' });
  expect(useApp.getState().drafts[b.id].details).toEqual({ notes: 'Corsa note' });
});

it('removes one activity’s details without changing the shared dates or the other activity', async () => {
  const [a, b] = await prepareTwo();
  expect(await A.discardActivityDraft(b.id)).toBe(true);
  expect(useApp.getState().pendingDetails).toBeNull();
  expect(useApp.getState().selection).toEqual(['2026-10-01', '2026-10-02']);
  expect(await mockRepos.drafts.get(b.id)).toBeNull();
  await reload();
  expect(useApp.getState().selection).toEqual(['2026-10-01', '2026-10-02']);
  expect(useApp.getState().drafts[a.id].details).toEqual({ notes: 'Surf note' });
  expect(useApp.getState().drafts[b.id]).toBeUndefined();
});

it('keeps the migrated shared dates when deleting a legacy draft before homeSelection was ever stored', async () => {
  const [a, b] = useApp.getState().categories;
  await mockRepos.drafts.put({ categoryId: a.id, dates: ['2026-10-01'], details: { notes: 'A' }, requestId: 'legacy-a', updatedAt: '2026-10-10T00:00:00Z' });
  await mockRepos.drafts.put({ categoryId: b.id, dates: ['2026-10-02'], details: { notes: 'B' }, requestId: 'legacy-b', updatedAt: '2026-10-10T00:00:00Z' });
  await reload();
  expect(await mockRepos.settings.get('homeSelection', null)).toBeNull();
  expect(await A.discardActivityDraft(a.id)).toBe(true);
  await reload();
  expect(useApp.getState().selection).toEqual(['2026-10-01', '2026-10-02']);
});

it('clears all drafts, including snapshot-only rows, without touching recorded sessions', async () => {
  const [a] = await prepareTwo();
  const c = useApp.getState().categories[2];
  await mockRepos.drafts.put({ categoryId: c.id, dates: ['2026-10-03'], details: null, requestId: 'snapshot', updatedAt: '2026-10-10T00:00:00Z' });
  const saved = await mockRepos.sessions.saveBatch({ categoryId: a.id, dates: ['2026-09-30'], requestId: 'recorded', shared: { notes: 'Keep recorded' } });
  await A.boot();
  expect(await A.discardAllDrafts()).toBe(true);
  expect(useApp.getState()).toMatchObject({ selection: [], drafts: {}, pendingDetails: null });
  expect(await mockRepos.drafts.list()).toEqual([]);
  expect(await mockRepos.sessions.listAll()).toEqual(saved.sessions);
  await reload();
  expect(useApp.getState()).toMatchObject({ selection: [], drafts: {}, sessions: saved.sessions });
});

it('retains the failed activity draft and allows a discard retry after a storage error', async () => {
  const [a] = await prepareTwo();
  jest.spyOn(mockRepos.drafts, 'put').mockRejectedValueOnce(new Error('storage unavailable'));
  expect(await A.discardActivityDraft(a.id)).toBe(false);
  expect(useApp.getState().drafts[a.id].details).toEqual({ notes: 'Surf note' });
  expect((await mockRepos.drafts.get(a.id))?.details).toEqual({ notes: 'Surf note' });
  expect(await A.discardActivityDraft(a.id)).toBe(true);
  expect(await mockRepos.drafts.get(a.id)).toBeNull();
});

it('keeps all work if writing the explicit empty selection fails', async () => {
  await prepareTwo();
  jest.spyOn(mockRepos.settings, 'set').mockRejectedValueOnce(new Error('storage unavailable'));
  expect(await A.discardAllDrafts()).toBe(false);
  expect(useApp.getState().selection).toEqual(['2026-10-01', '2026-10-02']);
  expect((await mockRepos.drafts.list())).toHaveLength(2);
  expect(await A.discardAllDrafts()).toBe(true);
});

it('rejects discards while an inactive activity saves', async () => {
  const [a, b] = await prepareTwo();
  useApp.setState((state) => ({ drafts: { ...state.drafts, [a.id]: { ...state.drafts[a.id], saving: true } } }));
  expect(useApp.getState().activeId).toBe(b.id);
  expect(await A.discardDraftSelection()).toBe(false);
  expect(await A.discardActivityDraft(b.id)).toBe(false);
  expect(await A.discardAllDrafts()).toBe(false);
  expect(useApp.getState().selection).toEqual(['2026-10-01', '2026-10-02']);
  expect((await mockRepos.drafts.list())).toHaveLength(2);
});

it('waits for an earlier queued edit before discarding it and blocks overlapping draft edits', async () => {
  const [a] = useApp.getState().categories;
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const put = mockRepos.drafts.put;
  jest.spyOn(mockRepos.drafts, 'put').mockImplementationOnce(async (draft) => { await blocked; return put(draft); });
  A.setPendingDetails({ notes: 'Queued note' });
  const discarding = A.discardAllDrafts();
  A.setPendingDetails({ notes: 'Do not overlap' });
  expect(A.toggleDate('2026-10-01')).toBe(false);
  expect(await A.save()).toBe(false);
  release();
  expect(await discarding).toBe(true);
  expect(await mockRepos.drafts.get(a.id)).toBeNull();
  await reload();
  expect(useApp.getState()).toMatchObject({ selection: [], drafts: {} });
});

it('does not present blank details or old date snapshots as prepared activity details', () => {
  expect(hasDraftDetails(null)).toBe(false);
  expect(hasDraftDetails({ notes: '  ', timing: DATE_ONLY })).toBe(false);
  expect(hasDraftDetails({ notes: 'Note' })).toBe(true);
  expect(hasDraftDetails({ place: { label: null, address: null, mapUrl: null, coords: { lat: 0, lng: 0 }, resolution: 'manual', resolutionNote: null } })).toBe(true);
});
