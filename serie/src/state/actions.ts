/**
 * Actions: saved records and animations follow successful storage commits.
 * Draft edits render immediately and persist in order before any local save.
 */
import { AccessibilityInfo } from 'react-native';
import { decodeHomeActivitiesMode, decodeMotionPref, decodeThemePref, useApp, type ActivityDraft, type AppState, type HomeActivitiesMode, type HomeSessionMode, type LastSave, type MotionPref, type Place, type ThemePref, type TimeScale } from './store';
import type { Category, ID, LocalDate, NamedPeriodInput, NamedPeriodPatch, PatternKind, Session, SessionDetailsDraft } from '@/domain/types';
import { addMonths, compareDates, isLocalDate, monthOf, todayIn, type MonthRef } from '@/domain/dates';
import { deviceTimeZone } from '@/domain/zoned';
import { getRepositories } from '@/data/database';
import { bootstrap, KEYS } from '@/data/bootstrap';
import { DomainError, type DeleteStrategy, type Repositories, type SessionPatch } from '@/data/repositories';
import { newId } from '@/platform/ids';
import { haptics } from '@/platform/haptics';
import { t } from '@/i18n/it';
import { afterCommit } from './hooks';
import type { BulkDetailsInput } from '@/domain/bulkDetails';
import { withExportLock } from '@/calendar/exportCore';

const set = useApp.setState;
const get = useApp.getState;

let toastSeq = 0;
let breakSeq = 0;
const draftWrites = new Map<ID, Promise<void>>();
let activityWrite: Promise<void> = Promise.resolve();
let sessionsRead = 0;
let categoriesRead = 0;
let periodsRead = 0;
let jobsRead = 0;
let draftsRevision = 0;
let activeRevision = 0;
let viewMonthRevision = 0;
const preferenceRevision = { motion: 0, theme: 0, activities: 0 };
let bootTask: Promise<void> | null = null;
const undoing = new Set<string>();

function draftProjection(drafts: AppState['drafts'], activeId: ID | null) {
  const draft = activeId ? drafts[activeId] : undefined;
  return { selection: draft?.dates ?? [], pendingDetails: draft?.details ?? null, saving: draft?.saving ?? false, saveError: draft?.saveError ?? null };
}

function changeDraft(categoryId: ID, change: (draft: ActivityDraft | undefined) => ActivityDraft | undefined) {
  draftsRevision++;
  set((state) => {
    const next = change(state.drafts[categoryId]);
    const drafts = { ...state.drafts };
    if (next) drafts[categoryId] = next;
    else delete drafts[categoryId];
    return { drafts, ...draftProjection(drafts, state.activeId) };
  });
}

function rememberActivity(id: ID | null, repositories = getRepositories()): Promise<void> {
  activityWrite = activityWrite.catch(() => undefined).then(async () => (await repositories).settings.set(KEYS.lastActive, id));
  return activityWrite;
}

/** UI changes are immediate; writes are ordered per activity and awaited before saving. */
function persistDraft(draft: ActivityDraft): Promise<void> {
  const repositories = getRepositories();
  const previous = draftWrites.get(draft.categoryId) ?? Promise.resolve();
  const write = previous.catch(() => undefined).then(async () => (await repositories).drafts.put(draft));
  draftWrites.set(draft.categoryId, write);
  const cleanup = () => { if (draftWrites.get(draft.categoryId) === write) draftWrites.delete(draft.categoryId); };
  void write.then(cleanup, () => {
    cleanup();
    changeDraft(draft.categoryId, (current) => current?.requestId === draft.requestId ? { ...current, saveError: t.saveFailed } : current);
  });
  return write;
}

/** Useful at lifecycle boundaries; local saves always await their own draft as well. */
export async function flushDrafts(): Promise<void> {
  await Promise.all([...draftWrites.values()]);
}

function editDraft(categoryId: ID, dates: LocalDate[], details: SessionDetailsDraft | null) {
  const current = get().drafts[categoryId];
  const draft: ActivityDraft = {
    categoryId, dates, details, requestId: newId(), updatedAt: new Date().toISOString(),
    saving: current?.saving ?? false, saveError: null,
  };
  changeDraft(categoryId, () => draft);
  void persistDraft(draft).catch(() => undefined); // the isolated draft exposes the write failure
}

let screenReader = false;
/** Kept in sync by the Toast host (AccessibilityInfo). */
export const setScreenReaderActive = (on: boolean) => {
  screenReader = on;
};
/** How long "Annulla" stays available after a save (longer with VoiceOver). Auto-export waits longer than this. */
export const UNDO_WINDOW_MS = { default: 6000, screenReader: 12000 } as const;

export function showToast(text: string, opts: { action?: { label: string; run: () => void }; tone?: 'neutral' | 'error'; ms?: number } = {}) {
  const id = ++toastSeq;
  set({ toast: { id, text, action: opts.action, tone: opts.tone } });
  const base = opts.ms ?? 4200;
  // with VoiceOver an action toast stays until it has been heard and reached
  const ms = screenReader && opts.action ? Math.max(base, UNDO_WINDOW_MS.screenReader) : base;
  setTimeout(() => {
    if (get().toast?.id === id) set({ toast: null });
  }, ms);
}

export const dismissToast = () => set({ toast: null });

export function refreshToday() {
  const today = todayIn(deviceTimeZone());
  if (today !== get().today) set({ today });
  return today;
}

/** Initialization is shared; a delayed hydration never replaces newer user work. */
export function boot(): Promise<void> {
  if (bootTask) return bootTask;
  const task = hydrate();
  bootTask = task;
  void task.then(() => { if (bootTask === task) bootTask = null; });
  return task;
}

async function hydrate() {
  try {
    await flushDrafts();
    await activityWrite;
    const repos = await getRepositories();
    const snapshot = {
      categories: ++categoriesRead, sessions: ++sessionsRead, periods: ++periodsRead, jobs: ++jobsRead,
      drafts: draftsRevision, active: activeRevision, viewMonth: viewMonthRevision,
      preferences: { ...preferenceRevision },
    };
    // Remember the final, current activity through the same queue as switches.
    const b = await bootstrap(repos, { rememberResolution: false });
    const [sessions, persistedDrafts, namedPeriods, motionValue, themeValue, activitiesValue, openJobs] = await Promise.all([
      repos.sessions.listAll(), repos.drafts.list(), repos.periods.list(),
      repos.settings.get<unknown>('motionPref', 'system'), repos.settings.get<unknown>('themePref', 'cream'),
      repos.settings.get<unknown>('homeActivitiesMode', 'all'), repos.exportJobs.countOpen(),
    ]);
    const today = todayIn(deviceTimeZone());
    let remembered: ID | null = null;
    set((state) => {
      const categories = snapshot.categories === categoriesRead ? b.categories : state.categories;
      const preferred = snapshot.active === activeRevision ? b.activeId : state.activeId;
      const active = preferred === null ? null : categories.find((category) => category.id === preferred) ?? categories[0] ?? null;
      const activeId = active?.id ?? null;
      const activeNotice = snapshot.active === activeRevision ? (b.changed && active ? t.activeContextChanged(active.name) : null) : state.activeNotice;
      if (activeId !== state.activeId) activeRevision++;
      remembered = activeId;
      let drafts = state.drafts;
      if (snapshot.drafts === draftsRevision) {
        drafts = {};
        for (const draft of persistedDrafts) {
          if (!categories.some((category) => category.id === draft.categoryId)) continue;
          const current = state.drafts[draft.categoryId];
          const sameRequest = current?.requestId === draft.requestId;
          drafts[draft.categoryId] = { ...draft, saving: sameRequest ? current.saving : false, saveError: sameRequest ? current.saveError : null };
        }
        draftsRevision++;
      }
      return {
        status: 'ready', bootError: null, categories, activeId, activeNotice, drafts, today,
        sessions: snapshot.sessions === sessionsRead ? sessions : state.sessions,
        namedPeriods: snapshot.periods === periodsRead ? namedPeriods : state.namedPeriods,
        viewMonth: snapshot.viewMonth === viewMonthRevision ? monthOf(today) : state.viewMonth,
        ...draftProjection(drafts, activeId),
        motionPref: snapshot.preferences.motion === preferenceRevision.motion ? decodeMotionPref(motionValue) : state.motionPref,
        themePref: snapshot.preferences.theme === preferenceRevision.theme ? decodeThemePref(themeValue) : state.themePref,
        homeActivitiesMode: snapshot.preferences.activities === preferenceRevision.activities ? decodeHomeActivitiesMode(activitiesValue) : state.homeActivitiesMode,
        openJobs: snapshot.jobs === jobsRead ? openJobs : state.openJobs,
      };
    });
    const remembering = rememberActivity(remembered, Promise.resolve(repos));
    // the Lineup opens straight into the fallback activity: say so, without blocking it
    const notice = get().activeNotice;
    if (notice) showToast(notice, { ms: 8000 });
    await remembering;
  } catch (e) {
    // An unsuccessful later hydration cannot replace an already usable app.
    if (get().status !== 'ready') set({ status: 'error', bootError: e instanceof Error ? e.message : String(e) });
  }
}

async function reloadSessions() {
  const request = ++sessionsRead;
  const repos = await getRepositories();
  const sessions = await repos.sessions.listAll();
  if (request === sessionsRead) set({ sessions });
}

async function reloadCategories() {
  const request = ++categoriesRead;
  const repos = await getRepositories();
  const categories = await repos.categories.list();
  if (request === categoriesRead) set({ categories });
}

async function reloadOpenJobs() {
  const request = ++jobsRead;
  const repos = await getRepositories();
  const openJobs = await repos.exportJobs.countOpen();
  if (request === jobsRead) set({ openJobs });
}

async function reloadPeriods() {
  const request = ++periodsRead;
  const repos = await getRepositories();
  const namedPeriods = await repos.periods.list();
  if (request === periodsRead) set({ namedPeriods });
}

// ─── Lineup ──────────────────────────────────────────────────────────────────

export function toggleDate(date: LocalDate): boolean {
  const { selection, today, activeId, saving, homeSessionMode } = get();
  if (!activeId || saving || homeSessionMode === 'edit') return false;
  if (!isLocalDate(date) || compareDates(date, today) > 0) return false; // future dates cannot be logged
  const on = selection.includes(date);
  const next = on ? selection.filter((d) => d !== date) : [...selection, date].sort();
  editDraft(activeId, next, get().pendingDetails);
  if (on) haptics.release();
  else haptics.crest();
  return !on;
}

export function clearSelection() {
  const activeId = get().activeId;
  if (activeId) editDraft(activeId, [], null);
}

export function setViewMonth(m: MonthRef) {
  const today = get().today;
  const cur = monthOf(today);
  // never navigate into months that are entirely in the future
  const capped = m.y * 12 + m.m > cur.y * 12 + cur.m ? cur : m;
  viewMonthRevision++;
  set({ viewMonth: capped });
}

export const shiftMonth = (n: number) => setViewMonth(addMonths(get().viewMonth, n));
export const goToday = () => setViewMonth(monthOf(refreshToday()));

export function setPendingDetails(d: SessionDetailsDraft | null) {
  const state = get();
  if (state.activeId) editDraft(state.activeId, state.selection, d ? JSON.parse(JSON.stringify(d)) as SessionDetailsDraft : null);
}

export async function switchActivity(id: ID | null) {
  const { activeId, categories } = get();
  if (id !== null && !categories.some((c) => c.id === id)) return;
  if (id !== activeId) {
    activeRevision++;
    set((state) => ({ activeId: id, ...draftProjection(state.drafts, id), activeNotice: null, switcherOpen: false, homeSessionMode: 'new', bulkSelection: [] }));
    const remembering = rememberActivity(id);
    haptics.select();
    await Promise.all([remembering, flushDrafts()]);
  }
  set({ switcherOpen: false });
}

export const openSwitcher = () => set({ switcherOpen: true });
export const closeSwitcher = () => set({ switcherOpen: false });

/** Commit the selection. Resolves true when the data is persisted. */
export async function save(): Promise<boolean> {
  const s = get();
  if (s.saving || !s.selection.length || s.homeSessionMode === 'edit') return false;
  const category = s.categories.find((c) => c.id === s.activeId);
  if (!category) {
    set({ saveError: t.noActivitiesBody });
    return false;
  }
  const draft = s.drafts[category.id];
  if (!draft) return false;
  const requestId = draft.requestId;
  const dates = s.selection.slice();
  changeDraft(category.id, (current) => current ? { ...current, saving: true, saveError: null } : current);
  let res: Awaited<ReturnType<Repositories['sessions']['saveBatch']>>;
  let repos: Repositories;
  try {
    // Queue the captured value before yielding, so a later edit always writes after it.
    const persisted = persistDraft(draft);
    repos = await getRepositories();
    // A failed draft write can be retried without changing its request identity.
    await persisted;
    res = await repos.sessions.saveBatch({ categoryId: category.id, dates, requestId, shared: draft.details ?? undefined, consumeDraftRequestId: requestId });
  } catch (e) {
    const error = e instanceof DomainError && e.code === 'timing_invalid_for_date'
      ? 'Gli orari nei dettagli non sono validi per tutte le date selezionate. Modifica gli orari o rimuovi la data incompatibile.'
      : t.saveFailed;
    changeDraft(category.id, (current) => current ? { ...current, saving: false, saveError: current.requestId === requestId ? error : current.saveError } : current);
    haptics.error();
    AccessibilityInfo.announceForAccessibility(error);
    if (!(e instanceof DomainError)) console.warn('save failed', e);
    return false;
  }
  // Committed. From here on the save is a success whatever happens next (no retry, no duplicate).
  {
    // Merge the committed batch immediately. A refresh failure cannot turn a save into a retry.
    ++sessionsRead;
    set((state) => {
      const known = new Set(state.sessions.map((session) => session.id));
      return { sessions: [...state.sessions, ...res.sessions.filter((session) => !known.has(session.id))] };
    });
    try {
      await reloadSessions();
    } catch {
      // The committed sessions above remain visible when the follow-up read is unavailable.
    }
    changeDraft(category.id, (current) => current?.requestId === requestId ? undefined : current ? { ...current, saving: false } : current);
    const at = Date.now();
    const saved: LastSave = { requestId, ids: res.sessions.map((session) => session.id), count: res.sessions.length, categoryId: category.id, at, expiresAt: at + (screenReader ? UNDO_WINDOW_MS.screenReader : UNDO_WINDOW_MS.default) };
    set({
      lastSave: saved,
      highlightSaveId: requestId,
      breakEvent: { id: ++breakSeq, categoryId: category.id, color: category.color, dates, month: s.viewMonth },
    });
    setTimeout(() => {
      if (get().highlightSaveId === requestId) set({ highlightSaveId: null });
    }, 15000);
    haptics.success();
    showToast(t.saved(res.sessions.length, category.name), { action: { label: t.undo, run: () => void undoSave(saved) }, ms: UNDO_WINDOW_MS.default });
    afterCommit(res.sessions).catch(() => undefined); // calendar auto-export never blocks or undoes a local save
    return true;
  }
}

/** Undo the most recent save (deletes exactly the sessions it created). */
export async function undoLastSave() {
  const ls = get().lastSave;
  if (!ls) return;
  await undoSave(ls);
}

/** The callback owns its exact batch and expiry, even if another save finishes later. */
export async function undoSave(saved: LastSave): Promise<void> {
  if (Date.now() > saved.expiresAt || undoing.has(saved.requestId)) return;
  undoing.add(saved.requestId);
  try {
    const repos = await getRepositories();
    await repos.sessions.remove(saved.ids);
    const ids = new Set(saved.ids);
    set((state) => ({
      sessions: state.sessions.filter((session) => !ids.has(session.id)),
      lastSave: state.lastSave?.requestId === saved.requestId ? null : state.lastSave,
      highlightSaveId: state.highlightSaveId === saved.requestId ? null : state.highlightSaveId,
      breakCancel: state.breakCancel + (state.lastSave?.requestId === saved.requestId ? 1 : 0),
    }));
    ++sessionsRead; // invalidate reads taken before this deletion
    if (!get().lastSave) showToast(t.undone);
  } finally {
    undoing.delete(saved.requestId);
  }
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export function setHomeSessionMode(homeSessionMode: HomeSessionMode) {
  const state = get();
  if (state.bulkSaving || state.saving || (homeSessionMode === 'edit' && !state.activeId)) return;
  set({ homeSessionMode, bulkSelection: [] });
}

export function toggleBulkSession(id: ID) {
  const state = get();
  if (state.homeSessionMode !== 'edit' || state.bulkSaving || !state.activeId) return;
  if (!state.sessions.some((session) => session.id === id && session.categoryId === state.activeId)) return;
  const selected = state.bulkSelection.includes(id);
  set({ bulkSelection: selected ? state.bulkSelection.filter((value) => value !== id) : [...state.bulkSelection, id] });
  haptics.select();
}

export function selectBulkDay(date: LocalDate, selected: boolean) {
  const state = get();
  if (state.homeSessionMode !== 'edit' || state.bulkSaving || !state.activeId) return;
  const ids = new Set(state.sessions.filter((session) => session.categoryId === state.activeId && session.date === date).map((session) => session.id));
  set({ bulkSelection: selected ? [...new Set([...state.bulkSelection, ...ids])] : state.bulkSelection.filter((id) => !ids.has(id)) });
}

export function clearBulkSelection() {
  if (!get().bulkSaving) set({ bulkSelection: [] });
}

/** Commit the exact reviewed sessions. An export already in flight finishes before this edit. */
export async function updateSelectedSessions(input: BulkDetailsInput) {
  const state = get();
  const ids = new Set(input.expected.map((session) => session.id));
  if (state.bulkSaving) throw new DomainError('bulk_busy');
  if (state.homeSessionMode !== 'edit' || state.activeId !== input.categoryId) throw new DomainError('bulk_category_changed');
  if (ids.size !== state.bulkSelection.length || state.bulkSelection.some((id) => !ids.has(id))) throw new DomainError('bulk_selection_changed');
  set({ bulkSaving: true });
  try {
    const repos = await getRepositories();
    const result = await withExportLock(repos.exportJobs, () => {
      if (get().activeId !== input.categoryId || get().homeSessionMode !== 'edit') throw new DomainError('bulk_category_changed');
      return repos.sessions.updateDetailsBatch(input);
    });
    ++sessionsRead;
    const updated = new Map(result.sessions.map((session) => [session.id, session]));
    set((current) => ({
      sessions: current.sessions.map((session) => updated.get(session.id) ?? session),
      bulkSelection: current.bulkSelection.filter((id) => !ids.has(id)),
    }));
    await reloadSessions().catch(() => undefined);
    // Like the individual editor, edits do not enqueue exports or overwrite existing events.
    return result;
  } finally {
    set({ bulkSaving: false });
  }
}

export async function updateSession(id: ID, patch: SessionPatch): Promise<Session> {
  const repos = await getRepositories();
  const s = await repos.sessions.update(id, patch);
  ++sessionsRead;
  set((state) => ({ sessions: state.sessions.map((session) => session.id === id ? s : session) }));
  await reloadSessions().catch(() => undefined);
  return s;
}

export async function deleteSession(id: ID) {
  const repos = await getRepositories();
  await repos.sessions.remove([id]);
  ++sessionsRead;
  set((state) => ({ sessions: state.sessions.filter((session) => session.id !== id) }));
  await reloadSessions().catch(() => undefined);
}

// ─── Activities ──────────────────────────────────────────────────────────────

export async function createCategory(input: { name: string; color: string; pattern: PatternKind }): Promise<Category> {
  const repos = await getRepositories();
  const c = await repos.categories.create(input);
  ++categoriesRead;
  set((state) => ({ categories: [...state.categories.filter((category) => category.id !== c.id), c] }));
  await reloadCategories().catch(() => undefined);
  // Creating the first activity restores logging; adding one while browsing
  // all activities must not silently leave the user's neutral view.
  if (!get().activeId && get().categories.length === 1) await switchActivity(c.id);
  return c;
}

export async function updateCategory(id: ID, patch: { name?: string; color?: string; pattern?: PatternKind }) {
  const repos = await getRepositories();
  const category = await repos.categories.update(id, patch);
  ++categoriesRead;
  set((state) => ({ categories: state.categories.map((current) => current.id === id ? category : current) }));
  await reloadCategories().catch(() => undefined);
}

export async function reorderCategories(ids: ID[]) {
  const repos = await getRepositories();
  await repos.categories.reorder(ids);
  ++categoriesRead;
  const order = new Map(ids.map((id, index) => [id, index]));
  set((state) => ({ categories: state.categories.map((category) => ({ ...category, sortOrder: order.get(category.id) ?? category.sortOrder })).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)) }));
  await reloadCategories().catch(() => undefined);
}

export async function deleteCategory(id: ID, strategy?: DeleteStrategy) {
  const repos = await getRepositories();
  await (draftWrites.get(id) ?? Promise.resolve());
  await repos.categories.remove(id, strategy);
  ++categoriesRead;
  ++sessionsRead;
  ++periodsRead;
  ++draftsRevision;
  let remembered: ID | null | undefined;
  // Apply the committed deletion to the state as it is now. Delayed follow-up
  // reads may replace only their own collection and only while still current.
  set((state) => {
    const categories = state.categories.filter((category) => category.id !== id);
    const drafts = { ...state.drafts };
    delete drafts[id];
    let { activeId, activeNotice } = state;
    if (activeId === id) {
      activeId = categories[0]?.id ?? null;
      activeNotice = categories[0] ? t.activeContextChanged(categories[0].name) : null;
      activeRevision++;
      remembered = activeId;
    }
    const sessions = strategy?.kind === 'move'
      ? state.sessions.map((session) => session.categoryId === id ? { ...session, categoryId: strategy.toCategoryId, saveRequestId: null } : session)
      : state.sessions.filter((session) => session.categoryId !== id);
    const namedPeriods = state.namedPeriods.map((period) => ({ ...period, categoryIds: period.categoryIds.filter((categoryId) => categoryId !== id) }));
    return { categories, sessions, namedPeriods, drafts, activeId, activeNotice, ...draftProjection(drafts, activeId), bulkSelection: [], homeSessionMode: 'new' };
  });
  const remembering = remembered === undefined ? Promise.resolve() : rememberActivity(remembered, Promise.resolve(repos));
  await Promise.all([remembering, reloadCategories(), reloadSessions(), reloadPeriods(), reloadOpenJobs()].map((work) => work.catch(() => undefined)));
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
  const decoded = decodeMotionPref(motionPref);
  await repos.settings.set('motionPref', decoded);
  preferenceRevision.motion++;
  set({ motionPref: decoded });
}

export async function setThemePref(themePref: ThemePref) {
  const repos = await getRepositories();
  const decoded = decodeThemePref(themePref);
  await repos.settings.set('themePref', decoded);
  preferenceRevision.theme++;
  set({ themePref: decoded });
}

export async function setHomeActivitiesMode(homeActivitiesMode: HomeActivitiesMode) {
  const repos = await getRepositories();
  const decoded = decodeHomeActivitiesMode(homeActivitiesMode);
  await repos.settings.set('homeActivitiesMode', decoded);
  preferenceRevision.activities++;
  set({ homeActivitiesMode: decoded });
}

export async function createNamedPeriod(input: NamedPeriodInput) {
  const repos = await getRepositories();
  const period = await repos.periods.create(input);
  ++periodsRead;
  set((state) => ({ namedPeriods: [period, ...state.namedPeriods.filter((item) => item.id !== period.id)] }));
  await reloadPeriods().catch(() => undefined);
  return period;
}

export async function updateNamedPeriod(id: ID, patch: NamedPeriodPatch) {
  const repos = await getRepositories();
  const period = await repos.periods.update(id, patch);
  ++periodsRead;
  set((state) => ({ namedPeriods: state.namedPeriods.map((item) => item.id === id ? period : item) }));
  await reloadPeriods().catch(() => undefined);
  return period;
}

export async function deleteNamedPeriod(id: ID) {
  const repos = await getRepositories();
  await repos.periods.remove(id);
  ++periodsRead;
  set((state) => ({ namedPeriods: state.namedPeriods.filter((period) => period.id !== id) }));
  await reloadPeriods().catch(() => undefined);
}

export async function refreshAll() {
  await Promise.all([reloadCategories(), reloadSessions(), reloadPeriods(), reloadOpenJobs()]);
}
