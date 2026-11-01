/**
 * EventKit (expo-calendar) ⇄ Serie calendar contracts. Pure: no React, no Expo.
 *
 * The provider adapter (`provider.ts`) feeds native objects in through the
 * structural `EK*Like` types below, so everything here is unit-testable
 * without a device.
 *
 * Conventions decided here (see README.md in this folder):
 *  - Identity. expo-calendar's `event.id` is EventKit's `calendarItemIdentifier`,
 *    shared by every occurrence of a recurring series. For occurrences we expose
 *    `recurringEventId = id` and `occurrenceKey` = the occurrence's ORIGINAL
 *    start (`originalStartDate`, EventKit `occurrenceDate`): an ISO instant for
 *    timed events, a 'YYYY-MM-DD' date for all-day ones (all-day events float
 *    with the device zone). `eventId` is made unique per occurrence as
 *    `<id>@<occurrenceKey>` (mirrors Google's per-instance ids), and the
 *    provider parses it back. Single events keep `eventId = id`.
 *  - All-day. EventKit reports all-day spans as device-zone midnight → 23:59:59
 *    of the last day. We expose date-only times with an EXCLUSIVE end date.
 *  - Timed. The UTC instant is exact. The wall time is computed in the event's
 *    zone only when expo-calendar reports an IANA identifier; expo-calendar 57
 *    reports `EKEvent.timeZone` as a localized abbreviation ("CET", "GMT+1"),
 *    which is ambiguous, so in practice the device zone is used.
 */
import { ProviderError } from '../types';
import type { AccessRole, AppEventMeta, EventDraft, EventTime, ExternalCalendar, ExternalEvent } from '../types';
import type { LocalDate } from '@/domain/types';
import { addDays, compareDates, isLocalDate } from '@/domain/dates';
import { epochToZoned, isValidTimeZone, isWallTime, zonedToEpoch } from '@/domain/zoned';
import { isSerieMetaUrl, metaToUrl, notesWithMeta, readEventMeta, splitNotesMeta } from './meta';
import { APPLE_ACCOUNT_FALLBACK, APPLE_ACCOUNT_LOCAL, APPLE_ACCOUNT_UNKNOWN, APPLE_ERR_INVALID_EVENT } from './strings';

// ─── structural views of expo-calendar objects ───────────────────────────────

export type DateLike = string | Date;

export interface EKSourceLike {
  id?: string;
  type: string;
  name: string;
}

export interface EKCalendarLike {
  id: string;
  title: string;
  source: EKSourceLike;
  sourceId?: string;
  type?: string;
  color?: string | null;
  entityType?: string;
  allowsModifications: boolean;
}

export interface EKEventLike {
  id: string;
  calendarId: string;
  title: string | null;
  location: string | null;
  notes: string | null;
  url?: string | null;
  timeZone?: string | null;
  startDate: DateLike;
  endDate: DateLike;
  originalStartDate?: DateLike | null;
  isDetached?: boolean;
  allDay: boolean;
  status?: string | null;
  recurrenceRule?: unknown;
  lastModifiedDate?: DateLike | null;
}

/** Fields sent to `calendar.createEvent()` / `event.update()`. `null` clears (update only). */
export interface EventKitDetails {
  title: string;
  notes?: string | null;
  location?: string | null;
  allDay: boolean;
  startDate: Date;
  endDate: Date;
  timeZone?: string | null;
  url?: string;
  alarms: [];
}

/** EventKit predicates silently truncate ranges longer than 4 years; we stay well below. */
export const MAX_CHUNK_DAYS = 365;

const OCC_SEP = '@';
const OCC_ID_RE = /^(.+)@(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?)$/;
const KEY_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

// ─── small helpers ───────────────────────────────────────────────────────────

export function toEpoch(v: DateLike | null | undefined): number | null {
  if (v == null || v === '') return null;
  const ms = v instanceof Date ? v.getTime() : Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

const iso = (ms: number) => new Date(ms).toISOString();

function invalid(detail: string): ProviderError {
  return new ProviderError('invalid', `${APPLE_ERR_INVALID_EVENT} (${detail})`);
}

/** IANA zone of the event when the native layer reports one, else the device zone. */
export function eventZone(ev: Pick<EKEventLike, 'timeZone'>, deviceTz: string): string {
  const z = ev.timeZone?.trim();
  if (z && (z.includes('/') || z === 'UTC') && isValidTimeZone(z)) return z;
  return deviceTz;
}

export function isRecurring(ev: Pick<EKEventLike, 'recurrenceRule' | 'isDetached'>): boolean {
  return ev.recurrenceRule != null || ev.isDetached === true;
}

/** Occurrence identity: original start of the occurrence; null for single events. */
export function occurrenceKeyOf(ev: EKEventLike, deviceTz: string): string | null {
  if (!isRecurring(ev)) return null;
  const orig = toEpoch(ev.originalStartDate) ?? toEpoch(ev.startDate);
  if (orig == null) return null;
  return ev.allDay ? epochToZoned(orig, deviceTz).date : iso(orig);
}

export function composeEventId(seriesId: string, occurrenceKey: string | null): string {
  return occurrenceKey ? `${seriesId}${OCC_SEP}${occurrenceKey}` : seriesId;
}

export function parseEventId(eventId: string): { seriesId: string; occurrenceKey: string | null } {
  const m = OCC_ID_RE.exec(eventId);
  return m ? { seriesId: m[1], occurrenceKey: m[2] } : { seriesId: eventId, occurrenceKey: null };
}

/** Device-zone date an occurrence key points at (used to pick a lookup window). */
export function occurrenceKeyDate(key: string, deviceTz: string): LocalDate | null {
  if (isLocalDate(key)) return key;
  if (KEY_INSTANT_RE.test(key)) {
    const ms = Date.parse(key);
    return Number.isFinite(ms) ? epochToZoned(ms, deviceTz).date : null;
  }
  return null;
}

/** Normalise an externally supplied occurrence key to the format `occurrenceKeyOf` emits. */
export function normalizeOccurrenceKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (isLocalDate(key)) return key;
  const ms = Date.parse(key);
  return KEY_INSTANT_RE.test(key) && Number.isFinite(ms) ? iso(ms) : key;
}

export function mapStatus(s: string | null | undefined): ExternalEvent['status'] {
  // The TS enum says 'canceled'; the iOS native layer emits 'cancelled'. Accept both.
  if (s === 'canceled' || s === 'cancelled') return 'cancelled';
  if (s === 'tentative') return 'tentative';
  return 'confirmed';
}

// ─── ranges ──────────────────────────────────────────────────────────────────

/**
 * Split an inclusive date range into consecutive chunks of ≤ maxDays (end exclusive).
 * `maxDays` is clamped to [1, MAX_CHUNK_DAYS]: 0/NaN would never advance, and
 * more than four years would be truncated silently by EventKit.
 */
export function chunkDateRange(from: LocalDate, to: LocalDate, maxDays = MAX_CHUNK_DAYS): { from: LocalDate; toExclusive: LocalDate }[] {
  if (!isLocalDate(from) || !isLocalDate(to) || compareDates(from, to) > 0) return [];
  const step = Number.isFinite(maxDays) ? Math.min(MAX_CHUNK_DAYS, Math.max(1, Math.floor(maxDays))) : MAX_CHUNK_DAYS;
  const end = addDays(to, 1);
  const out: { from: LocalDate; toExclusive: LocalDate }[] = [];
  for (let cur = from; compareDates(cur, end) < 0; ) {
    const next = addDays(cur, step);
    const stop = compareDates(next, end) < 0 ? next : end;
    out.push({ from: cur, toExclusive: stop });
    cur = stop;
  }
  return out;
}

/** Device-zone midnight instants bounding [from, toExclusive). */
export function windowInstants(from: LocalDate, toExclusive: LocalDate, tz: string): { start: Date; end: Date } {
  return {
    start: new Date(zonedToEpoch(from, '00:00', tz).epochMs),
    end: new Date(zonedToEpoch(toExclusive, '00:00', tz).epochMs),
  };
}

// ─── calendars ───────────────────────────────────────────────────────────────

export function calendarAccountId(cal: Pick<EKCalendarLike, 'source' | 'sourceId'>): string {
  return cal.source?.id || cal.sourceId || cal.source?.name || 'unknown';
}

export function accountLabelOf(source: EKSourceLike | null | undefined): string {
  if (!source) return APPLE_ACCOUNT_UNKNOWN;
  if (source.type === 'local') return APPLE_ACCOUNT_LOCAL;
  const name = source.name?.trim();
  return name || APPLE_ACCOUNT_FALLBACK[source.type] || APPLE_ACCOUNT_UNKNOWN;
}

const NEVER_WRITABLE = new Set(['subscribed', 'birthdays']);

export function toExternalCalendar(cal: EKCalendarLike, ctx: { canRead: boolean; defaultCalendarId: string | null }): ExternalCalendar {
  const sourceType = cal.source?.type || cal.type || null;
  const canWrite = !!cal.allowsModifications && !NEVER_WRITABLE.has(sourceType ?? '') && !NEVER_WRITABLE.has(cal.type ?? '');
  const access: AccessRole = canWrite ? 'writer' : 'reader';
  return {
    provider: 'apple',
    accountId: calendarAccountId(cal),
    calendarId: cal.id,
    accountLabel: accountLabelOf(cal.source),
    title: cal.title ?? '',
    color: cal.color || null,
    access,
    canRead: ctx.canRead,
    canWrite,
    isPrimary: ctx.defaultCalendarId != null && ctx.defaultCalendarId === cal.id,
    sourceType,
    sourceName: cal.source?.name || null,
  };
}

// ─── events ──────────────────────────────────────────────────────────────────

export function eventTimes(ev: EKEventLike, deviceTz: string): { allDay: boolean; start: EventTime; end: EventTime } | null {
  const s = toEpoch(ev.startDate);
  if (s == null) return null;
  const rawEnd = toEpoch(ev.endDate);
  const e = rawEnd != null && rawEnd > s ? rawEnd : s;
  if (ev.allDay) {
    const startDate = epochToZoned(s, deviceTz).date;
    // EventKit's all-day end is 23:59:59 of the last day (some sources: next midnight).
    let lastDay = e > s ? epochToZoned(e - 1, deviceTz).date : startDate;
    if (compareDates(lastDay, startDate) < 0) lastDay = startDate;
    return {
      allDay: true,
      start: { date: startDate, time: null, timeZone: null, instant: null },
      end: { date: addDays(lastDay, 1), time: null, timeZone: null, instant: null },
    };
  }
  const zone = eventZone(ev, deviceTz);
  const sz = epochToZoned(s, zone);
  const ez = epochToZoned(e, zone);
  return {
    allDay: false,
    start: { date: sz.date, time: sz.time, timeZone: zone, instant: iso(s) },
    end: { date: ez.date, time: ez.time, timeZone: zone, instant: iso(e) },
  };
}

/** Sort key (epoch ms) of an ExternalEvent start. */
export function startEpoch(x: Pick<ExternalEvent, 'start'>, deviceTz: string): number {
  if (x.start.instant) return Date.parse(x.start.instant);
  return zonedToEpoch(x.start.date, '00:00', deviceTz).epochMs;
}

export function toExternalEvent(ev: EKEventLike, ctx: { accountId: string; deviceTz: string }): ExternalEvent | null {
  const times = eventTimes(ev, ctx.deviceTz);
  if (!times || !ev.id || !ev.calendarId) return null;
  const occurrenceKey = occurrenceKeyOf(ev, ctx.deviceTz);
  const { meta, notes } = readEventMeta(ev.url ?? null, ev.notes ?? null);
  const updated = toEpoch(ev.lastModifiedDate);
  return {
    provider: 'apple',
    accountId: ctx.accountId,
    calendarId: ev.calendarId,
    eventId: composeEventId(ev.id, occurrenceKey),
    recurringEventId: occurrenceKey ? ev.id : null,
    occurrenceKey,
    title: ev.title ?? '',
    notes: notes && notes.trim() ? notes : null,
    location: ev.location?.trim() ? ev.location : null,
    allDay: times.allDay,
    start: times.start,
    end: times.end,
    status: mapStatus(ev.status),
    colorId: null,
    appMeta: meta,
    updated: updated != null ? iso(updated) : null,
  };
}

// ─── drafts → EventKit details ───────────────────────────────────────────────

function draftInstants(draft: EventDraft, deviceTz: string): { start: number; end: number; timeZone: string | null } {
  const { start, end } = draft;
  if (!isLocalDate(start.date) || !isLocalDate(end.date)) throw invalid('date');
  if (draft.allDay) {
    if (compareDates(end.date, start.date) <= 0) throw invalid('end');
    return {
      start: zonedToEpoch(start.date, '00:00', deviceTz).epochMs,
      // Inclusive EventKit end: the last second of the last day (exclusive end − 1 s).
      end: zonedToEpoch(end.date, '00:00', deviceTz).epochMs - 1000,
      timeZone: null,
    };
  }
  const zone = start.timeZone ?? deviceTz;
  const endZone = end.timeZone ?? zone;
  if (!isValidTimeZone(zone) || !isValidTimeZone(endZone)) throw invalid('timeZone');
  if (!isWallTime(start.time) || !isWallTime(end.time)) throw invalid('time');
  const s = zonedToEpoch(start.date, start.time, zone).epochMs;
  const e = zonedToEpoch(end.date, end.time, endZone).epochMs;
  if (!(e > s)) throw invalid('end');
  return { start: s, end: e, timeZone: zone };
}

/**
 * Build the EventKit fields for a draft. Always: `alarms: []` (a historical
 * log never becomes notifications), no attendees, no recurrence.
 * Metadata goes into the URL field unless the existing event carries a URL
 * that is not Serie's (then: trailing notes line, URL untouched).
 */
export function draftToDetails(
  draft: EventDraft,
  opts: { deviceTz: string; mode: 'create' | 'update'; existingUrl?: string | null },
): EventKitDetails {
  const { start, end, timeZone } = draftInstants(draft, opts.deviceTz);
  const cleanNotes = splitNotesMeta(draft.notes).notes;
  const urlFree = !opts.existingUrl || isSerieMetaUrl(opts.existingUrl);
  const notes = urlFree ? cleanNotes : notesWithMeta(cleanNotes, draft.appMeta);
  const location = draft.location?.trim() ? draft.location : null;
  const d: EventKitDetails = {
    title: draft.title,
    allDay: draft.allDay,
    startDate: new Date(start),
    endDate: new Date(end),
    alarms: [],
  };
  if (urlFree) d.url = metaToUrl(draft.appMeta);
  if (opts.mode === 'update') {
    // Explicit nulls clear stale values on the existing event.
    d.notes = notes;
    d.location = location;
    d.timeZone = timeZone;
  } else {
    if (notes != null) d.notes = notes;
    if (location != null) d.location = location;
    if (timeZone != null) d.timeZone = timeZone;
  }
  return d;
}

/**
 * Fallback mapping from what was written, used only if the native object
 * cannot be read back after a successful save (e.g. write-only access).
 */
export function externalFromDraft(
  draft: EventDraft,
  ids: { eventId: string; calendarId: string; accountId: string },
  deviceTz: string,
): ExternalEvent {
  const { start, end, timeZone } = draftInstants(draft, deviceTz);
  const time = (ms: number, date: LocalDate): EventTime =>
    draft.allDay
      ? { date, time: null, timeZone: null, instant: null }
      : { ...epochToZoned(ms, timeZone!), timeZone, instant: iso(ms) };
  return {
    provider: 'apple',
    accountId: ids.accountId,
    calendarId: ids.calendarId,
    eventId: ids.eventId,
    recurringEventId: null,
    occurrenceKey: null,
    title: draft.title,
    notes: splitNotesMeta(draft.notes).notes,
    location: draft.location?.trim() ? draft.location : null,
    allDay: draft.allDay,
    start: time(start, draft.start.date),
    end: time(end, draft.end.date),
    status: 'confirmed',
    colorId: null,
    appMeta: draft.appMeta as AppEventMeta,
    updated: null,
  };
}
