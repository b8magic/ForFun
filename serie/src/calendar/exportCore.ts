/**
 * Rules shared by the manual export engine (exportEngine.ts) and automatic
 * export (autoExport.ts). Both engines can write the same session to the same
 * calendar, so they must agree on:
 *
 *   sameAccountId          which account a destination belongs to;
 *   writeMayHaveApplied    which failed writes may still have created the
 *                          event (→ look it up by op id before any retry);
 *   linkedEventMeta /      what is recorded when an existing event is linked
 *   linkSnapshot           (Serie's own event for this session: the timing it
 *                          was written with, so later drift is reported);
 *   readDestinationEvents  how the real destination is read for the duplicate
 *                          check (window + this session's events outside it);
 *   paddedWindow           the date windows read around a session and searched
 *                          for an earlier attempt;
 *   noteAttemptOnPayload   a manual takeover of an automatic job records where
 *                          it wrote, for the automatic runner's reconciliation;
 *   withExportLock         manual and automatic runs on one database never
 *                          interleave, so neither creates an event the other
 *                          is creating at that moment.
 *
 * Op ids come from `opId.ts`, drafts and snapshots from `representation.ts`,
 * duplicate classes from `duplicates.ts`: both engines call those directly.
 *
 * Pure: no React, no Expo.
 */
import { ProviderError, type AppEventMeta, type CalendarProvider, type ExternalEvent } from './types';
import type { ExportSnapshot, LocalDate, ProviderKind, Session } from '@/domain/types';
import { addDays, compareDates, isLocalDate } from '@/domain/dates';
import { Mutex } from '@/data/driver';
import { canonicalEmail } from './equivalence';
import { snapshotFromEvent } from './representation';

// ─── accounts ────────────────────────────────────────────────────────────────

/**
 * Same account? Google account ids are emails (compared case-insensitively,
 * Gmail dots and googlemail.com folded); EventKit source ids are opaque and
 * compared exactly.
 */
export function sameAccountId(provider: ProviderKind, a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  if (provider !== 'google') return a === b;
  const norm = (s: string) => canonicalEmail(s) ?? s.trim().toLowerCase();
  return norm(a) === norm(b);
}

// ─── failed writes ───────────────────────────────────────────────────────────

/**
 * Provider errors that prove the write was refused before anything was
 * stored. Every other failure (an explicit 'uncertain', 'conflict', 'unknown',
 * 'unavailable', 'offline', or an unexpected exception) may hide an event
 * that was created anyway.
 */
const REFUSED: ReadonlySet<ProviderError['code']> = new Set<ProviderError['code']>(['unauthorized', 'forbidden', 'not_found', 'invalid', 'rate_limited']);

/**
 * True when a failed create may still have created the event. The operation
 * must then be looked up by its op id (`findByOpId`) before it is ever created
 * again, by whichever engine retries it.
 */
export function writeMayHaveApplied(e: unknown): boolean {
  return !(e instanceof ProviderError) || !REFUSED.has(e.code);
}

// ─── linking ─────────────────────────────────────────────────────────────────

export type LinkedMeta = Pick<AppEventMeta, 'timingState' | 'durationSec' | 'durationSource' | 'schedulingPlaceholder'>;

/**
 * Timing recorded on a link to an existing event. Serie's own event for this
 * session carries the timing it was written with: that is recorded, so a later
 * difference with the session shows as "Evento collegato modificato" instead
 * of being masked. Any other event records the session's current timing.
 */
export function linkedEventMeta(session: Pick<Session, 'id' | 'timing'>, ev: Pick<ExternalEvent, 'appMeta'>): LinkedMeta {
  const own = ev.appMeta && ev.appMeta.sessionId === session.id ? ev.appMeta : null;
  if (own) return { timingState: own.timingState, durationSec: own.durationSec, durationSource: own.durationSource, schedulingPlaceholder: own.schedulingPlaceholder };
  const tm = session.timing;
  const known = tm.durationSec != null && tm.durationSec > 0 ? tm.durationSec : null;
  return { timingState: tm.state, durationSec: known, durationSource: known != null ? tm.durationSource : null, schedulingPlaceholder: ev.appMeta?.schedulingPlaceholder ?? false };
}

/** Snapshot stored on a link to an existing event (found by op id, recognised, or chosen by the user). */
export function linkSnapshot(session: Pick<Session, 'id' | 'timing'>, ev: ExternalEvent, categoryName: string): ExportSnapshot {
  return snapshotFromEvent(ev, linkedEventMeta(session, ev), categoryName);
}

// ─── reading the destination ─────────────────────────────────────────────────

export interface EventIdentity {
  eventId: string;
  occurrenceKey: string | null;
}

/**
 * Read one destination calendar for a duplicate check: every non-cancelled
 * event in the window (the provider paginates and chunks completely), plus the
 * given events (links / import sources of the sessions) that lie outside it, so
 * they are not mistaken for stale links or missing sources. Provider errors are
 * thrown unchanged: the caller decides between "not checked" and a retry.
 */
export async function readDestinationEvents(
  provider: CalendarProvider,
  calendarId: string,
  window: { from: LocalDate; to: LocalDate },
  extra: readonly EventIdentity[] = [],
  signal?: AbortSignal,
): Promise<ExternalEvent[]> {
  const listed = await provider.listEvents({ calendarIds: [calendarId], from: window.from, to: window.to, signal });
  const events = listed.filter((e) => e.status !== 'cancelled' && e.calendarId === calendarId);
  const has = (w: EventIdentity) => events.some((e) => e.eventId === w.eventId && (e.occurrenceKey ?? null) === (w.occurrenceKey ?? null));
  for (const w of extra) {
    if (has(w)) continue;
    const ev = await provider.getEvent(calendarId, w.eventId, w.occurrenceKey);
    if (ev && ev.status !== 'cancelled' && ev.calendarId === calendarId && !has(ev)) events.push(ev);
  }
  return events;
}

// ─── reconciliation ──────────────────────────────────────────────────────────

/**
 * Inclusive date window covering every given date padded by one day on each
 * side, widened to `prev`. Used for the duplicate-check read (session date,
 * outgoing dates) and for `findByOpId` (outgoing dates, session date, an
 * earlier attempt's date or window). Malformed dates are ignored; null when no
 * date is usable.
 */
export function paddedWindow(
  dates: readonly (LocalDate | null | undefined)[],
  prev?: { from: LocalDate; to: LocalDate } | null,
): { from: LocalDate; to: LocalDate } | null {
  const valid = dates.filter((d): d is LocalDate => isLocalDate(d)).sort(compareDates);
  let from: LocalDate | null = valid.length ? addDays(valid[0], -1) : null;
  let to: LocalDate | null = valid.length ? addDays(valid[valid.length - 1], 1) : null;
  if (prev && isLocalDate(prev.from) && isLocalDate(prev.to)) {
    if (!from || compareDates(prev.from, from) < 0) from = prev.from;
    if (!to || compareDates(prev.to, to) > 0) to = prev.to;
  }
  return from && to ? { from, to } : null;
}

/** Source tag of automatic export job payloads (see autoExport.ts `AutoJobPayload`). */
export const AUTO_JOB_SOURCE = 'auto_export';

/**
 * When the manual export takes over an open automatic job, the automatic
 * payload is kept (its runner reads it) but records that a write was attempted
 * on `date`: if that write ends uncertain, the runner looks it up there by op
 * id before anything else. Other payloads are returned unchanged.
 */
export function noteAttemptOnPayload(payload: unknown, date: LocalDate): unknown {
  if (!payload || typeof payload !== 'object' || (payload as { source?: unknown }).source !== AUTO_JOB_SOURCE) return payload;
  return { ...(payload as Record<string, unknown>), attemptedDate: date, reconcile: true };
}

// ─── one export run at a time ────────────────────────────────────────────────

const exportLocks = new WeakMap<object, Mutex>();

/**
 * Serialise export runs on one database (key: the `exportJobs` repository).
 * Manual `executePlan` and automatic `runJobs` both run under it, so a job
 * found 'running' by either was left by an interrupted run, never by one that
 * is writing right now.
 */
export function withExportLock<T>(key: object, fn: () => Promise<T>): Promise<T> {
  let m = exportLocks.get(key);
  if (!m) {
    m = new Mutex();
    exportLocks.set(key, m);
  }
  return m.lock(fn);
}
