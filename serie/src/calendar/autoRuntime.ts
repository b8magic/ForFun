/**
 * App glue for automatic export (the engine is src/calendar/autoExport.ts).
 *
 *   - After every local commit: if automatic export is ON, queue jobs for the
 *     new sessions. Saving never waits for this and never fails because of it.
 *   - Jobs run a few seconds later (after the "Annulla" window, so an undone
 *     save is cancelled by the engine instead of exported), when the app
 *     returns to the foreground, when the network comes back, and every
 *     minute while open jobs exist.
 *   - Providers are created lazily, only when there is something to run, so a
 *     user who never enabled calendars loads nothing and sees no prompts.
 */
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import type { Session } from '@/domain/types';
import { getRepositories } from '@/data/database';
import { onCommit } from '@/state/hooks';
import { useApp } from '@/state/store';
import { enqueueForSessions, loadConfig, runJobs } from './autoExport';
import { getProviders } from './registry';

const RUN_AFTER_COMMIT_MS = 6500;
const PERIODIC_MS = 60_000;

let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let periodic: ReturnType<typeof setInterval> | null = null;
let running = false;

async function refreshOpenJobs() {
  try {
    const repos = await getRepositories();
    useApp.setState({ openJobs: await repos.exportJobs.countOpen() });
  } catch {
    // the badge is informational
  }
}

async function online(): Promise<boolean> {
  try {
    const s = await Network.getNetworkStateAsync();
    return s.isConnected !== false && s.isInternetReachable !== false;
  } catch {
    return true; // unknown → let the provider call decide (offline errors keep jobs pending)
  }
}

/** Process due jobs now (no-op when nothing is open). */
export async function runAutoExportNow(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const repos = await getRepositories();
    if (!(await repos.exportJobs.countOpen())) return;
    const providers = await getProviders();
    await runJobs({ repos, providers, isOnline: online });
  } catch (e) {
    console.warn('auto export run failed', e);
  } finally {
    running = false;
    await refreshOpenJobs();
  }
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    runAutoExportNow();
  }, ms);
}

/** Queue automatic export for sessions that were just committed (used by the commit hook and by imports). */
export async function enqueueAfterCommit(sessions: Session[]): Promise<void> {
  if (!sessions.length) return;
  const repos = await getRepositories();
  const config = await loadConfig(repos);
  if (!config.enabled) return;
  const res = await enqueueForSessions(repos, sessions, useApp.getState().categories, config);
  await refreshOpenJobs();
  if (res.created || res.jobs.length) schedule(RUN_AFTER_COMMIT_MS);
}

export function startAutoExportRuntime(): () => void {
  if (started) return () => undefined;
  started = true;
  const offCommit = onCommit(enqueueAfterCommit);
  const appState = AppState.addEventListener('change', (s) => {
    if (s === 'active') schedule(800);
  });
  let net: { remove(): void } | null = null;
  try {
    let wasOnline = true;
    net = Network.addNetworkStateListener((e) => {
      const now = e.isConnected !== false && e.isInternetReachable !== false;
      if (now && !wasOnline) schedule(1500);
      wasOnline = now;
    });
  } catch {
    net = null; // not available on this platform: foreground + periodic runs still cover it
  }
  periodic = setInterval(() => {
    if (AppState.currentState === 'active' && useApp.getState().openJobs > 0) runAutoExportNow();
  }, PERIODIC_MS);
  schedule(3000);
  return () => {
    offCommit();
    appState.remove();
    net?.remove();
    if (periodic) clearInterval(periodic);
    if (timer) clearTimeout(timer);
    started = false;
  };
}
