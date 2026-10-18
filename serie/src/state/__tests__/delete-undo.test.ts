import { testRepos } from '@/test/sqljs';
import type { Repositories } from '@/data/repositories';
import { deleteSession, dismissToast, setScreenReaderActive, showToast, UNDO_WINDOW_MS } from '@/state/actions';
import { onCommit } from '@/state/hooks';
import { useApp } from '@/state/store';
import { withExportLock } from '@/calendar/exportCore';

let mockRepos: Repositories;
jest.mock('@/data/database', () => ({ getRepositories: () => Promise.resolve(mockRepos) }));
jest.mock('@/platform/haptics', () => ({ haptics: new Proxy({}, { get: () => () => undefined }) }));

beforeEach(async () => {
  jest.useFakeTimers();
  setScreenReaderActive(false);
  mockRepos = await testRepos();
  const category = await mockRepos.categories.create({ name: 'Surf', color: '#FF4D1F', pattern: 'swell' });
  const { sessions } = await mockRepos.sessions.saveBatch({ categoryId: category.id, dates: ['2026-10-10'], requestId: 'first', shared: { notes: 'Saved detail' } });
  useApp.setState({ categories: [category], sessions, activeId: category.id, toast: null, openJobs: 0 });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
  setScreenReaderActive(false);
});

it('offers Annulla only after commit and restores the exact row once without running save hooks', async () => {
  const before = useApp.getState();
  const hook = jest.fn(async () => {});
  const off = onCommit(hook);
  try {
    await deleteSession(before.sessions[0].id, { undo: true });
    expect(useApp.getState().sessions).toEqual([]);
    expect(await mockRepos.sessions.listAll()).toEqual([]);
    const toast = useApp.getState().toast!;
    expect(toast.text).toBe('Sessione eliminata');
    expect(toast.action?.label).toBe('Annulla');
    dismissToast(); // the shared host dismisses before invoking the action
    await Promise.all([toast.action!.run(), toast.action!.run()]);
    expect(await mockRepos.sessions.listAll()).toEqual(before.sessions);
    expect(useApp.getState().sessions).toEqual(before.sessions);
    expect(useApp.getState().toast?.text).toBe('Sessione ripristinata');
    expect(useApp.getState().drafts).toBe(before.drafts);
    expect(useApp.getState().selection).toBe(before.selection);
    expect(useApp.getState().breakEvent).toBe(before.breakEvent);
    expect(hook).not.toHaveBeenCalled();
  } finally { off(); }
});

it('does not report success or change state if the deletion fails', async () => {
  const before = useApp.getState().sessions;
  jest.spyOn(mockRepos.sessions, 'removeWithUndo').mockRejectedValueOnce(new Error('disk full'));
  await expect(deleteSession(before[0].id, { undo: true })).rejects.toThrow('disk full');
  expect(useApp.getState().sessions).toBe(before);
  expect(useApp.getState().toast).toBeNull();
  expect(await mockRepos.sessions.listAll()).toEqual(before);
});

it('keeps a committed deletion and restoration usable when follow-up reads fail', async () => {
  const before = useApp.getState().sessions;
  jest.spyOn(mockRepos.sessions, 'listAll').mockRejectedValueOnce(new Error('read failed'));
  await deleteSession(before[0].id, { undo: true });
  const undo = useApp.getState().toast!.action!.run;
  jest.spyOn(mockRepos.sessions, 'listAll').mockRejectedValueOnce(new Error('read failed'));
  await undo();
  expect(useApp.getState().sessions).toEqual(before);
  expect(await mockRepos.sessions.listAll()).toEqual(before);
});

it.each([false, true])('expires Undo with the toast window (screen reader: %s)', async (reader) => {
  setScreenReaderActive(reader);
  const id = useApp.getState().sessions[0].id;
  await deleteSession(id, { undo: true });
  const undo = useApp.getState().toast!.action!.run;
  jest.advanceTimersByTime(UNDO_WINDOW_MS.default + 1);
  if (reader) {
    expect(useApp.getState().toast?.action).toBeDefined();
    jest.advanceTimersByTime(UNDO_WINDOW_MS.screenReader - UNDO_WINDOW_MS.default);
  }
  expect(useApp.getState().toast).toBeNull();
  await undo();
  expect(await mockRepos.sessions.get(id)).toBeNull();
});

it('reports a failed restore visibly when its category no longer exists', async () => {
  const session = useApp.getState().sessions[0];
  await deleteSession(session.id, { undo: true });
  const undo = useApp.getState().toast!.action!.run;
  await mockRepos.categories.remove(session.categoryId);
  await undo();
  expect(await mockRepos.sessions.get(session.id)).toBeNull();
  expect(useApp.getState().sessions).toEqual([]);
  expect(useApp.getState().toast).toMatchObject({ tone: 'error', text: 'Impossibile ripristinare la sessione.' });
});

it('ignores a stale callback after another toast replaces its undo offer', async () => {
  const id = useApp.getState().sessions[0].id;
  await deleteSession(id, { undo: true });
  const undo = useApp.getState().toast!.action!.run;
  showToast('Un altro messaggio');
  await undo();
  expect(await mockRepos.sessions.get(id)).toBeNull();
  expect(useApp.getState().toast?.text).toBe('Un altro messaggio');
});

it('waits for the export lock before deleting, so links cannot arrive behind the receipt', async () => {
  const id = useApp.getState().sessions[0].id;
  let release!: () => void;
  const held = withExportLock(mockRepos.exportJobs, () => new Promise<void>((resolve) => { release = resolve; }));
  await Promise.resolve();
  const remove = jest.spyOn(mockRepos.sessions, 'removeWithUndo');
  const deletion = deleteSession(id, { undo: true });
  await Promise.resolve();
  expect(remove).not.toHaveBeenCalled();
  expect(useApp.getState().toast).toBeNull();
  release();
  await held;
  await deletion;
  expect(remove).toHaveBeenCalledWith(id);
  expect(useApp.getState().toast?.action?.label).toBe('Annulla');
});
