/**
 * Chronological grouping for the history browser.
 * Time is never compressed: empty months appear with zero sessions, and the
 * current year's future months are marked as future rather than zero.
 */
import type { LocalDate, PeriodSummary, Session } from './types';
import { addMonths, compareMonths, daysInMonth, monthKey, monthOf, parseDate, type MonthRef } from './dates';
import { summarize } from './stats';

export interface MonthGroup {
  month: MonthRef;
  key: string;
  summary: PeriodSummary;
  /** sessions per day of month (index 1..31), 0 when none */
  perDay: number[];
  sessions: Session[];
}

export interface YearGroup {
  year: number;
  summary: PeriodSummary;
  months: { month: MonthRef; key: string; summary: PeriodSummary; future: boolean }[];
}

/** First month the history should show for an activity. */
export function historyStart(sessions: readonly Session[], today: LocalDate): MonthRef {
  let first = monthOf(today);
  for (const s of sessions) {
    const m = monthOf(s.date);
    if (compareMonths(m, first) < 0) first = m;
  }
  return first;
}

/** Newest-first month groups from the current month back to `start` (or the first session). */
export function monthGroups(sessions: readonly Session[], today: LocalDate, start?: MonthRef): MonthGroup[] {
  const from = start ?? historyStart(sessions, today);
  const to = monthOf(today);
  const byKey = new Map<string, Session[]>();
  for (const s of sessions) {
    const k = s.date.slice(0, 7);
    const arr = byKey.get(k);
    if (arr) arr.push(s);
    else byKey.set(k, [s]);
  }
  const out: MonthGroup[] = [];
  for (let m = to; compareMonths(m, from) >= 0; m = addMonths(m, -1)) {
    const key = monthKey(m);
    const list = (byKey.get(key) ?? []).slice().sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date < b.date ? -1 : 1));
    const perDay = new Array(daysInMonth(m.y, m.m) + 1).fill(0);
    for (const s of list) perDay[parseDate(s.date).d]++;
    out.push({ month: m, key, summary: summarize(list), perDay, sessions: list });
  }
  return out;
}

/** Newest-first year groups with a full 12-month breakdown. */
export function yearGroups(sessions: readonly Session[], today: LocalDate, start?: MonthRef): YearGroup[] {
  const from = start ?? historyStart(sessions, today);
  const now = monthOf(today);
  const out: YearGroup[] = [];
  for (let y = now.y; y >= from.y; y--) {
    const inYear = sessions.filter((s) => s.date.startsWith(`${y}-`));
    const months = Array.from({ length: 12 }, (_, i) => {
      const month = { y, m: i + 1 };
      const key = monthKey(month);
      return { month, key, summary: summarize(inYear.filter((s) => s.date.startsWith(key))), future: compareMonths(month, now) > 0 };
    });
    out.push({ year: y, summary: summarize(inYear), months });
  }
  return out;
}

/** Index of a month inside newest-first month groups (for direct navigation). */
export function monthIndex(groups: readonly MonthGroup[], m: MonthRef): number {
  return groups.findIndex((g) => g.month.y === m.y && g.month.m === m.m);
}
