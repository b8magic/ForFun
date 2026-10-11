/**
 * Pure helpers for the activities, menu and month-jump sheets.
 * No React, no storage: everything here is derived from store snapshots and
 * unit-tested in __tests__/helpers.test.ts.
 */
import type { Category, ID, LocalDate, PatternKind, Session } from '@/domain/types';
import { compareMonths, monthOf, type MonthRef } from '@/domain/dates';
import { t } from '@/i18n/it';

/** Mirrors the repository rule (categoriesRepo.assertName). */
export const NAME_MAX = 40;

export type NameIssue = 'name_required' | 'name_too_long' | 'name_taken';

/**
 * Client-side preview of the repository's name validation, so problems show
 * while typing. The repository stays authoritative: its DomainError codes are
 * mapped through `errorText` on submit.
 */
export function nameIssue(raw: string, categories: readonly Pick<Category, 'id' | 'name'>[], exceptId?: ID): NameIssue | null {
  const n = raw.trim();
  if (!n) return 'name_required';
  if (n.length > NAME_MAX) return 'name_too_long';
  const k = n.toLowerCase();
  if (categories.some((c) => c.id !== exceptId && c.name.trim().toLowerCase() === k)) return 'name_taken';
  return null;
}

/** Reads `code` from a DomainError (or anything shaped like one). */
export function errorCode(e: unknown): string | null {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'code' in e) {
    const c = (e as { code: unknown }).code;
    return typeof c === 'string' ? c : null;
  }
  return null;
}

export const isNameCode = (code: string | null): code is NameIssue => code === 'name_required' || code === 'name_too_long' || code === 'name_taken';

/** Italian copy for repository error codes. */
export function errorText(e: unknown): string {
  switch (errorCode(e)) {
    case 'name_required':
      return t.nameRequired;
    case 'name_taken':
      return t.nameTaken;
    case 'name_too_long':
      return t.manage.nameTooLong;
    case 'category_has_sessions':
      return t.manage.errHasSessions;
    case 'move_to_same':
      return t.manage.errMoveSame;
    case 'category_missing':
      return t.manage.errMissing;
    default:
      return t.errorGeneric;
  }
}

/** Session count per activity, from the stored sessions (never cached as truth). */
export function countByCategory(sessions: readonly Pick<Session, 'categoryId'>[]): Map<ID, number> {
  const m = new Map<ID, number>();
  for (const s of sessions) m.set(s.categoryId, (m.get(s.categoryId) ?? 0) + 1);
  return m;
}

/** New order after moving `id` one step up (-1) or down (+1); null when it cannot move. */
export function moveId(ids: readonly ID[], id: ID, dir: -1 | 1): ID[] | null {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const next = ids.slice();
  next[i] = ids[j];
  next[j] = id;
  return next;
}

export const PATTERNS: readonly PatternKind[] = ['swell', 'stride', 'pulse', 'drift', 'ripple', 'grain'];

/**
 * A starting look for a new activity: the first palette colour and motion
 * pattern not already in use (falling back to the first of each), so a new
 * disc is distinguishable from its neighbours without any extra step.
 */
export function suggestLook(categories: readonly Pick<Category, 'color' | 'pattern'>[], colors: readonly { hex: string }[]): { color: string; pattern: PatternKind } {
  const usedColors = new Set(categories.map((c) => c.color.toLowerCase()));
  const usedPatterns = new Set(categories.map((c) => c.pattern));
  const color = colors.find((c) => !usedColors.has(c.hex.toLowerCase()))?.hex ?? colors[0]?.hex ?? '#FF4D1F';
  const pattern = PATTERNS.find((p) => !usedPatterns.has(p)) ?? PATTERNS[0];
  return { color, pattern };
}

/** Activities that can receive the sessions of the one being deleted. */
export const moveTargets = (categories: readonly Category[], deletingId: ID): Category[] => categories.filter((c) => c.id !== deletingId);

// ─── Month jump ──────────────────────────────────────────────────────────────

export type JumpTarget = 'lineup' | 'history';

export function parseJumpTarget(v: string | string[] | undefined): JumpTarget {
  const s = Array.isArray(v) ? v[0] : v;
  return s === 'history' ? 'history' : 'lineup';
}

const yearOf = (d: LocalDate) => Number(d.slice(0, 4));

/** Category filter value meaning every activity (history's "Tutte le attività"). */
export const ALL_ACTIVITIES = '*';
const inFilter = (categoryId: ID, s: Pick<Session, 'categoryId'>) => categoryId === ALL_ACTIVITIES || s.categoryId === categoryId;

/**
 * Years offered by "Vai a…": from the first year with a session for the
 * activity (or the current year) up to the current year. `include` widens the
 * range to keep a year already in view reachable; `earlier` prepends extra
 * years the user asked for explicitly.
 */
export function jumpYears(sessions: readonly Pick<Session, 'categoryId' | 'date'>[], categoryId: ID | null, today: LocalDate, opts: { include?: number; earlier?: number } = {}): number[] {
  const current = yearOf(today);
  let first = current;
  if (categoryId) for (const s of sessions) if (inFilter(categoryId, s)) first = Math.min(first, yearOf(s.date));
  if (opts.include != null && opts.include < first) first = opts.include;
  first -= Math.max(0, Math.floor(opts.earlier ?? 0));
  const out: number[] = [];
  for (let y = first; y <= current; y++) out.push(y);
  return out;
}

/** Sessions per month (index 0 = gennaio) for one activity in one year. */
export function monthCounts(sessions: readonly Pick<Session, 'categoryId' | 'date'>[], categoryId: ID | null, year: number): number[] {
  const out = new Array<number>(12).fill(0);
  if (!categoryId) return out;
  const prefix = `${String(year).padStart(4, '0')}-`;
  for (const s of sessions) if (inFilter(categoryId, s) && s.date.startsWith(prefix)) out[Number(s.date.slice(5, 7)) - 1]++;
  return out;
}

/** Sessions per year for one activity. */
export function yearCounts(sessions: readonly Pick<Session, 'categoryId' | 'date'>[], categoryId: ID | null): Map<number, number> {
  const m = new Map<number, number>();
  if (!categoryId) return m;
  for (const s of sessions) if (inFilter(categoryId, s)) m.set(yearOf(s.date), (m.get(yearOf(s.date)) ?? 0) + 1);
  return m;
}

/** Months after the current month cannot be opened. */
export const isFutureMonth = (r: MonthRef, today: LocalDate) => compareMonths(r, monthOf(today)) > 0;

/** 'YYYY-MM' → MonthRef (null when malformed). */
export function parseMonthKey(key: string | null | undefined): MonthRef | null {
  const m = key ? /^(\d{4})-(\d{2})$/.exec(key) : null;
  if (!m) return null;
  const mo = Number(m[2]);
  return mo >= 1 && mo <= 12 ? { y: Number(m[1]), m: mo } : null;
}
