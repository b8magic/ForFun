/**
 * Application state. UI reads from here; writes go through actions.ts.
 * Saved records follow successful commits. Draft edits render immediately and
 * are queued durably per activity before a save can consume them.
 */
import { create } from 'zustand';
import type { Category, CategoryDraft, ID, LocalDate, NamedPeriod, Session, SessionDetailsDraft } from '@/domain/types';
import type { MonthRef } from '@/domain/dates';

export type Place = 'lineup' | 'time';
export type TimeScale = 'month' | 'year' | 'all';
export type MotionPref = 'system' | 'reduced' | 'full';
export type ThemePref = 'cream' | 'dark';
export type HomeActivitiesMode = 'all' | 'active';
export type HomeSessionMode = 'new' | 'edit';

export const decodeThemePref = (value: unknown): ThemePref => value === 'dark' ? 'dark' : 'cream';
export const decodeHomeActivitiesMode = (value: unknown): HomeActivitiesMode => value === 'active' ? 'active' : 'all';
export const decodeMotionPref = (value: unknown): MotionPref => value === 'reduced' || value === 'full' ? value : 'system';

export interface ActivityDraft extends CategoryDraft {
  saving: boolean;
  saveError: string | null;
}

export interface BreakEvent {
  id: number;
  categoryId: ID;
  color: string;
  dates: LocalDate[];
  /** Grid month at the moment of saving (dots fly from these cells). */
  month: MonthRef;
}

export interface LastSave {
  requestId: string;
  ids: ID[];
  count: number;
  categoryId: ID;
  at: number;
  expiresAt: number;
}

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
  tone?: 'neutral' | 'error';
}

export interface AppState {
  status: 'booting' | 'ready' | 'error';
  bootError: string | null;
  categories: Category[];
  activeId: ID | null;
  /** Shown when the remembered activity no longer exists. */
  activeNotice: string | null;
  sessions: Session[];
  namedPeriods: NamedPeriod[];
  /** Persistent per-activity values; saving/error are isolated runtime state. */
  drafts: Record<ID, ActivityDraft>;
  /** Shared working dates, retained across activity and New/Edit switches. */
  selection: LocalDate[];
  /** Optional details the user explicitly chose to apply to every selected date. */
  pendingDetails: SessionDetailsDraft | null;
  viewMonth: MonthRef;
  today: LocalDate;
  place: Place;
  timeScale: TimeScale;
  /** Month requested by direct navigation in history ("Vai a…"). */
  historyFocus: { key: string; nonce: number } | null;
  switcherOpen: boolean;
  saving: boolean;
  saveError: string | null;
  lastSave: LastSave | null;
  /** Request id of a save made moments ago (history lifts its dates for ~15 s). */
  highlightSaveId: string | null;
  /** Bumped when the last save is undone: the Lineup ends its break animation. */
  breakCancel: number;
  breakEvent: BreakEvent | null;
  toast: Toast | null;
  motionPref: MotionPref;
  themePref: ThemePref;
  homeActivitiesMode: HomeActivitiesMode;
  /** Record choices across the working dates; the active activity only scopes them. */
  homeSessionMode: HomeSessionMode;
  bulkSelection: ID[];
  bulkSaving: boolean;
  /** Live iOS "Riduci movimento" setting (kept in sync by the root layout). */
  systemReducedMotion: boolean;
  openJobs: number;
}

const now = new Date();

export const useApp = create<AppState>(() => ({
  status: 'booting',
  bootError: null,
  categories: [],
  activeId: null,
  activeNotice: null,
  sessions: [],
  namedPeriods: [],
  drafts: {},
  selection: [],
  pendingDetails: null,
  viewMonth: { y: now.getFullYear(), m: now.getMonth() + 1 },
  today: '1970-01-01',
  place: 'lineup',
  timeScale: 'month',
  historyFocus: null,
  switcherOpen: false,
  saving: false,
  saveError: null,
  lastSave: null,
  highlightSaveId: null,
  breakCancel: 0,
  breakEvent: null,
  toast: null,
  motionPref: 'system',
  themePref: 'cream',
  homeActivitiesMode: 'all',
  homeSessionMode: 'new',
  bulkSelection: [],
  bulkSaving: false,
  systemReducedMotion: false,
  openJobs: 0,
}));

export const selectActive = (s: AppState): Category | null => s.categories.find((c) => c.id === s.activeId) ?? null;
export const selectActiveSessions = (s: AppState): Session[] => (s.activeId ? s.sessions.filter((x) => x.categoryId === s.activeId) : []);
