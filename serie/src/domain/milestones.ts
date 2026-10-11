/**
 * Milestones follow explicit, visible rules. They measure what was recorded —
 * counts, known hours, consistency — never skill or fitness.
 */
import type { LocalDate, Milestone, Session } from './types';
import { addDays, diffDays, startOfWeek } from './dates';

export const SESSION_THRESHOLDS = [10, 25, 50, 100, 250, 500, 1000];
export const HOUR_THRESHOLDS = [10, 25, 50, 100, 250, 500];
export const WEEK_STREAK_THRESHOLDS = [4, 12, 26, 52];

export interface MilestoneLabels {
  first: string;
  sessions: (n: number) => string;
  hours: (n: number) => string;
  weeks: (n: number) => string;
}

/** Chronological order: by date, then by creation time (stable for same-day sessions). */
function chronological(sessions: readonly Session[]): Session[] {
  return sessions.slice().sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date < b.date ? -1 : 1));
}

export function computeMilestones(sessions: readonly Session[], labels: MilestoneLabels): Milestone[] {
  const list = chronological(sessions);
  const out: Milestone[] = [];

  out.push({ id: 'first', rule: labels.first, kind: 'first', threshold: 1, reached: list.length > 0, reachedOn: list[0]?.date ?? null });

  for (const n of SESSION_THRESHOLDS) {
    const s = list[n - 1];
    out.push({ id: `sessions-${n}`, rule: labels.sessions(n), kind: 'sessions', threshold: n, reached: !!s, reachedOn: s?.date ?? null });
  }

  // Known durations only; the crossing date is the session that pushed the sum over the threshold.
  let acc = 0;
  const crossings = new Map<number, LocalDate>();
  for (const s of list) {
    if (s.timing.durationSec == null) continue;
    acc += s.timing.durationSec;
    for (const h of HOUR_THRESHOLDS) if (!crossings.has(h) && acc >= h * 3600) crossings.set(h, s.date);
  }
  for (const h of HOUR_THRESHOLDS) {
    out.push({ id: `hours-${h}`, rule: labels.hours(h), kind: 'hours', threshold: h, reached: crossings.has(h), reachedOn: crossings.get(h) ?? null });
  }

  // Consecutive active ISO weeks.
  const weeks = [...new Set(list.map((s) => startOfWeek(s.date)))].sort();
  let run = 0;
  let prev: string | null = null;
  const weekCross = new Map<number, LocalDate>();
  for (const w of weeks) {
    run = prev && diffDays(w, prev) === 7 ? run + 1 : 1;
    prev = w;
    for (const n of WEEK_STREAK_THRESHOLDS) {
      if (!weekCross.has(n) && run >= n) {
        // date of the first session in the week that completed the streak
        const first = list.find((s) => startOfWeek(s.date) === w)?.date ?? addDays(w, 0);
        weekCross.set(n, first);
      }
    }
  }
  for (const n of WEEK_STREAK_THRESHOLDS) {
    out.push({ id: `weeks-${n}`, rule: labels.weeks(n), kind: 'weeks', threshold: n, reached: weekCross.has(n), reachedOn: weekCross.get(n) ?? null });
  }
  return out;
}
