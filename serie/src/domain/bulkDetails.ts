import type { ID, LocalDate, Place, Session, Timing } from './types';
import { addDays } from './dates';
import { normalizeTiming } from './timing';
import { zonedToEpoch } from './zoned';

/** Missing fields keep each session's value. Null/date_only explicitly remove it. */
export interface BulkDetailsPatch {
  notes?: string | null;
  place?: Place | null;
  timing?: Timing;
}

export interface BulkDetailsInput {
  categoryId: ID;
  /** The exact records reviewed by the user, including same-day sessions. */
  expected: readonly Session[];
  patch: BulkDetailsPatch;
}

/** Re-derive elapsed time on each date; never silently drop or shift a clock field. */
export function bulkTimingForDate(date: LocalDate, timing: Timing): Timing | null {
  const next = normalizeTiming(date, timing);
  if (next.state !== timing.state) return null;
  if (next.start && next.timeZone && zonedToEpoch(date, next.start, next.timeZone).kind === 'nonexistent') return null;
  if (next.end && next.timeZone && zonedToEpoch(addDays(date, next.endDayOffset), next.end, next.timeZone).kind === 'nonexistent') return null;
  return next;
}

/** Compare values as well as timestamps: two writes can share a millisecond. */
export function sameSessionVersion(a: Session, b: Session): boolean {
  const value = (s: Session) => JSON.stringify([
    s.id, s.categoryId, s.date, s.updatedAt, s.createdAt, s.origin, s.saveRequestId,
    s.notes, s.place && [s.place.label, s.place.address, s.place.mapUrl, s.place.coords?.lat, s.place.coords?.lng, s.place.resolution, s.place.resolutionNote],
    [s.timing.state, s.timing.start, s.timing.end, s.timing.endDayOffset, s.timing.timeZone, s.timing.declaredSec, s.timing.durationSec, s.timing.durationSource],
  ]);
  return value(a) === value(b);
}
