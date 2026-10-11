/**
 * Apple / iPhone calendars provider (EventKit through expo-calendar 57).
 *
 * API choice: since expo-calendar 56.0.7 the object-oriented API
 * (`ExpoCalendar`, `ExpoCalendarEvent`, `getCalendars`, `requestCalendarPermissions`,
 * …) is the root `expo-calendar` export and the one the SDK 57 docs recommend;
 * the old function API moved to `expo-calendar/legacy` and its root aliases
 * throw at runtime. We use only the root API:
 *   - getCalendarPermissions(writeOnly) / requestCalendarPermissions(writeOnly)
 *   - getCalendars(EntityTypes.EVENT), getDefaultCalendarSync()
 *   - ExpoCalendar.get(id) → calendar.listEvents(start, end) / calendar.createEvent(details)
 *   - ExpoCalendarEvent.get(id) → event.update(details)
 * Calendar-instance methods are used (not the module-level `listEvents`)
 * because only they return JS `ExpoCalendarEvent` instances whose `update()`
 * stringifies dates and sends explicit nulls to the native side.
 *
 * One legacy function is used, as a read-only LOCATOR: `getEventAsync` from
 * `expo-calendar/legacy` (the documented import path for the legacy API).
 * `ExpoCalendarEvent.get(id)` looks events up natively with
 * `eventWithIdentifier:` (an EKEvent `eventIdentifier`) while every `id` the
 * root API hands out is a `calendarItemIdentifier`, so on a device it usually
 * misses. The legacy lookup uses `calendarItemWithIdentifier:`, the matching
 * namespace. We only read its current start date and calendar, then fetch the
 * object to update through the root API around that date.
 *
 * Expo Go: the root API is replaced by a stub whose module functions are
 * `undefined` (they do not throw), so availability is checked explicitly.
 *
 * Access model (iOS 17+):
 *  - connect() always requests FULL access (`requestCalendarPermissions(false)`),
 *    for 'read' and 'readwrite' alike: export must check the real destination
 *    for duplicates, which needs readable events. Write-only is never requested.
 *  - Full access is detected with `getCalendarPermissions(false)` (the native
 *    full-access requester reports `.writeOnly` as denied); write-only with
 *    `getCalendarPermissions(true)` (granted for `.writeOnly` or `.fullAccess`).
 *    A user can end up write-only by downgrading in iOS Settings; we then report
 *    'write_only' (canRead=false, canWrite=true) and refuse every read.
 *  - iOS permissions cannot be revoked by an app: disconnect() records a
 *    "disconnected in Serie" flag (persisted through the optional `settings`
 *    store) and the provider refuses to touch calendars until connect().
 *
 * Recurring occurrences: EventKit occurrences share one identifier. We match an
 * occurrence by series id + ORIGINAL start (`originalStartDate`), list it via
 * `calendar.listEvents` around that date and update that very occurrence
 * object, which saves with span `.thisEvent` (only that instance changes and
 * becomes detached; the series and other occurrences are untouched).
 * We deliberately do not use `getOccurrenceSync({ instanceStartDate })`: its
 * native lookup matches on the occurrence's CURRENT start and does not check
 * the event id, so a moved occurrence or another event starting at the same
 * instant in the same calendar could be targeted.
 */
import {
  EntityTypes,
  ExpoCalendar,
  ExpoCalendarEvent,
  getCalendarPermissions,
  getCalendars,
  getDefaultCalendarSync,
  requestCalendarPermissions,
  type ModifiableEventProperties,
} from 'expo-calendar';
import { getEventAsync as legacyGetEventAsync } from 'expo-calendar/legacy';
import { Platform } from 'react-native';

import { ProviderError } from '../types';
import type {
  CalendarProvider,
  Connection,
  ConnectionStatus,
  EventDraft,
  ExternalCalendar,
  ExternalEvent,
  LabelOption,
  ListEventsQuery,
} from '../types';
import type { LocalDate } from '@/domain/types';
import { addDays, compareDates, isLocalDate } from '@/domain/dates';
import { deviceTimeZone, epochToZoned } from '@/domain/zoned';
import {
  calendarAccountId,
  chunkDateRange,
  draftToDetails,
  externalFromDraft,
  isRecurring,
  normalizeOccurrenceKey,
  occurrenceKeyDate,
  occurrenceKeyOf,
  parseEventId,
  startEpoch,
  toEpoch,
  toExternalCalendar,
  toExternalEvent,
  windowInstants,
  type EKEventLike,
} from './mapping';
import {
  APPLE_DETAIL_DENIED,
  APPLE_DETAIL_DISCONNECTED,
  APPLE_DETAIL_EXPO_GO,
  APPLE_DETAIL_NOT_ASKED,
  APPLE_DETAIL_NOT_CONFIGURED,
  APPLE_DETAIL_UNAVAILABLE,
  APPLE_DETAIL_WRITE_ONLY,
  APPLE_ERR_ABORTED,
  APPLE_ERR_CALENDAR_NOT_FOUND,
  APPLE_ERR_DISCONNECTED,
  APPLE_ERR_EVENT_NOT_FOUND,
  APPLE_ERR_INVALID_EVENT,
  APPLE_ERR_NEEDS_READ,
  APPLE_ERR_NO_ACCESS,
  APPLE_ERR_NOT_CONFIGURED,
  APPLE_ERR_OCCURRENCE_REQUIRED,
  APPLE_ERR_READ_ONLY_CALENDAR,
  APPLE_ERR_UNAVAILABLE,
  APPLE_ERR_UNKNOWN,
  APPLE_ERR_WRITE_ONLY_CALENDAR,
  APPLE_ERR_WRONG_CALENDAR,
} from './strings';

/** Settings key for the "disconnected in Serie" flag. */
export const APPLE_DISCONNECTED_KEY = 'calendar.apple.disconnected';

/** Structural subset of `settingsRepo` (src/data/repositories.ts). */
export interface AppleSettingsStore {
  get<T>(key: string, fallback: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
}

export interface AppleProviderOptions {
  /** Defaults to `Platform.OS`, read at call time. */
  platformOS?: () => string;
  /** IANA zone EventKit uses for floating/all-day events. Defaults to the device zone. */
  deviceTimeZone?: () => string;
  /** Persists the "disconnected in Serie" flag across launches (otherwise in memory only). */
  settings?: AppleSettingsStore;
}

export type AppleAccessState = 'full' | 'write_only' | 'undetermined' | 'denied' | 'not_configured';

type Need = 'list' | 'write' | 'read';

const HINT_LIMIT = 2000;

// ─── native error mapping ────────────────────────────────────────────────────

function errParts(e: unknown): { code: string; msg: string } {
  const o = (e ?? {}) as { code?: unknown; message?: unknown };
  return { code: String(o.code ?? ''), msg: String(o.message ?? e ?? '') };
}

/** Errors thrown by expo-calendar's Expo Go stub (its classes and instance methods). */
export function isExpoGoError(e: unknown): boolean {
  return /Expo Go/.test(errParts(e).msg);
}

/**
 * False in Expo Go: there the root API is a stub class, so the module-level
 * functions re-exported by `expo-calendar` (`getCalendarPermissions`, …) are
 * `undefined` and calling them throws a bare TypeError, not an "Expo Go" error.
 */
export function isRootApiAvailable(): boolean {
  return typeof getCalendarPermissions === 'function' && typeof requestCalendarPermissions === 'function';
}

export function isMissingPlistError(e: unknown): boolean {
  const { code, msg } = errParts(e);
  return /PLIST/i.test(code) || /Info\.plist/i.test(msg);
}

function isNotFoundError(e: unknown): boolean {
  const { code, msg } = errParts(e);
  return /NOT_FOUND|NO_LONGER_EXISTS/i.test(code) || /could not be found|no longer exists|was not found/i.test(msg);
}

/** Map an expo-calendar / EventKit error to a ProviderError. */
export function mapNativeError(e: unknown, subject: 'calendar' | 'event' = 'event'): ProviderError {
  if (e instanceof ProviderError) return e;
  const { code, msg } = errParts(e);
  let out: ProviderError;
  if (isExpoGoError(e)) out = new ProviderError('unavailable', APPLE_DETAIL_EXPO_GO);
  else if (isMissingPlistError(e)) out = new ProviderError('forbidden', APPLE_ERR_NOT_CONFIGURED);
  else if (/PERMISSION/i.test(code) || /permission is required/i.test(msg)) out = new ProviderError('unauthorized', APPLE_ERR_NO_ACCESS);
  else if (/CALENDAR_ID_NOT_FOUND|CALENDAR_NO_LONGER_EXISTS/i.test(code) || /Calendar with id .* could not be found|calendar no longer exists/i.test(msg))
    out = new ProviderError('not_found', APPLE_ERR_CALENDAR_NOT_FOUND);
  else if (isNotFoundError(e)) out = new ProviderError('not_found', subject === 'calendar' ? APPLE_ERR_CALENDAR_NOT_FOUND : APPLE_ERR_EVENT_NOT_FOUND);
  else if (/IMMUTABLE|CALENDAR_NOT_SAVED/i.test(code) || /immutable|read-only|read only/i.test(msg))
    out = new ProviderError('forbidden', APPLE_ERR_READ_ONLY_CALENDAR);
  else if (/INVALID|MISSING_PARAMETER/i.test(code) || /Invalid time zone|could not be interpreted as a date|is not of type/i.test(msg))
    out = new ProviderError('invalid', APPLE_ERR_INVALID_EVENT);
  // EventKit saves with commit:true are atomic and synchronous: a thrown save
  // wrote nothing, so an unknown failure is a definite failure, not 'uncertain'.
  else out = new ProviderError('unknown', APPLE_ERR_UNKNOWN);
  (out as { cause?: unknown }).cause = e;
  return out;
}

function isValidRange(from: unknown, to: unknown): boolean {
  return isLocalDate(from) && isLocalDate(to) && compareDates(from, to) <= 0;
}

function abortError(): Error {
  const e = new Error(APPLE_ERR_ABORTED);
  e.name = 'AbortError';
  return e;
}

// ─── provider ────────────────────────────────────────────────────────────────

export class AppleCalendarProvider implements CalendarProvider {
  readonly kind = 'apple' as const;
  /** EventKit has no per-event colour labels; the UI discloses it (t.labelsUnsupported). */
  readonly capabilities = { eventLabels: false };

  private readonly platformOS: () => string;
  private readonly tz: () => string;
  private readonly settings: AppleSettingsStore | null;
  private disconnectedCache: boolean | null = null;
  /** seriesId → last seen device-zone start date; narrows lookups when `ExpoCalendarEvent.get` cannot resolve an id. */
  private readonly hints = new Map<string, LocalDate>();

  constructor(opts: AppleProviderOptions = {}) {
    this.platformOS = opts.platformOS ?? (() => Platform.OS);
    this.tz = opts.deviceTimeZone ?? deviceTimeZone;
    this.settings = opts.settings ?? null;
  }

  // ─── connection ────────────────────────────────────────────────────────────

  private isIos(): boolean {
    return this.platformOS() === 'ios';
  }

  private conn(status: ConnectionStatus, canRead: boolean, canWrite: boolean, detail: string | null): Connection {
    return { provider: 'apple', status, accountId: null, accountLabel: null, canRead, canWrite, detail };
  }

  private async isDisconnected(): Promise<boolean> {
    if (this.disconnectedCache != null) return this.disconnectedCache;
    let v = false;
    if (this.settings) {
      try {
        v = (await this.settings.get<boolean>(APPLE_DISCONNECTED_KEY, false)) === true;
      } catch {
        // Unknown → refuse (fail closed, not cached): a user's "disconnect" must
        // never be ignored because the settings store could not be read.
        return true;
      }
    }
    this.disconnectedCache = v;
    return v;
  }

  private async setDisconnected(v: boolean): Promise<void> {
    this.disconnectedCache = v;
    if (this.settings) await this.settings.set(APPLE_DISCONNECTED_KEY, v);
  }

  /** Current EventKit authorisation, without prompting. */
  async accessState(): Promise<AppleAccessState> {
    if (!isRootApiAvailable()) throw new ProviderError('unavailable', APPLE_DETAIL_EXPO_GO);
    let full;
    try {
      full = await getCalendarPermissions(false);
    } catch (e) {
      if (isMissingPlistError(e)) return 'not_configured';
      throw mapNativeError(e);
    }
    if (full.granted) return 'full';
    let writeOnly = null;
    try {
      writeOnly = await getCalendarPermissions(true);
    } catch {
      writeOnly = null;
    }
    if (writeOnly?.granted) return 'write_only';
    return full.status === 'undetermined' ? 'undetermined' : 'denied';
  }

  async getConnection(): Promise<Connection> {
    if (!this.isIos()) return this.conn('unavailable', false, false, APPLE_DETAIL_UNAVAILABLE);
    if (await this.isDisconnected()) return this.conn('disconnected', false, false, APPLE_DETAIL_DISCONNECTED);
    let state: AppleAccessState;
    try {
      state = await this.accessState();
    } catch (e) {
      const err = mapNativeError(e);
      return this.conn('unavailable', false, false, err.code === 'unavailable' ? err.message : APPLE_ERR_UNKNOWN);
    }
    switch (state) {
      case 'full':
        return this.conn('connected', true, true, null);
      case 'write_only':
        return this.conn('write_only', false, true, APPLE_DETAIL_WRITE_ONLY);
      case 'undetermined':
        return this.conn('disconnected', false, false, APPLE_DETAIL_NOT_ASKED);
      case 'not_configured':
        return this.conn('not_configured', false, false, APPLE_DETAIL_NOT_CONFIGURED);
      default:
        return this.conn('denied', false, false, APPLE_DETAIL_DENIED);
    }
  }

  /**
   * The only place that prompts. Full access is requested for both 'read' and
   * 'readwrite' (duplicate checks before export need to read the destination).
   */
  async connect(_access: 'read' | 'readwrite'): Promise<Connection> {
    if (!this.isIos()) return this.getConnection();
    if (!isRootApiAvailable()) return this.conn('unavailable', false, false, APPLE_DETAIL_EXPO_GO);
    await this.setDisconnected(false);
    try {
      await requestCalendarPermissions(false);
    } catch (e) {
      if (isMissingPlistError(e)) return this.conn('not_configured', false, false, APPLE_DETAIL_NOT_CONFIGURED);
      if (isExpoGoError(e)) return this.conn('unavailable', false, false, APPLE_DETAIL_EXPO_GO);
      throw mapNativeError(e);
    }
    return this.getConnection();
  }

  async disconnect(): Promise<void> {
    this.hints.clear();
    await this.setDisconnected(true);
  }

  private async require(need: Need): Promise<AppleAccessState> {
    if (!this.isIos()) throw new ProviderError('unavailable', APPLE_ERR_UNAVAILABLE);
    if (await this.isDisconnected()) throw new ProviderError('unauthorized', APPLE_ERR_DISCONNECTED);
    const state = await this.accessState();
    if (state === 'full') return state;
    if (state === 'write_only') {
      if (need === 'read') throw new ProviderError('forbidden', APPLE_ERR_NEEDS_READ);
      return state;
    }
    if (state === 'not_configured') throw new ProviderError('forbidden', APPLE_ERR_NOT_CONFIGURED);
    throw new ProviderError('unauthorized', APPLE_ERR_NO_ACCESS);
  }

  // ─── calendars & labels ────────────────────────────────────────────────────

  async listCalendars(): Promise<ExternalCalendar[]> {
    const state = await this.require('list');
    let cals: ExpoCalendar[];
    try {
      cals = await getCalendars(EntityTypes.EVENT);
    } catch (e) {
      throw mapNativeError(e, 'calendar');
    }
    let defaultId: string | null = null;
    try {
      defaultId = getDefaultCalendarSync()?.id ?? null;
    } catch {
      defaultId = null;
    }
    // With write-only access iOS returns one virtual calendar: listed, but canRead=false.
    return cals
      .filter((c) => !c.entityType || c.entityType === EntityTypes.EVENT || (c.entityType as string) === 'both')
      .map((c) => toExternalCalendar(c, { canRead: state === 'full', defaultCalendarId: defaultId }))
      .sort((a, b) => a.accountLabel.localeCompare(b.accountLabel) || a.title.localeCompare(b.title));
  }

  /** EventKit events have no colour labels. */
  async listLabels(): Promise<LabelOption[]> {
    return [];
  }

  // ─── reading ───────────────────────────────────────────────────────────────

  private async calendar(calendarId: string): Promise<ExpoCalendar> {
    try {
      return await ExpoCalendar.get(calendarId);
    } catch (e) {
      throw mapNativeError(e, 'calendar');
    }
  }

  private async calendarOrNull(calendarId: string): Promise<ExpoCalendar | null> {
    try {
      return await this.calendar(calendarId);
    } catch (e) {
      if (e instanceof ProviderError && e.code === 'not_found') return null;
      throw e;
    }
  }

  private map(ev: EKEventLike, cal: ExpoCalendar): ExternalEvent | null {
    const x = toExternalEvent(ev, { accountId: calendarAccountId(cal), deviceTz: this.tz() });
    if (x && !x.occurrenceKey) this.rememberHint(ev.id, x.start.date);
    return x;
  }

  private rememberHint(seriesId: string, date: LocalDate) {
    this.hints.delete(seriesId);
    this.hints.set(seriesId, date);
    if (this.hints.size > HINT_LIMIT) this.hints.delete(this.hints.keys().next().value as string);
  }

  /** All events of one calendar overlapping [from, to] (inclusive dates), in ≤1-year predicate chunks. */
  private async scan(cal: ExpoCalendar, from: LocalDate, to: LocalDate, signal?: AbortSignal): Promise<ExpoCalendarEvent[]> {
    const tz = this.tz();
    const out: ExpoCalendarEvent[] = [];
    for (const chunk of chunkDateRange(from, to)) {
      if (signal?.aborted) throw abortError();
      const { start, end } = windowInstants(chunk.from, chunk.toExclusive, tz);
      try {
        out.push(...(await cal.listEvents(start, end)));
      } catch (e) {
        throw mapNativeError(e);
      }
    }
    return out;
  }

  async listEvents(q: ListEventsQuery): Promise<ExternalEvent[]> {
    await this.require('read');
    // An inverted range is a caller bug: fail loudly instead of "no events".
    if (!isValidRange(q.from, q.to)) throw new ProviderError('invalid', APPLE_ERR_INVALID_EVENT);
    const ids = [...new Set(q.calendarIds)];
    if (!ids.length) return [];
    const tz = this.tz();
    const cals: ExpoCalendar[] = [];
    for (const id of ids) cals.push(await this.calendar(id)); // a missing source calendar fails loudly, never silently
    const seen = new Set<string>();
    const out: ExternalEvent[] = [];
    let fetched = 0;
    for (const chunk of chunkDateRange(q.from, q.to)) {
      for (const cal of cals) {
        if (q.signal?.aborted) throw abortError();
        const { start, end } = windowInstants(chunk.from, chunk.toExclusive, tz);
        let evs: ExpoCalendarEvent[];
        try {
          evs = await cal.listEvents(start, end);
        } catch (e) {
          throw mapNativeError(e);
        }
        for (const ev of evs) {
          if (ev.calendarId && ev.calendarId !== cal.id) continue;
          const x = this.map(ev, cal);
          if (!x) continue;
          // An event crossing a chunk boundary is returned by both predicates.
          const key = `${x.calendarId}\u0000${x.eventId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          fetched++;
          if (x.status === 'cancelled' && !q.includeCancelled) continue;
          out.push(x);
        }
        q.onProgress?.(fetched);
      }
    }
    return out.sort((a, b) => startEpoch(a, tz) - startEpoch(b, tz) || a.eventId.localeCompare(b.eventId));
  }

  /**
   * Current device-zone start date and calendar of an event, by
   * `calendarItemIdentifier`, through the legacy lookup (see header).
   * Best effort: any failure is a miss (the caller then scans hinted dates).
   */
  private async legacyLookup(seriesId: string): Promise<EKEventLike | null> {
    try {
      const e = (await legacyGetEventAsync(seriesId)) as EKEventLike | null | undefined;
      return e && e.id === seriesId && typeof e.calendarId === 'string' ? e : null;
    } catch {
      return null;
    }
  }

  /**
   * Locate the native object of an event (or of one occurrence) in a calendar.
   * Occurrences: matched by series id + original start in windows around the
   * key, then around the caller's hint dates, then ±1 year (moved occurrences).
   * Single events: `ExpoCalendarEvent.get(id)` first; because its native lookup
   * uses `eventWithIdentifier:` while `id` is a `calendarItemIdentifier`, a miss
   * falls back to the legacy `calendarItemWithIdentifier:` lookup (which gives
   * the event's calendar and current start, wherever it was moved), then to
   * scanning around the last seen/hinted dates.
   * Returns the calendar object to use afterwards (refetched after a legacy
   * lookup) and, for reads only, the legacy snapshot when no root-API object
   * could be obtained.
   */
  private async locate(
    cal: ExpoCalendar,
    seriesId: string,
    key: string | null,
    hintDates: LocalDate[],
  ): Promise<{ ev: ExpoCalendarEvent | null; cal: ExpoCalendar; otherCalendar: boolean; snapshot: EKEventLike | null }> {
    const tz = this.tz();
    const windows: [LocalDate, LocalDate][] = [];
    const addWindow = (d: LocalDate | null | undefined, pad: number) => {
      if (!d || !isLocalDate(d)) return;
      const w: [LocalDate, LocalDate] = [addDays(d, -pad), addDays(d, pad)];
      if (!windows.some((x) => x[0] === w[0] && x[1] === w[1])) windows.push(w);
    };

    const miss = { ev: null, cal, otherCalendar: false, snapshot: null };

    if (key) {
      const kd = occurrenceKeyDate(key, tz);
      addWindow(kd, 1);
      hintDates.forEach((d) => addWindow(d, 1));
      addWindow(kd, 366);
      for (const [from, to] of windows) {
        const found = (await this.scan(cal, from, to)).find((ev) => ev.id === seriesId && occurrenceKeyOf(ev, tz) === key);
        if (found) return { ...miss, ev: found };
      }
      return miss;
    }

    try {
      const ev = await ExpoCalendarEvent.get(seriesId);
      if (ev && ev.id === seriesId) {
        if (ev.calendarId && ev.calendarId !== cal.id) return { ...miss, otherCalendar: true };
        return { ...miss, ev };
      }
    } catch (e) {
      if (!isNotFoundError(e)) throw mapNativeError(e);
    }

    const legacy = await this.legacyLookup(seriesId);
    if (legacy) {
      if (legacy.calendarId !== cal.id) return { ...miss, otherCalendar: true };
      // The legacy call may reset the shared EKEventStore on first use after a
      // permission change, so continue with a freshly fetched calendar.
      const fresh = (await this.calendarOrNull(cal.id)) ?? cal;
      const startMs = toEpoch(legacy.startDate);
      if (startMs != null) {
        const d = epochToZoned(startMs, tz).date;
        const found = (await this.scan(fresh, addDays(d, -1), addDays(d, 1))).find((ev) => ev.id === seriesId);
        if (found) return { ...miss, ev: found, cal: fresh };
      }
      return { ...miss, cal: fresh, snapshot: legacy };
    }

    addWindow(this.hints.get(seriesId), 1);
    hintDates.forEach((d) => addWindow(d, 1));
    for (const [from, to] of windows) {
      const found = (await this.scan(cal, from, to)).find((ev) => ev.id === seriesId);
      if (found) return { ...miss, ev: found };
    }
    return miss;
  }

  async getEvent(calendarId: string, eventId: string, occurrenceKey?: string | null): Promise<ExternalEvent | null> {
    await this.require('read');
    const parsed = parseEventId(eventId);
    const key = normalizeOccurrenceKey(occurrenceKey) ?? normalizeOccurrenceKey(parsed.occurrenceKey);
    const cal = await this.calendarOrNull(calendarId);
    if (!cal) return null;
    const found = await this.locate(cal, parsed.seriesId, key, []);
    if (found.ev) return this.map(found.ev, found.cal);
    return found.snapshot ? this.map(found.snapshot, found.cal) : null;
  }

  async findByOpId(calendarId: string, opId: string, around: { from: LocalDate; to: LocalDate }): Promise<ExternalEvent | null> {
    await this.require('read');
    // Never answer "not found" (→ the caller creates again) for a window that was not scanned.
    if (!isValidRange(around.from, around.to)) throw new ProviderError('invalid', APPLE_ERR_INVALID_EVENT);
    const cal = await this.calendarOrNull(calendarId);
    if (!cal) return null;
    const tz = this.tz();
    // One day of padding on each side absorbs zone differences between the session and the device.
    const evs = await this.scan(cal, addDays(around.from, -1), addDays(around.to, 1));
    const hits = evs
      .map((ev) => this.map(ev, cal))
      .filter((x): x is ExternalEvent => !!x && x.appMeta?.opId === opId)
      .sort((a, b) => Number(a.status === 'cancelled') - Number(b.status === 'cancelled') || startEpoch(a, tz) - startEpoch(b, tz));
    return hits[0] ?? null;
  }

  // ─── writing ───────────────────────────────────────────────────────────────

  async createEvent(calendarId: string, draft: EventDraft): Promise<ExternalEvent> {
    const state = await this.require('write');
    let cal: ExpoCalendar;
    try {
      cal = await this.calendar(calendarId);
    } catch (e) {
      // With write-only access iOS resolves only its virtual default calendar:
      // a real calendar chosen earlier is hidden, not deleted.
      if (state === 'write_only' && e instanceof ProviderError && e.code === 'not_found') throw new ProviderError('forbidden', APPLE_ERR_WRITE_ONLY_CALENDAR);
      throw e;
    }
    if (!cal.allowsModifications) throw new ProviderError('forbidden', APPLE_ERR_READ_ONLY_CALENDAR);
    const tz = this.tz();
    const details = draftToDetails(draft, { deviceTz: tz, mode: 'create', existingUrl: null });
    let ev: ExpoCalendarEvent;
    try {
      ev = await cal.createEvent(details as Parameters<ExpoCalendar['createEvent']>[0]);
    } catch (e) {
      throw mapNativeError(e);
    }
    const mapped = this.map(ev, cal);
    if (mapped) return mapped;
    if (!ev?.id) throw new ProviderError('uncertain', APPLE_ERR_UNKNOWN);
    return externalFromDraft(draft, { eventId: ev.id, calendarId: cal.id, accountId: calendarAccountId(cal) }, tz);
  }

  /**
   * Explicit update of a linked event. For a recurring occurrence only that
   * instance is changed (span `.thisEvent`, see header). Without an occurrence
   * key a recurring event is refused rather than rewriting the whole series.
   */
  async updateEvent(calendarId: string, eventId: string, draft: EventDraft, occurrenceKey?: string | null): Promise<ExternalEvent> {
    // expo-calendar requires full access for event.update().
    await this.require('read');
    const parsed = parseEventId(eventId);
    const key = normalizeOccurrenceKey(occurrenceKey) ?? normalizeOccurrenceKey(parsed.occurrenceKey);
    const target = await this.calendar(calendarId);
    if (!target.allowsModifications) throw new ProviderError('forbidden', APPLE_ERR_READ_ONLY_CALENDAR);
    const { ev, cal, otherCalendar } = await this.locate(target, parsed.seriesId, key, [draft.start.date, draft.end.date]);
    if (!ev) throw new ProviderError('not_found', otherCalendar ? APPLE_ERR_WRONG_CALENDAR : APPLE_ERR_EVENT_NOT_FOUND);
    if (!key && isRecurring(ev)) throw new ProviderError('invalid', APPLE_ERR_OCCURRENCE_REQUIRED);
    const tz = this.tz();
    const details = draftToDetails(draft, { deviceTz: tz, mode: 'update', existingUrl: ev.url ?? null });
    try {
      await ev.update(details as unknown as Partial<ModifiableEventProperties>);
    } catch (e) {
      throw mapNativeError(e);
    }
    const mapped = this.map(ev, cal);
    if (!mapped) throw new ProviderError('uncertain', APPLE_ERR_UNKNOWN);
    return mapped;
  }
}

export function createAppleCalendarProvider(opts: AppleProviderOptions = {}): AppleCalendarProvider {
  return new AppleCalendarProvider(opts);
}
