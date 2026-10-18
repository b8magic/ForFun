import { AppState, type AppStateStatus } from 'react-native';
import * as Network from 'expo-network';
import type { Repositories } from '@/data/repositories';
import type { Session } from '@/domain/types';
import { testRepos } from '@/test/sqljs';
import { useApp } from '@/state/store';
import { afterCommit, onCommit } from '@/state/hooks';
import * as actions from '@/state/actions';
import { defaultConfig, resolveReviewJob, saveConfig } from '../autoExport';
import { enqueueAfterCommit, runAutoExportNow, startAutoExportRuntime } from '../autoRuntime';
import { FakeProvider, G_CAL, G_CONN, G_REF } from './fakeCalendar';

let mockRepos: Repositories;
let mockGoogle: FakeProvider;
jest.mock('@/data/database', () => ({ getRepositories: () => Promise.resolve(mockRepos) }));
jest.mock('@/platform/haptics', () => ({ haptics: new Proxy({}, { get: () => () => undefined }) }));
jest.mock('../registry', () => ({ getProviders: () => Promise.resolve({ google: mockGoogle }) }));
jest.mock('../authRedirect', () => ({ completePendingAuthRedirect: () => undefined }));
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const NOW = new Date('2026-10-10T09:00:00.000Z');
const EXPORT_DELAY_MS = 14_000;
let appStateChanged: (state: AppStateStatus) => void;
let originalAppState: AppStateStatus;
let networkChanged: Parameters<typeof Network.addNetworkStateListener>[0];
let stopRuntime: (() => void) | undefined;
let request = 0;

beforeEach(async () => {
  // Initialize WASM before installing fake timers; its loader needs the real event loop.
  mockRepos = await testRepos({ now: () => new Date().toISOString() });
  jest.useFakeTimers({ now: NOW });
  mockGoogle = new FakeProvider('google', [G_CAL], G_CONN);
  originalAppState = AppState.currentState;
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    appStateChanged = listener;
    return { remove: jest.fn() };
  });
  jest.mocked(Network.addNetworkStateListener).mockImplementation((listener) => {
    networkChanged = listener;
    return { remove: jest.fn() };
  });
  useApp.setState({ status: 'booting', selection: [], sessions: [], categories: [], activeId: null, lastSave: null, saving: false, saveError: null, pendingDetails: null, toast: null, openJobs: 0 });
  actions.setScreenReaderActive(false);
  await actions.boot();
  await saveConfig(mockRepos, { ...defaultConfig(), enabled: true, destinations: { google: { ...G_REF, labelId: null } } });
  stopRuntime = startAutoExportRuntime();
});

afterEach(async () => {
  stopRuntime?.();
  stopRuntime = undefined;
  jest.clearAllTimers();
  actions.setScreenReaderActive(false);
  jest.useRealTimers();
  jest.restoreAllMocks();
  AppState.currentState = originalAppState;
  await mockRepos.db.close();
});

async function saveSession(): Promise<Session> {
  const saved = await mockRepos.sessions.saveBatch({ categoryId: useApp.getState().activeId!, dates: ['2026-10-05'], requestId: `runtime-${++request}` });
  return saved.sessions[0];
}

it('makes a job safe before enqueue returns, including a runner interleaving with the commit hook', async () => {
  const session = await saveSession();
  const enqueue = mockRepos.exportJobs.enqueue;
  jest.spyOn(mockRepos.exportJobs, 'enqueue').mockImplementation(async (job) => {
    const queued = await enqueue(job);
    // A foreground run can observe the row as soon as its INSERT commits.
    await runAutoExportNow();
    return queued;
  });
  await enqueueAfterCommit([session]);
  expect(await mockRepos.exportJobs.list()).toEqual([
    expect.objectContaining({ sessionId: session.id, status: 'pending', attempts: 0, nextAttemptAt: new Date(NOW.getTime() + EXPORT_DELAY_MS).toISOString() }),
  ]);
  expect(mockGoogle.count('createEvent')).toBe(0);
  await jest.advanceTimersByTimeAsync(EXPORT_DELAY_MS - 1);
  expect(mockGoogle.count('createEvent')).toBe(0);
  await jest.advanceTimersByTimeAsync(1);
  expect(mockGoogle.count('createEvent')).toBe(1);
});

it('keeps new jobs out of foreground, reconnect and periodic runs throughout both Undo windows', async () => {
  // The next minute tick will land five seconds after this save.
  await jest.advanceTimersByTimeAsync(55_000);
  const session = await saveSession();
  await afterCommit([session]);
  const committedAt = Date.now();

  appStateChanged('active');
  await jest.advanceTimersByTimeAsync(800);
  networkChanged({ isConnected: false, isInternetReachable: false });
  networkChanged({ isConnected: true, isInternetReachable: true });
  await jest.advanceTimersByTimeAsync(1500);
  await jest.advanceTimersByTimeAsync(2700); // periodic run at +5 s

  for (const elapsed of [6000, 12000, EXPORT_DELAY_MS - 1]) {
    await jest.advanceTimersByTimeAsync(committedAt + elapsed - Date.now());
    expect(await mockRepos.exportJobs.due(new Date().toISOString())).toEqual([]);
    expect(mockGoogle.count('createEvent')).toBe(0);
  }
  await jest.advanceTimersByTimeAsync(1);
  expect(await mockRepos.exportJobs.due(new Date().toISOString())).toHaveLength(1);
  await runAutoExportNow();
  expect(mockGoogle.count('createEvent')).toBe(1);
  expect(mockGoogle.events[0].appMeta?.sessionId).toBe(session.id);
});

it.each([
  ['ordinary', false, 6000],
  ['VoiceOver', true, 12000],
] as const)('never exports a retried save undone at the end of the %s window', async (_name, screenReader, undoWindow) => {
  actions.setScreenReaderActive(screenReader);
  let offCommit: () => void = () => undefined;
  const queued = new Promise<void>((resolve) => {
    offCommit = onCommit(async () => resolve());
  });
  try {
    actions.toggleDate('2026-10-05');
    expect(await actions.save()).toBe(true);
    await queued;
  } finally {
    offCommit();
  }
  const session = useApp.getState().sessions[0];
  const undo = useApp.getState().toast?.action;
  expect(undo).toBeDefined();
  const jobs = await mockRepos.exportJobs.list();
  expect(jobs).toHaveLength(1);
  await jest.advanceTimersByTimeAsync(3000);
  await resolveReviewJob(mockRepos, jobs[0].id, { kind: 'retry' });
  await runAutoExportNow();
  expect(mockGoogle.count('createEvent')).toBe(0);
  await jest.advanceTimersByTimeAsync(undoWindow - 3001);
  expect(mockGoogle.count('createEvent')).toBe(0);

  const remove = mockRepos.sessions.remove;
  const removed = new Promise<void>((resolve) => {
    jest.spyOn(mockRepos.sessions, 'remove').mockImplementation(async (ids) => {
      const count = await remove(ids);
      resolve();
      return count;
    });
  });
  undo!.run();
  await removed;
  expect(await mockRepos.sessions.get(session.id)).toBeNull();
  expect(await mockRepos.exportJobs.list()).toEqual([]);
  await jest.advanceTimersByTimeAsync(EXPORT_DELAY_MS - undoWindow + 1);
  await runAutoExportNow();
  expect(mockGoogle.count('createEvent')).toBe(0);
});
