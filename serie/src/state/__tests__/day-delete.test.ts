import { testRepos } from '@/test/sqljs';
import type { Repositories } from '@/data/repositories';
import { buildDaySummaries } from '@/domain/daySummaries';
import { deleteSession } from '@/state/actions';
import { useApp } from '@/state/store';

let mockRepos: Repositories;
jest.mock('@/data/database', () => ({ getRepositories: () => Promise.resolve(mockRepos) }));
jest.mock('@/platform/haptics', () => ({ haptics: new Proxy({}, { get: () => () => undefined }) }));

beforeEach(async () => {
  mockRepos = await testRepos();
  const surf = await mockRepos.categories.create({ name: 'Surf', color: '#FF4D1F', pattern: 'swell' });
  const corsa = await mockRepos.categories.create({ name: 'Corsa', color: '#C9F06A', pattern: 'stride' });
  await mockRepos.sessions.saveBatch({ categoryId: surf.id, dates: ['2026-10-07', '2026-10-08'], requestId: 'first' });
  await mockRepos.sessions.saveBatch({ categoryId: surf.id, dates: ['2026-10-07'], requestId: 'repeat' });
  await mockRepos.sessions.saveBatch({ categoryId: corsa.id, dates: ['2026-10-07'], requestId: 'other' });
  useApp.setState({ categories: [surf, corsa], sessions: await mockRepos.sessions.listAll(), activeId: null, selection: [], saving: false });
});

afterEach(() => jest.restoreAllMocks());

it('deletes only the chosen session in neutral mode and updates the repeat count without changing the activity geometry', async () => {
  const before = useApp.getState();
  const target = before.sessions.find((session) => session.saveRequestId === 'repeat')!;
  const dayBefore = buildDaySummaries(before.sessions, before.categories).get(target.date)!;
  expect(dayBefore.categories.map((category) => category.count)).toEqual([2, 1]);

  await deleteSession(target.id);

  const after = useApp.getState();
  expect(after.sessions).toEqual(before.sessions.filter((session) => session.id !== target.id));
  expect(await mockRepos.sessions.listAll()).toEqual(after.sessions);
  const dayAfter = buildDaySummaries(after.sessions, after.categories).get(target.date)!;
  expect(dayAfter.categories.map((category) => category.count)).toEqual([1, 1]);
  expect(dayAfter.categories.map((category) => category.categoryId)).toEqual(dayBefore.categories.map((category) => category.categoryId));
  expect(after.activeId).toBeNull();
});

it('keeps the session and its repeat badge count when the deletion fails', async () => {
  const before = useApp.getState();
  const target = before.sessions.find((session) => session.saveRequestId === 'repeat')!;
  jest.spyOn(mockRepos.sessions, 'remove').mockRejectedValueOnce(new Error('disk full'));

  await expect(deleteSession(target.id)).rejects.toThrow('disk full');

  expect(useApp.getState().sessions).toBe(before.sessions);
  expect(await mockRepos.sessions.listAll()).toEqual(before.sessions);
  expect(buildDaySummaries(before.sessions, before.categories).get(target.date)!.categories[0].count).toBe(2);
});
