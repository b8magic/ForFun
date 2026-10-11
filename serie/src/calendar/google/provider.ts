/**
 * Google Calendar provider: normalization (Google event ⇄ ExternalEvent /
 * EventDraft) and the `CalendarProvider` implementation. Pure TS — the OAuth
 * flow and the HTTP client are injected (see auth.ts, api.ts, index.ts).
 *
 * Normalization rules
 *  - All-day: start.date + exclusive end.date (end ≤ start or missing → start + 1 day).
 *  - Timed: dateTime → local date/time in the event's timeZone, else the
 *    calendar's timeZone (epochToZoned, DST-correct); `instant` is the UTC ISO.
 *  - Recurring occurrences (singleEvents=true): `recurringEventId` is the series,
 *    `occurrenceKey` is the original start (UTC ISO for timed, date for all-day),
 *    so moved occurrences keep their identity.
 *  - App metadata lives in extendedProperties.private (`serie_*` keys).
 * Writes: sendUpdates=none, no attendees, reminders {useDefault:false, overrides:[]}.
 */
import type { LocalDate } from '@/domain/types';
import { addDays, compareDates, isLocalDate } from '@/domain/dates';
import { epochToZoned, isValidTimeZone, isWallTime, zonedToEpoch, zoneOffsetMinutes } from '@/domain/zoned';
import type {
  AccessRole,
  AppEventMeta,
  CalendarProvider,
  Connection,
  EventDraft,
  EventTime,
  ExternalCalendar,
  ExternalEvent,
  LabelOption,
  ListEventsQuery,
} from '../types';
import { ProviderError } from '../types';
import { canonicalAppMeta, parseAppMeta } from '../appMeta';
import type { GCalCalendarListEntry, GCalColors, GCalDateTime, GCalEvent, GCalEventBody, GoogleCalendarApi } from './api';
import { chunkWindow } from './api';
import type { GoogleAccess } from './auth';
import { GOOGLE_EVENT_COLOR_NAMES_IT, GOOGLE_STRINGS as S, colorFallbackName } from './strings';

// ─── app metadata (extendedProperties.private) ───────────────────────────────

export const APP_META_KEYS = {
  v: 'serie_v',
  session: 'serie_session',
  op: 'serie_op',
  timing: 'serie_timing',
  dur: 'serie_dur',
  src: 'serie_src',
  sched: 'serie_sched',
} as const;

export const APP_META_PREFIX = 'serie_';

/** AppEventMeta → private extended properties (canonical form; null values are omitted). */
export function metaToPrivate(meta: AppEventMeta): Record<string, string> {
  const m = canonicalAppMeta(meta);
  const p: Record<string, string> = {
    [APP_META_KEYS.v]: String(m.v),
    [APP_META_KEYS.session]: m.sessionId,
    [APP_META_KEYS.op]: m.opId,
    [APP_META_KEYS.timing]: m.timingState,
    [APP_META_KEYS.sched]: m.schedulingPlaceholder ? '1' : '0',
  };
  if (m.durationSec != null) p[APP_META_KEYS.dur] = String(m.durationSec);
  if (m.durationSource != null) p[APP_META_KEYS.src] = m.durationSource;
  return p;
}

/**
 * Private extended properties → AppEventMeta. The strings are decoded here and
 * the result goes through the validator every reader shares (`parseAppMeta`):
 * anything malformed or inconsistent yields null, so untrusted metadata never
 * restores timing.
 */
export function privateToMeta(p: Record<string, string> | null | undefined): AppEventMeta | null {
  if (!p || p[APP_META_KEYS.v] !== '1') return null;
  const durRaw = p[APP_META_KEYS.dur];
  let durationSec: number | null | undefined = null;
  if (durRaw != null && durRaw !== '') durationSec = /^\d+$/.test(durRaw) ? Number(durRaw) : undefined;
  if (durationSec === undefined) return null;
  const srcRaw = p[APP_META_KEYS.src];
  const sched = p[APP_META_KEYS.sched];
  return parseAppMeta({
    v: 1,
    sessionId: p[APP_META_KEYS.session],
    opId: p[APP_META_KEYS.op],
    timingState: p[APP_META_KEYS.timing],
    durationSec,
    durationSource: srcRaw == null || srcRaw === '' ? null : srcRaw,
    schedulingPlaceholder: sched === '1' ? true : sched === '0' ? false : undefined,
  });
}

// ─── Google event → ExternalEvent ────────────────────────────────────────────

export interface NormalizeContext {
  accountId: string;
  calendarId: string;
  /** Calendar zone (events.list `timeZone` or calendarList entry), used when the event has none. */
  calendarTimeZone: string | null;
}

const RFC3339_LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

function timedPoint(dt: string, zones: (string | null | undefined)[]): EventTime | null {
  const epoch = Date.parse(dt);
  if (Number.isNaN(epoch)) return null;
  const instant = new Date(epoch).toISOString();
  const zone = zones.find((z): z is string => isValidTimeZone(z));
  if (zone) {
    const z = epochToZoned(epoch, zone);
    return { date: z.date, time: z.time, timeZone: zone, instant };
  }
  // No usable zone: keep the wall time exactly as Google wrote it (offset-qualified).
  const m = RFC3339_LOCAL.exec(dt);
  if (!m) return null;
  return { date: m[1], time: m[2], timeZone: /Z$/i.test(dt) ? 'UTC' : null, instant };
}

const allDayPoint = (date: LocalDate): EventTime => ({ date, time: null, timeZone: null, instant: null });

/** Occurrence identity from originalStartTime: UTC ISO for timed, date for all-day. */
export function occurrenceKeyOf(ost: GCalDateTime | undefined): string | null {
  if (!ost) return null;
  if (ost.dateTime) {
    const t = Date.parse(ost.dateTime);
    return Number.isNaN(t) ? ost.dateTime : new Date(t).toISOString();
  }
  return ost.date && isLocalDate(ost.date) ? ost.date : null;
}

function occurrenceDate(key: string): LocalDate | null {
  if (isLocalDate(key)) return key;
  const t = Date.parse(key);
  return Number.isNaN(t) ? null : epochToZoned(t, 'UTC').date;
}

const STATUSES = ['confirmed', 'tentative', 'cancelled'] as const;

export function normalizeGoogleEvent(ev: GCalEvent, ctx: NormalizeContext): ExternalEvent | null {
  if (!ev?.id) return null;
  // Cancelled occurrences may carry only originalStartTime.
  const startRaw: GCalDateTime | undefined = ev.start?.date || ev.start?.dateTime ? ev.start : ev.originalStartTime;
  if (!startRaw) return null;

  let allDay: boolean;
  let start: EventTime;
  let end: EventTime;
  if (startRaw.date && !startRaw.dateTime) {
    if (!isLocalDate(startRaw.date)) return null;
    allDay = true;
    start = allDayPoint(startRaw.date);
    const endDate = ev.end?.date && isLocalDate(ev.end.date) && compareDates(ev.end.date, startRaw.date) > 0 ? ev.end.date : addDays(startRaw.date, 1);
    end = allDayPoint(endDate);
  } else if (startRaw.dateTime) {
    allDay = false;
    const s = timedPoint(startRaw.dateTime, [startRaw.timeZone, ctx.calendarTimeZone]);
    if (!s) return null;
    start = s;
    const e = ev.end?.dateTime ? timedPoint(ev.end.dateTime, [ev.end.timeZone, s.timeZone, ctx.calendarTimeZone]) : null;
    end = e && e.instant! >= s.instant! ? e : { ...s };
  } else {
    return null;
  }

  const status = STATUSES.includes(ev.status as (typeof STATUSES)[number]) ? (ev.status as ExternalEvent['status']) : 'confirmed';
  const recurringEventId = ev.recurringEventId ?? null;
  return {
    provider: 'google',
    accountId: ctx.accountId,
    calendarId: ctx.calendarId,
    eventId: ev.id,
    recurringEventId,
    occurrenceKey: recurringEventId ? occurrenceKeyOf(ev.originalStartTime) : null,
    title: ev.summary ?? '',
    notes: ev.description ?? null,
    location: ev.location ?? null,
    allDay,
    start,
    end,
    status,
    colorId: ev.colorId ?? null,
    appMeta: privateToMeta(ev.extendedProperties?.private),
    updated: ev.updated ?? null,
  };
}

// ─── EventDraft → Google body ────────────────────────────────────────────────

const COLOR_ID_RE = /^(?:[1-9]|1[01])$/;

/** Wall time on a date in a zone → RFC 3339 with the zone's offset at that instant. */
export function toGoogleDateTime(date: LocalDate, time: string, timeZone: string): { dateTime: string; epochMs: number } {
  const r = zonedToEpoch(date, time, timeZone);
  const local = epochToZoned(r.epochMs, timeZone); // nonexistent times are shifted forward (domain rule)
  const off = zoneOffsetMinutes(timeZone, r.epochMs);
  const abs = Math.abs(off);
  const sign = off >= 0 ? '+' : '-';
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return { dateTime: `${local.date}T${local.time}:00${sign}${hh}:${mm}`, epochMs: r.epochMs };
}

/**
 * Build the insert/update body. Title is sent verbatim (spacing preserved);
 * empty notes/location are omitted; no attendees; no reminders.
 */
export function draftToGoogleBody(draft: EventDraft): GCalEventBody {
  if (draft.colorId != null && !COLOR_ID_RE.test(draft.colorId)) throw new ProviderError('invalid', S.invalidColor);
  if (!isLocalDate(draft.start.date)) throw new ProviderError('invalid', S.invalidTiming);

  let start: GCalDateTime;
  let end: GCalDateTime;
  if (draft.allDay) {
    const endDate = isLocalDate(draft.end.date) && compareDates(draft.end.date, draft.start.date) > 0 ? draft.end.date : addDays(draft.start.date, 1);
    start = { date: draft.start.date };
    end = { date: endDate };
  } else {
    const zone = draft.start.timeZone;
    if (!isWallTime(draft.start.time) || !isValidTimeZone(zone)) throw new ProviderError('invalid', S.invalidTiming);
    const endZone = isValidTimeZone(draft.end.timeZone) ? draft.end.timeZone : zone;
    if (!isLocalDate(draft.end.date) || !isWallTime(draft.end.time)) throw new ProviderError('invalid', S.invalidTiming);
    const s = toGoogleDateTime(draft.start.date, draft.start.time, zone);
    const e = toGoogleDateTime(draft.end.date, draft.end.time, endZone);
    if (!(e.epochMs > s.epochMs)) throw new ProviderError('invalid', S.invalidTiming);
    start = { dateTime: s.dateTime, timeZone: zone };
    end = { dateTime: e.dateTime, timeZone: endZone };
  }

  const body: GCalEventBody = {
    summary: draft.title,
    start,
    end,
    reminders: { useDefault: false, overrides: [] },
    extendedProperties: { private: metaToPrivate(draft.appMeta) },
  };
  if (draft.notes != null && draft.notes !== '') body.description = draft.notes;
  if (draft.location != null && draft.location !== '') body.location = draft.location;
  if (draft.colorId != null) body.colorId = draft.colorId;
  return body;
}

/**
 * Full-replacement body for events.update: the existing event with Serie's
 * managed fields replaced. Other apps' private properties, shared properties,
 * attendees already on the event (never added by Serie), the event's own
 * reminders (Serie adds none, but does not silently strip the user's either:
 * the review never shows such a change) and other fields stay.
 */
export function mergeForUpdate(current: GCalEvent, next: GCalEventBody): GCalEvent {
  const otherPrivate = Object.fromEntries(Object.entries(current.extendedProperties?.private ?? {}).filter(([k]) => !k.startsWith(APP_META_PREFIX)));
  const merged: GCalEvent = {
    ...current,
    summary: next.summary,
    start: next.start,
    end: next.end,
    reminders: current.reminders ?? next.reminders,
    extendedProperties: { ...(current.extendedProperties ?? {}), private: { ...otherPrivate, ...next.extendedProperties.private } },
  };
  if (next.description !== undefined) merged.description = next.description;
  else delete merged.description;
  if (next.location !== undefined) merged.location = next.location;
  else delete merged.location;
  if (next.colorId !== undefined) merged.colorId = next.colorId;
  else delete merged.colorId;
  return merged;
}

// ─── calendars & labels ──────────────────────────────────────────────────────

export function mapAccessRole(role: string | undefined): AccessRole {
  return role === 'owner' || role === 'writer' || role === 'reader' || role === 'freeBusyReader' ? role : 'unknown';
}

export function mapCalendar(c: GCalCalendarListEntry, conn: { accountId: string; canRead: boolean; canWrite: boolean }): ExternalCalendar {
  const access = mapAccessRole(c.accessRole);
  return {
    provider: 'google',
    accountId: conn.accountId,
    calendarId: c.id,
    accountLabel: conn.accountId,
    title: c.summaryOverride || c.summary || c.id,
    color: c.backgroundColor ?? null,
    access,
    // freeBusyReader sees only busy blocks, never event details.
    canRead: conn.canRead && (access === 'owner' || access === 'writer' || access === 'reader'),
    canWrite: conn.canWrite && (access === 'owner' || access === 'writer'),
    isPrimary: !!c.primary,
    sourceType: null,
    sourceName: null,
  };
}

export function mapLabels(colors: GCalColors): LabelOption[] {
  return Object.entries(colors.event ?? {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([id, def]) => ({ id, name: GOOGLE_EVENT_COLOR_NAMES_IT[id] ?? colorFallbackName(id), color: def.background }));
}

// ─── provider ────────────────────────────────────────────────────────────────

/** What the provider needs from the OAuth layer (GoogleAuth implements it). */
export interface GoogleAuthPort {
  getConnection(): Promise<Connection>;
  connect(access: GoogleAccess): Promise<Connection>;
  disconnect(): Promise<unknown>;
}

export interface GoogleProviderDeps {
  auth: GoogleAuthPort;
  api: GoogleCalendarApi;
}

type ActiveConnection = Connection & { accountId: string };

export class GoogleCalendarProvider implements CalendarProvider {
  readonly kind = 'google' as const;
  readonly capabilities = { eventLabels: true };
  private readonly tz = new Map<string, string>();

  constructor(private readonly deps: GoogleProviderDeps) {}

  getConnection(): Promise<Connection> {
    return this.deps.auth.getConnection();
  }

  connect(access: 'read' | 'readwrite'): Promise<Connection> {
    return this.deps.auth.connect(access);
  }

  async disconnect(): Promise<void> {
    this.tz.clear();
    await this.deps.auth.disconnect();
  }

  private async active(need: 'any' | 'read' | 'write' | 'events'): Promise<ActiveConnection> {
    const c = await this.deps.auth.getConnection();
    if ((c.status !== 'connected' && c.status !== 'write_only') || !c.accountId) {
      const code = c.status === 'not_configured' || c.status === 'unavailable' ? 'unavailable' : 'unauthorized';
      throw new ProviderError(code, c.detail ?? S.unauthorized);
    }
    if (need === 'read' && !c.canRead) throw new ProviderError('forbidden', S.needsRead);
    if (need === 'write' && !c.canWrite) throw new ProviderError('forbidden', S.needsWrite);
    // calendar.events also allows reading events (not the calendar list).
    if (need === 'events' && !c.canRead && !c.canWrite) throw new ProviderError('forbidden', S.needsRead);
    return c as ActiveConnection;
  }

  private async calendarTz(calendarId: string): Promise<string | null> {
    const known = this.tz.get(calendarId);
    if (known) return known;
    try {
      const entry = await this.deps.api.getCalendarListEntry(calendarId);
      if (entry?.timeZone) {
        this.tz.set(calendarId, entry.timeZone);
        return entry.timeZone;
      }
    } catch {
      // fall back to the event's own zone / offset
    }
    return null;
  }

  async listCalendars(): Promise<ExternalCalendar[]> {
    const w = await this.active('any');
    if (!w.canRead && w.canWrite) {
      // Write-only consent (calendar.events) cannot read the calendar list. The account's primary
      // calendar (id = account email) is the one destination we can name honestly.
      return [
        { provider: 'google', accountId: w.accountId, calendarId: w.accountId, accountLabel: w.accountLabel ?? w.accountId, title: S.primaryCalendar, color: null, access: 'writer', canRead: false, canWrite: true, isPrimary: true, sourceType: null, sourceName: null },
      ];
    }
    const c = await this.active('read');
    const items = await this.deps.api.listCalendars();
    return items.map((entry) => {
      if (entry.timeZone) this.tz.set(entry.id, entry.timeZone);
      return mapCalendar(entry, c);
    });
  }

  async listLabels(): Promise<LabelOption[]> {
    // colors.get accepts calendar.readonly / calendar, not calendar.events: no doomed request on write-only consent.
    await this.active('read');
    return mapLabels(await this.deps.api.getColors());
  }

  /**
   * Every occurrence whose local start date lies in [from, to], across all
   * pages and year chunks of every requested calendar. Cancelled occurrences
   * only when requested.
   */
  async listEvents(q: ListEventsQuery): Promise<ExternalEvent[]> {
    if (!isLocalDate(q.from) || !isLocalDate(q.to) || compareDates(q.from, q.to) > 0) throw new ProviderError('invalid', S.invalid);
    const c = await this.active('read');
    const out: ExternalEvent[] = [];
    let fetched = 0;
    for (const calendarId of [...new Set(q.calendarIds)]) {
      const { items, timeZone, accessRole } = await this.deps.api.listEventsRange(calendarId, {
        from: q.from,
        to: q.to,
        showDeleted: !!q.includeCancelled,
        signal: q.signal,
        onPage: (n) => {
          fetched += n;
          q.onProgress?.(fetched);
        },
      });
      // Free/busy access returns busy blocks without titles or notes: never list them as readable events.
      if (accessRole === 'freeBusyReader') throw new ProviderError('forbidden', S.freeBusyOnly);
      if (timeZone) this.tz.set(calendarId, timeZone);
      const ctx: NormalizeContext = { accountId: c.accountId, calendarId, calendarTimeZone: timeZone ?? this.tz.get(calendarId) ?? null };
      for (const item of items) {
        const ev = normalizeGoogleEvent(item, ctx);
        if (!ev) continue;
        if (ev.status === 'cancelled' && !q.includeCancelled) continue;
        if (compareDates(ev.start.date, q.from) < 0 || compareDates(ev.start.date, q.to) > 0) continue;
        out.push(ev);
      }
    }
    return out;
  }

  /** Find one occurrence of a series by its occurrence key (series id given). */
  private async findInstance(calendarId: string, seriesId: string, occurrenceKey: string, ctx: NormalizeContext): Promise<{ raw: GCalEvent; ev: ExternalEvent } | null> {
    const d = occurrenceDate(occurrenceKey);
    if (!d) return null;
    const w = chunkWindow({ from: addDays(d, -1), to: addDays(d, 1) });
    const instances = await this.deps.api.listInstances(calendarId, seriesId, { ...w, showDeleted: true });
    for (const raw of instances) {
      const ev = normalizeGoogleEvent(raw, ctx);
      if (ev?.occurrenceKey === occurrenceKey) return { raw, ev };
    }
    return null;
  }

  private async resolve(calendarId: string, eventId: string, occurrenceKey: string | null | undefined, accountId: string) {
    const raw = await this.deps.api.getEvent(calendarId, eventId);
    if (!raw) return null;
    const ctx: NormalizeContext = { accountId, calendarId, calendarTimeZone: await this.calendarTz(calendarId) };
    const isSeries = !!raw.recurrence?.length && !raw.recurringEventId;
    if (occurrenceKey && isSeries) return this.findInstance(calendarId, eventId, occurrenceKey, ctx);
    const ev = normalizeGoogleEvent(raw, ctx);
    return ev ? { raw, ev, isSeries } : null;
  }

  async getEvent(calendarId: string, eventId: string, occurrenceKey?: string | null): Promise<ExternalEvent | null> {
    const c = await this.active('events');
    return (await this.resolve(calendarId, eventId, occurrenceKey, c.accountId))?.ev ?? null;
  }

  async findByOpId(calendarId: string, opId: string, around: { from: LocalDate; to: LocalDate }): Promise<ExternalEvent | null> {
    if (!isLocalDate(around.from) || !isLocalDate(around.to) || compareDates(around.from, around.to) > 0) throw new ProviderError('invalid', S.invalid);
    const c = await this.active('events');
    const { items, timeZone } = await this.deps.api.listEventsRange(calendarId, {
      from: around.from,
      to: around.to,
      privateExtendedProperty: [`${APP_META_KEYS.op}=${opId}`],
    });
    if (timeZone) this.tz.set(calendarId, timeZone);
    const ctx: NormalizeContext = { accountId: c.accountId, calendarId, calendarTimeZone: timeZone ?? this.tz.get(calendarId) ?? null };
    let unreadable = false;
    for (const item of items) {
      const ev = normalizeGoogleEvent(item, ctx);
      if (ev && ev.status !== 'cancelled' && ev.appMeta?.opId === opId) return ev;
      if (item?.status !== 'cancelled' && item?.extendedProperties?.private?.[APP_META_KEYS.op] === opId) unreadable = true;
    }
    // An event of this very operation exists but its metadata cannot be trusted: reporting
    // "not found" would let the caller create a second event. Ask for review instead.
    if (unreadable) throw new ProviderError('conflict', S.opIdUnreadable);
    return null;
  }

  async createEvent(calendarId: string, draft: EventDraft): Promise<ExternalEvent> {
    const c = await this.active('write');
    const body = draftToGoogleBody(draft);
    const created = await this.deps.api.insertEvent(calendarId, body);
    const ev = created
      ? normalizeGoogleEvent(created, { accountId: c.accountId, calendarId, calendarTimeZone: this.tz.get(calendarId) ?? draft.start.timeZone ?? null })
      : null;
    // Google accepted the insert but the response is unusable: reconcile via findByOpId.
    if (!ev) throw new ProviderError('uncertain', S.uncertain);
    return ev;
  }

  /**
   * Explicit, confirmed update of a linked event: read the current event,
   * replace Serie's fields, write it back with If-Match (412 → conflict).
   */
  async updateEvent(calendarId: string, eventId: string, draft: EventDraft, occurrenceKey?: string | null): Promise<ExternalEvent> {
    const c = await this.active('write');
    const body = draftToGoogleBody(draft);
    const target = await this.resolve(calendarId, eventId, occurrenceKey, c.accountId);
    if (!target) throw new ProviderError('not_found', S.notFound);
    // Deleted on Google (events.get still returns it as cancelled): writing it back would report an
    // "updated" event that nobody can see, or silently restore what the user deleted.
    if (target.ev.status === 'cancelled') throw new ProviderError('not_found', S.linkedDeleted);
    // A full replacement of a series master would move every occurrence of the series.
    if ('isSeries' in target && target.isSeries) throw new ProviderError('invalid', S.seriesUpdate);
    const updated = await this.deps.api.updateEvent(calendarId, target.raw.id, mergeForUpdate(target.raw, body), target.raw.etag);
    const ev = updated ? normalizeGoogleEvent(updated, { accountId: c.accountId, calendarId, calendarTimeZone: this.tz.get(calendarId) ?? draft.start.timeZone ?? null }) : null;
    if (!ev) throw new ProviderError('unavailable', S.unavailable);
    return ev;
  }
}
