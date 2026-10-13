import type { Session } from '@/domain/types';

/** Recorded dates and wall times stay in the session's own frame of reference. */
export function compareSessions(a: Session, b: Session): number {
  return a.date.localeCompare(b.date)
    || (a.timing.start ?? '24:00').localeCompare(b.timing.start ?? '24:00')
    || a.createdAt.localeCompare(b.createdAt)
    || a.id.localeCompare(b.id);
}
