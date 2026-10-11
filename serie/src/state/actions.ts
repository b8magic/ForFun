/**
 * Actions: commit to storage first, then update state. Animations are a
 * consequence of a successful commit, never a condition for it.
 */
import { useApp, type MotionPref, type Place, type TimeScale } from './store';
import type { Category, ID, LocalDate, PatternKind, Session, SessionDetailsDraft } from '@/domain/types';
import { addMonths, compareDates, monthOf, todayIn, type MonthRef } from '@/domain/dates';
import { deviceTimeZone } from '@/domain/zoned';
import { getRepositories } from '@/data/database';
import { bootstrap, KEYS } from '@/data/bootstrap';
import { DomainError, type DeleteStrategy, type SessionPatch } from '@/data/repositories';
import { newId } from '@/platform/ids';
import { haptics } from '@/platform/haptics';
import { t } from '@/i18n/it';
import { afterCommit } from './hooks';

const set = useApp.setState;
const get = useApp.getState;

let toastSeq = 0;
let breakSeq = 0;
/** The request id of the save in flight / last failed save: retries reuse it so a duplicated delivery can't double-insert. */
let pendingRequestId: string | null = null;

export function showToast(text: string, opts: { action?: { label: string; run: () => void }; tone?: 'neutral' | 'error'; ms?: number } = {}) {
  const id = ++toastSeq;
  set({ toast: { id, text, action: opts.action, tone: opts.tone } });
  setTimeout(() => {
    if (get().toast?.id === id) set({ toast: null });
  }, opts.ms ?? 4200);
}

export const dismissToast = () => set({ toast: null });

export function refreshToday() {
  const today = todayIn(deviceTimeZone());
  if (today !== get().today) set({ today });
  return today;
}

export async function boot() {
  try {
    const repos = await getRepositories();
    const b = await bootstrap(repos);
    const sessions = await repos.sessions.listAll();
    const motionPref = await repos.settings.get<MotionPref>('motionPref', 'system');
    const today = todayIn(deviceTimeZone());
    const active = b.categories.find((c) => c.id === b.activeId);
    set({
      status: 'ready',
      categories: b.categories,
      activeId: b.activeId,
      activeNotice: b.changed && active ? t.activeContextChanged(active.name) : null,
      sessions,
      today,
      viewMonth: monthOf(today),
      selection: [],
      pendingDetails: null,
      motionPref,
      openJobs: await repos.exportJobs.countOpen(),
    });
    // the Lineup opens straight into the fallback activity: say so, without blocking it
    const notice = get().activeNotice;
    if (notice) showToast(notice, { ms: 8000 });
  } catch (e) {
    set({ status: 'error', bootError: e instanceof Error ? e.message : String(e) });
  }
}

async function reloadSessions() {
  const repos = await getRepositories();
  set({ sessions: await repos.sessions.listAll() });
}

async function reloadCategories() {
  const repos = await getRepositories();
  set({ categories: await repos.categories.list() });
}

// ─── Lineup ──────────────────────────────────────────────────────────────────

export function toggleDate(date: LocalDate): boolean {
  const { selection, today, activeId, saving } = get();
  if (!activeId || saving) return false;
  if (compareDates(date, today) > 0) return false; // future dates cannot be logged
  const on = selection.includes(date);
  const next = on ? selection.filter((d) => d !== date) : [...selection, date].sort();
  set({ selection: next, saveError: null });
  pendingRequestId = null;
  if (on) haptics.release();
  else haptics.crest();
  return !on;
}

export function clearSelection() {
  set({ selection: [], pendingDetails: null, saveError: null });
  pendingRequestId = null;
}

export function setViewMonth(m: MonthRef) {
  const today = get().today;
  const cur = monthOf(today);
  // never navigate into months that are entirely in the future
  const capped = m.y * 12 + m.m > cur.y * 12 + cur.m ? cur : m;
  set({ viewMonth: capped });
}

export const shiftMonth = (n: number) => setViewMonth(addMonths(get().viewMonth, n));
export const goToday = () => setViewMonth(monthOf(refreshToday()));

export function setPendingDetails(d: SessionDetailsDraft | null) {
  set({ pendingDetails: d });
  pendingRequestId = null;
}

export async function switchActivity(id: ID) {
  const { activeId, categories } = get();
  if (!categories.some((c) => c.id === id)) return;
  if (id !== activeId) {
    // Persist the remembered activity immediately; selection never carries across activities.
    const repos = await getRepositories();
    await repos.settings.set(KEYS.lastActive, id);
    set({ activeId: id, selection: [], pendingDetails: null, activeNotice: null, saveError: null });
    pendingRequestId = null;
    haptics.select();
  }
  set({ switcherOpen: false });
}

export const openSwitcher = () => set({ switcherOpen: true });
export const closeSwitcher = () => set({ switcherOpen: false });

/** Commit the selection. Resolves true when the data is persisted. */
export async function save(): Promise<boolean> {
  const s = get();
  if (s.saving || !s.selection.length) return false;
  const category = s.categories.find((c) => c.id === s.activeId);
  if (!category) {
    set({ saveError: t.noActivitiesBody });
    return false;
  }
  const requestId = pendingRequestId ?? newId();
  pendingRequestId = requestId;
  const dates = s.selection.slice();
  set({ saving: true, saveError: null });
  try {
    const repos = await getRepositories();
    const res = await repos.sessions.saveBatch({ categoryId: category.id, dates, requestId, shared: s.pendingDetails ?? undefined });
    pendingRequestId = null;
    const sessions = await repos.sessions.listAll();
    set({
      sessions,
      selection: [],
      pendingDetails: null,
      saving: false,
      lastSave: { requestId, ids: res.sessions.map((x) => x.id), count: res.sessions.length, categoryId: category.id, at: Date.now() },
      highlightSaveId: requestId,
      breakEvent: { id: ++breakSeq, categoryId: category.id, color: category.color, dates, month: s.viewMonth },
    });
    setTimeout(() => {
      if (get().highlightSaveId === requestId) set({ highlightSaveId: null });
    }, 15000);
    haptics.success();
    showToast(t.saved(res.sessions.length, category.name), { action: { label: t.undo, run: () => void undoLastSave() }, ms: 6000 });
    afterCommit(res.sessions).catch(() => undefined); // calendar auto-export never blocks or undoes a local save
    return true;
  } catch (e) {
    set({ saving: false, saveError: t.saveFailed });
    haptics.error();
    if (!(e instanceof DomainError)) console.warn('save failed', e);
    return false;
  }
}

/** Undo the most recent save (deletes exactly the sessions it created). */
export async function undoLastSave() {
  const ls = get().lastSave;
  if (!ls) return;
  const repos = await getRepositories();
  await repos.sessions.remove(ls.ids);
  set({ lastSave: null });
  await reloadSessions();
  showToast(t.undone);
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function updateSession(id: ID, patch: SessionPatch): Promise<Session> {
  const repos = await getRepositories();
  const s = await repos.sessions.update(id, patch);
  await reloadSessions();
  return s;
}

export async function deleteSession(id: ID) {
  const repos = await getRepositories();
  await repos.sessions.remove([id]);
  await reloadSessions();
}

// ─── Activities ──────────────────────────────────────────────────────────────

export async function createCategory(input: { name: string; color: string; pattern: PatternKind }): Promise<Category> {
  const repos = await getRepositories();
  const c = await repos.categories.create(input);
  await reloadCategories();
  if (!get().activeId) await switchActivity(c.id);
  return c;
}

export async function updateCategory(id: ID, patch: { name?: string; color?: string; pattern?: PatternKind }) {
  const repos = await getRepositories();
  await repos.categories.update(id, patch);
  await reloadCategories();
}

export async function reorderCategories(ids: ID[]) {
  const repos = await getRepositories();
  await repos.categories.reorder(ids);
  await reloadCategories();
}

export async function deleteCategory(id: ID, strategy?: DeleteStrategy) {
  const repos = await getRepositories();
  await repos.categories.remove(id, strategy);
  const categories = await repos.categories.list();
  const sessions = await repos.sessions.listAll();
  let { activeId } = get();
  let notice: string | null = null;
  if (activeId === id) {
    activeId = categories[0]?.id ?? null;
    await repos.settings.set(KEYS.lastActive, activeId);
    if (categories[0]) notice = t.activeContextChanged(categories[0].name);
  }
  set({ categories, sessions, activeId, activeNotice: notice, selection: activeId === get().activeId ? get().selection : [] });
}

export async function sessionCount(id: ID) {
  const repos = await getRepositories();
  return repos.categories.sessionCount(id);
}

// ─── Places & preferences ────────────────────────────────────────────────────

export const setPlace = (place: Place) => set({ place, switcherOpen: false });
export const setTimeScale = (timeScale: TimeScale) => set({ timeScale });
export const focusHistoryMonth = (key: string) => set({ place: 'time', timeScale: 'month', historyFocus: { key, nonce: Date.now() } });

export async function setMotionPref(motionPref: MotionPref) {
  const repos = await getRepositories();
  await repos.settings.set('motionPref', motionPref);
  set({ motionPref });
}

export async function refreshAll() {
  await reloadCategories();
  await reloadSessions();
  const repos = await getRepositories();
  set({ openJobs: await repos.exportJobs.countOpen() });
}
