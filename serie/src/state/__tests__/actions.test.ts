/**
 * Store actions against a real (sql.js) database: commit-before-success,
 * failure recovery with the selection preserved, idempotent retries,
 * undo, activity switching and deleted-activity fallback.
 */
import { testRepos } from '@/test/sqljs';
import type { Repositories } from '@/data/repositories';

import { useApp } from '@/state/store';
import * as A from '@/state/actions';
import { onCommit } from '@/state/hooks';

let mockRepos: Repositories;
jest.mock('@/data/database', () => ({ getRepositories: () => Promise.resolve(mockRepos) }));
jest.mock('@/platform/haptics', () => ({ haptics: new Proxy({}, { get: () => () => undefined }) }));

beforeEach(async () => {
  mockRepos = await testRepos();
  useApp.setState({ status: 'booting', selection: [], sessions: [], categories: [], activeId: null, lastSave: null, saving: false, saveError: null, pendingDetails: null });
  await A.boot();
  useApp.setState({ today: '2026-10-11', viewMonth: { y: 2026, m: 10 } });
});

describe('save', () => {
  it('commits before reporting success and clears the selection', async () => {
    A.toggleDate('2026-10-03');
    A.toggleDate('2026-10-06');
    expect(useApp.getState().selection).toEqual(['2026-10-03', '2026-10-06']);
    const ok = await A.save();
    expect(ok).toBe(true);
    expect((await mockRepos.sessions.listAll()).map((s) => s.date)).toEqual(['2026-10-03', '2026-10-06']);
    const s = useApp.getState();
    expect(s.selection).toEqual([]);
    expect(s.sessions).toHaveLength(2);
    expect(s.breakEvent?.dates).toEqual(['2026-10-03', '2026-10-06']);
  });

  it('keeps the selection and offers a retry when the commit fails; the retry cannot duplicate', async () => {
    A.toggleDate('2026-10-03');
    const spy = jest.spyOn(mockRepos.sessions, 'saveBatch').mockRejectedValueOnce(new Error('disk full'));
    const ok = await A.save();
    expect(ok).toBe(false);
    expect(useApp.getState().selection).toEqual(['2026-10-03']);
    expect(useApp.getState().saveError).toBeTruthy();
    expect(await mockRepos.sessions.listAll()).toHaveLength(0);
    const firstReq = spy.mock.calls[0][0].requestId;
    spy.mockRestore();
    const spy2 = jest.spyOn(mockRepos.sessions, 'saveBatch');
    expect(await A.save()).toBe(true);
    expect(spy2.mock.calls[0][0].requestId).toBe(firstReq); // same request id → idempotent
    expect(await mockRepos.sessions.listAll()).toHaveLength(1);
  });

  it('a failure after the commit (refreshing the list) is still a success: no error, no retry, no duplicate', async () => {
    A.toggleDate('2026-10-04');
    jest.spyOn(mockRepos.sessions, 'listAll').mockRejectedValueOnce(new Error('read failed'));
    expect(await A.save()).toBe(true);
    const s = useApp.getState();
    expect(s.saveError).toBeNull();
    expect(s.selection).toEqual([]);
    expect(s.sessions.map((x) => x.date)).toEqual(['2026-10-04']);
    expect(await A.save()).toBe(false); // nothing left to save
    expect(await mockRepos.sessions.listAll()).toHaveLength(1);
  });

  it('never selects future dates', () => {
    expect(A.toggleDate('2026-10-12')).toBe(false);
    expect(useApp.getState().selection).toEqual([]);
  });

  it('undo removes exactly the sessions of the last save', async () => {
    A.toggleDate('2026-10-01');
    await A.save();
    A.toggleDate('2026-10-02');
    await A.save();
    await A.undoLastSave();
    expect((await mockRepos.sessions.listAll()).map((s) => s.date)).toEqual(['2026-10-01']);
  });

  it('applies explicit shared details to each saved session', async () => {
    A.toggleDate('2026-10-01');
    A.toggleDate('2026-10-02');
    A.setPendingDetails({ notes: 'Onda lunga' });
    await A.save();
    const all = await mockRepos.sessions.listAll();
    expect(all.map((s) => s.notes)).toEqual(['Onda lunga', 'Onda lunga']);
    expect(useApp.getState().pendingDetails).toBeNull();
  });

  it('a failing post-commit hook (auto-export) never undoes or fails the save', async () => {
    const off = onCommit(async () => {
      throw new Error('calendar offline');
    });
    A.toggleDate('2026-10-04');
    expect(await A.save()).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(await mockRepos.sessions.listAll()).toHaveLength(1);
    off();
  });
});

describe('activity context', () => {
  it('switching persists the remembered activity and projects its own empty draft', async () => {
    const corsa = useApp.getState().categories.find((c) => c.name === 'Corsa')!;
    A.toggleDate('2026-10-01');
    await A.switchActivity(corsa.id);
    expect(useApp.getState().selection).toEqual([]);
    expect(await mockRepos.settings.get('lastActiveCategoryId', null)).toBe(corsa.id);
  });

  it('deleting the active activity moves to a remaining one with a visible notice', async () => {
    const surf = useApp.getState().activeId!;
    await A.deleteCategory(surf);
    const s = useApp.getState();
    expect(s.activeId).not.toBe(surf);
    expect(s.activeNotice).toMatch(/non esiste più/);
    expect(await mockRepos.settings.get('lastActiveCategoryId', null)).toBe(s.activeId);
  });
});
