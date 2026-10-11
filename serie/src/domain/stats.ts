/**
 * Statistics derived from stored sessions. Never cached as truth.
 *
 * Duration rules: only known durations (interval or declared) are summed and
 * averaged; coverage is always reported alongside; each session's duration is
 * attributed in full to its recorded date (including next-day intervals).
 */
import type { Category, DurationSummary, LocalDate, PeriodSummary, Session } from './types';
import { addDays, addMonths, compareDates, diffDays, firstOfMonth, isoWeek, lastOfMonth, monthKey, monthOf, startOfWeek, type MonthRef } from './dates';

export function summarize(sessions: readonly Session[]): PeriodSummary {
  const days = new Set<string>();
  let knownSec = 0, knownCount = 0;
  for (const s of sessions) {
    days.add(s.date);
    if (s.timing.durationSec != null && s.timing.durationSec > 0) {
      knownSec += s.timing.durationSec;
      knownCount++;
    }
  }
  return { sessions: sessions.length, activeDays: days.size, duration: { knownSec, knownCount, totalCount: sessions.length } };
}

export function inRange(sessions: readonly Session[], from: LocalDate, to: LocalDate): Session[] {
  return sessions.filter((s) => s.date >= from && s.date <= to);
}

export function forCategory(sessions: readonly Session[], categoryId: string | null): Session[] {
  return categoryId ? sessions.filter((s) => s.categoryId === categoryId) : sessions.slice();
}

/** Average of known durations, with the number of contributing sessions; null when none known. */
export function averageKnown(d: DurationSummary): { avgSec: number; count: number } | null {
  if (d.knownCount === 0) return null;
  return { avgSec: Math.round(d.knownSec / d.knownCount), count: d.knownCount };
}

export type DurationState = { kind: 'none' } | { kind: 'partial' | 'complete'; knownSec: number; knownCount: number; totalCount: number };

/** How a period's recorded time should be presented. */
export function durationState(d: DurationSummary): DurationState {
  if (d.knownCount === 0) return { kind: 'none' };
  return { kind: d.knownCount === d.totalCount ? 'complete' : 'partial', knownSec: d.knownSec, knownCount: d.knownCount, totalCount: d.totalCount };
}

/** Group by key while preserving insertion order. */
function groupBy<T>(items: readonly T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

export const byDate = (sessions: readonly Session[]) => groupBy(sessions, (s) => s.date);
export const byMonth = (sessions: readonly Session[]) => groupBy(sessions, (s) => s.date.slice(0, 7));
export const byYear = (sessions: readonly Session[]) => groupBy(sessions, (s) => s.date.slice(0, 4));
export const byWeek = (sessions: readonly Session[]) => groupBy(sessions, (s) => isoWeek(s.date).key);

export interface WeekBucket {
  weekStart: LocalDate;
  sessions: number;
}

/** Trailing weekly buckets (including empty weeks), oldest first, ending with the week of `today`. */
export function weeklyBuckets(sessions: readonly Session[], today: LocalDate, weeks: number): WeekBucket[] {
  const end = startOfWeek(today);
  const start = addDays(end, -7 * (weeks - 1));
  const counts = new Map<string, number>();
  for (const s of sessions) {
    if (s.date < start || s.date > addDays(end, 6)) continue;
    const w = startOfWeek(s.date);
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const out: WeekBucket[] = [];
  for (let i = 0; i < weeks; i++) {
    const w = addDays(start, 7 * i);
    out.push({ weekStart: w, sessions: counts.get(w) ?? 0 });
  }
  return out;
}

export interface MonthBucket {
  month: MonthRef;
  key: string;
  summary: PeriodSummary;
}

/** Trailing monthly buckets (including empty months), oldest first, ending with the month of `today`. */
export function monthlyBuckets(sessions: readonly Session[], today: LocalDate, months: number): MonthBucket[] {
  const last = monthOf(today);
  const groups = byMonth(sessions);
  const out: MonthBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const m = addMonths(last, -i);
    const key = monthKey(m);
    out.push({ month: m, key, summary: summarize(groups.get(key) ?? []) });
  }
  return out;
}

export interface Frequency {
  /** Mean sessions per week over the window. */
  perWeek: number;
  /** Mean sessions per month over the window. */
  perMonth: number;
  /** Weeks in the window with ≥1 session. */
  activeWeeks: number;
  windowWeeks: number;
}

export function frequency(sessions: readonly Session[], today: LocalDate, windowWeeks = 12): Frequency {
  const wk = weeklyBuckets(sessions, today, windowWeeks);
  const total = wk.reduce((a, b) => a + b.sessions, 0);
  const months = monthlyBuckets(sessions, today, Math.max(1, Math.round(windowWeeks / 4.345)));
  const mTotal = months.reduce((a, b) => a + b.summary.sessions, 0);
  return { perWeek: total / windowWeeks, perMonth: mTotal / months.length, activeWeeks: wk.filter((w) => w.sessions > 0).length, windowWeeks };
}

/** Longest run of consecutive ISO weeks with ≥1 session, and the current run ending at today's week. */
export function weekStreaks(sessions: readonly Session[], today: LocalDate): { longest: number; current: number } {
  if (sessions.length === 0) return { longest: 0, current: 0 };
  const weeks = new Set(sessions.map((s) => startOfWeek(s.date)));
  const sorted = [...weeks].sort();
  let longest = 0, run = 0;
  let prev: string | null = null;
  for (const w of sorted) {
    run = prev && diffDays(w, prev) === 7 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = w;
  }
  let current = 0;
  let w = startOfWeek(today);
  if (!weeks.has(w)) w = addDays(w, -7); // the current week may still be in progress
  while (weeks.has(w)) {
    current++;
    w = addDays(w, -7);
  }
  return { longest, current };
}

export interface CategoryShare {
  categoryId: string;
  name: string;
  color: string;
  summary: PeriodSummary;
  share: number; // fraction of all sessions
}

export function distribution(sessions: readonly Session[], categories: readonly Category[]): CategoryShare[] {
  const total = sessions.length || 1;
  return categories
    .map((c) => {
      const s = summarize(sessions.filter((x) => x.categoryId === c.id));
      return { categoryId: c.id, name: c.name, color: c.color, summary: s, share: s.sessions / total };
    })
    .sort((a, b) => b.summary.sessions - a.summary.sessions);
}

/** First and last session dates, or null. */
export function span(sessions: readonly Session[]): { first: LocalDate; last: LocalDate } | null {
  if (!sessions.length) return null;
  let first = sessions[0].date, last = sessions[0].date;
  for (const s of sessions) {
    if (compareDates(s.date, first) < 0) first = s.date;
    if (compareDates(s.date, last) > 0) last = s.date;
  }
  return { first, last };
}

export const monthBounds = (m: MonthRef) => ({ from: firstOfMonth(m), to: lastOfMonth(m) });
