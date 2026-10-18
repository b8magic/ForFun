import type { LocalDate, Session } from './types';

/** Recorded dates and wall times stay in the session's own frame of reference. */
export function compareSessions(a: Session, b: Session): number {
  return a.date.localeCompare(b.date)
    || (a.timing.start ?? '24:00').localeCompare(b.timing.start ?? '24:00')
    || a.createdAt.localeCompare(b.createdAt)
    || a.id.localeCompare(b.id);
}

export interface SessionDay {
  date: LocalDate;
  sessions: Session[];
}

/** Selected dates stay visible even when the current activity has no sessions. */
export function groupSessionsForDates(sessions: readonly Session[], dates: readonly LocalDate[], categoryId: string | null = null): SessionDay[] {
  const byDate = new Map([...new Set(dates)].sort().map((date) => [date, [] as Session[]]));
  for (const session of sessions) {
    if (categoryId && session.categoryId !== categoryId) continue;
    byDate.get(session.date)?.push(session);
  }
  return [...byDate].map(([date, day]) => ({ date, sessions: day.sort(compareSessions) }));
}
