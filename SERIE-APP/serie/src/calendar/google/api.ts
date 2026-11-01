/**
 * Typed fetch client for Google Calendar API v3 (pure TS, no Expo).
 *
 *  - calendarList.list (all pages), colors.get
 *  - events.list: singleEvents=true, orderBy=startTime, maxResults=2500,
 *    pageToken loop until no nextPageToken, the requested range split per
 *    calendar year so multi-year ranges are fetched completely
 *  - events.get / events.instances / events.insert / events.patch / events.update
 *    (writes always with sendUpdates=none)
 *
 * Errors become `ProviderError`s:
 *  401 → one forced token refresh, then `unauthorized`
 *  403 rateLimitExceeded / userRateLimitExceeded, 429 → `rate_limited` (+ Retry-After)
 *  403 other → `forbidden`; 404 / 410 → `not_found`; 400 → `invalid`; 409 / 412 → `conflict`
 *  network failure → `offline`; 5xx / timeout → `unavailable`
 *  insert: any outcome where Google may have applied the request (5xx, timeout,
 *  transport failure, unreadable 2xx body) → `uncertain` — reconcile before retrying.
 * Reads are retried with bounded exponential backoff + full jitter; writes are not
 * retried here (the export job engine owns write retries and reconciliation).
 */
import type { LocalDate } from '@/domain/types';
import { addDays, compareDates, formatDate, parseDate } from '@/domain/dates';
import { ProviderError } from '../types';
import { GOOGLE_STRINGS as S } from './strings';

export const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
export const EVENTS_PAGE_SIZE = 2500;
export const CALENDAR_LIST_PAGE_SIZE = 250;
const MAX_PAGES = 2000;

// ─── wire types ──────────────────────────────────────────────────────────────

export interface GCalDateTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

export interface GCalEvent {
  id: string;
  etag?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  description?: string;
  location?: string;
  colorId?: string;
  start?: GCalDateTime;
  end?: GCalDateTime;
  recurringEventId?: string;
  originalStartTime?: GCalDateTime;
  recurrence?: string[];
  extendedProperties?: { private?: Record<string, string>; shared?: Record<string, string> };
  reminders?: { useDefault?: boolean; overrides?: { method: string; minutes: number }[] };
  attendees?: unknown[];
  created?: string;
  updated?: string;
  htmlLink?: string;
  eventType?: string;
  [key: string]: unknown;
}

export interface GCalEventsPage {
  items?: GCalEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
  /** Time zone of the calendar. */
  timeZone?: string;
  summary?: string;
  accessRole?: string;
}

export type GCalAccessRole = 'owner' | 'writer' | 'reader' | 'freeBusyReader';

export interface GCalCalendarListEntry {
  id: string;
  summary?: string;
  summaryOverride?: string;
  description?: string;
  timeZone?: string;
  colorId?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole?: GCalAccessRole;
  primary?: boolean;
  hidden?: boolean;
  selected?: boolean;
  deleted?: boolean;
}

interface GCalCalendarListPage {
  items?: GCalCalendarListEntry[];
  nextPageToken?: string;
}

export interface GCalColorDef {
  background: string;
  foreground: string;
}

export interface GCalColors {
  event?: Record<string, GCalColorDef>;
  calendar?: Record<string, GCalColorDef>;
  updated?: string;
}

/** Body Serie sends on insert/update. Never contains attendees. */
export interface GCalEventBody {
  summary: string;
  description?: string;
  location?: string;
  colorId?: string;
  start: GCalDateTime;
  end: GCalDateTime;
  reminders: { useDefault: false; overrides: [] };
  extendedProperties: { private: Record<string, string>; shared?: Record<string, string> };
  [key: string]: unknown;
}

// ─── options ─────────────────────────────────────────────────────────────────

export interface GoogleApiOptions {
  /** Access token provider (see GoogleAuth.getAccessToken). */
  getAccessToken: (opts: { forceRefresh?: boolean; rejectedToken?: string }) => Promise<string>;
  /** Defaults to the global fetch, resolved at call time. */
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  /** Per-request timeout. Default 30 s. */
  timeoutMs?: number;
  /** Extra attempts for retryable reads. Default 4. */
  maxRetries?: number;
  /** Backoff base. Default 500 ms. */
  baseDelayMs?: number;
  /** Backoff cap; a Retry-After above it is not waited in-process. Default 20 s. */
  maxDelayMs?: number;
}

type OpKind = 'read' | 'insert' | 'write';

type Query = Record<string, string | number | boolean | undefined | string[]>;

export interface EventsRangeQuery {
  from: LocalDate;
  to: LocalDate;
  showDeleted?: boolean;
  /** `key=value` constraints on private extended properties (all must match). */
  privateExtendedProperty?: string[];
  signal?: AbortSignal;
  /** Called after every page with the number of items in that page. */
  onPage?: (count: number) => void;
}

// ─── helpers (exported for tests) ────────────────────────────────────────────

export function buildQuery(q: Query): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined) continue;
    const values = Array.isArray(v) ? v : [String(v)];
    for (const x of values) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(x)}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Split an inclusive local-date range into per-calendar-year chunks. */
export function yearChunks(from: LocalDate, to: LocalDate): { from: LocalDate; to: LocalDate }[] {
  if (compareDates(from, to) > 0) return [];
  const a = parseDate(from).y;
  const b = parseDate(to).y;
  const out: { from: LocalDate; to: LocalDate }[] = [];
  for (let y = a; y <= b; y++) {
    const start = y === a ? from : formatDate(y, 1, 1);
    const end = y === b ? to : formatDate(y, 12, 31);
    out.push({ from: start, to: end });
  }
  return out;
}

/**
 * RFC 3339 bounds that contain every instant whose local date (in any zone,
 * UTC−12…UTC+14) lies in [from, to]. Callers filter by local start date.
 */
export function chunkWindow(c: { from: LocalDate; to: LocalDate }): { timeMin: string; timeMax: string } {
  return { timeMin: `${c.from}T00:00:00+14:00`, timeMax: `${addDays(c.to, 1)}T00:00:00-12:00` };
}

/** Retry-After as seconds or HTTP date → ms (null when absent/invalid). */
export function parseRetryAfter(value: string | null | undefined, nowMs: number): number | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(parseFloat(v) * 1000);
  const at = Date.parse(v);
  if (Number.isNaN(at)) return null;
  return Math.max(0, at - nowMs);
}

/** Full-jitter exponential backoff: random(0, min(cap, base·2^attempt)). */
export function backoffDelay(attempt: number, baseMs: number, capMs: number, random: () => number): number {
  const ceiling = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.round(ceiling * random());
}

interface GoogleErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    errors?: { domain?: string; reason?: string; message?: string }[];
    details?: { reason?: string }[];
  };
}

function errorReasons(body: GoogleErrorBody | null): string[] {
  const e = body?.error;
  if (!e) return [];
  const out: string[] = [];
  for (const x of e.errors ?? []) if (x.reason) out.push(x.reason.toLowerCase());
  for (const x of e.details ?? []) if (x.reason) out.push(x.reason.toLowerCase().replace(/_/g, ''));
  if (e.status) out.push(e.status.toLowerCase().replace(/_/g, ''));
  return out;
}

const RATE_REASONS = ['ratelimitexceeded', 'userratelimitexceeded', 'quotaexceeded', 'dailylimitexceeded', 'resourceexhausted'];

/** Map an HTTP error response to a ProviderError (401 handled by the caller first). */
export function mapHttpError(status: number, body: GoogleErrorBody | null, retryAfterMs: number | null, op: OpKind): ProviderError {
  const reasons = errorReasons(body);
  if (status === 429) return new ProviderError('rate_limited', S.rateLimited, retryAfterMs);
  if (status === 403) {
    if (reasons.some((r) => RATE_REASONS.includes(r))) return new ProviderError('rate_limited', S.rateLimited, retryAfterMs);
    if (reasons.includes('insufficientpermissions') || reasons.includes('accesstokenscopeinsufficient')) return new ProviderError('forbidden', S.insufficientScope);
    if (reasons.includes('accessnotconfigured') || reasons.includes('servicedisabled')) return new ProviderError('forbidden', S.apiDisabled);
    return new ProviderError('forbidden', S.forbidden);
  }
  if (status === 401) return new ProviderError('unauthorized', S.unauthorized);
  if (status === 404 || status === 410) return new ProviderError('not_found', S.notFound);
  if (status === 409 || status === 412) return new ProviderError('conflict', S.conflict);
  if (status === 400 || status === 422) return new ProviderError('invalid', S.invalid);
  if (status >= 500) return op === 'insert' ? new ProviderError('uncertain', S.uncertain, retryAfterMs) : new ProviderError('unavailable', S.unavailable, retryAfterMs);
  return new ProviderError('unknown', `${S.unknown} (HTTP ${status})`);
}

const isAbort = (e: unknown) => typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError';

function abortError(signal: AbortSignal): Error {
  const reason = (signal as AbortSignal & { reason?: unknown }).reason;
  if (reason instanceof Error) return reason;
  const e = new Error('Aborted');
  e.name = 'AbortError';
  return e;
}

const enc = encodeURIComponent;

// ─── client ──────────────────────────────────────────────────────────────────

export class GoogleCalendarApi {
  private readonly o: Required<Omit<GoogleApiOptions, 'fetch'>> & { fetch?: typeof fetch };

  constructor(opts: GoogleApiOptions) {
    this.o = {
      getAccessToken: opts.getAccessToken,
      fetch: opts.fetch,
      sleep: opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
      random: opts.random ?? Math.random,
      now: opts.now ?? Date.now,
      timeoutMs: opts.timeoutMs ?? 30_000,
      maxRetries: opts.maxRetries ?? 4,
      baseDelayMs: opts.baseDelayMs ?? 500,
      maxDelayMs: opts.maxDelayMs ?? 20_000,
    };
  }

  private get fetchFn(): typeof fetch {
    return this.o.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  /** One HTTP exchange with timeout; returns status, headers and raw text. */
  private async exchange(url: string, init: { method: string; headers: Record<string, string>; body?: string }, signal: AbortSignal | undefined, op: OpKind) {
    if (signal?.aborted) throw abortError(signal);
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, this.o.timeoutMs);
    const onAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onAbort);
    try {
      let res: Response;
      try {
        res = await this.fetchFn(url, { ...init, signal: ctrl.signal });
      } catch (e) {
        if (signal?.aborted) throw abortError(signal);
        // The request may have reached Google before the failure: an insert cannot be assumed not applied.
        if (op === 'insert') throw new ProviderError('uncertain', S.uncertain);
        if (timedOut || isAbort(e)) throw new ProviderError('unavailable', S.unavailable);
        throw new ProviderError('offline', S.offline);
      }
      let text = '';
      try {
        text = await res.text();
      } catch {
        if (signal?.aborted) throw abortError(signal);
        // A 2xx whose body was lost: the write happened, but we cannot read the result.
        if (res.ok) throw op === 'insert' ? new ProviderError('uncertain', S.uncertain) : new ProviderError('unavailable', S.unavailable);
      }
      return { status: res.status, ok: res.ok, headers: res.headers, text };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  /** Authorized JSON request with refresh-on-401 and retry for reads. */
  async request<T>(method: string, path: string, opts: { query?: Query; body?: unknown; signal?: AbortSignal; op?: OpKind; headers?: Record<string, string> } = {}): Promise<T> {
    const op: OpKind = opts.op ?? (method === 'GET' ? 'read' : 'write');
    const url = `${CALENDAR_API_BASE}${path}${buildQuery(opts.query ?? {})}`;
    let token = await this.o.getAccessToken({});
    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(opts.headers ?? {}) };
      if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
      let err: ProviderError;
      let needsRefresh = false;
      try {
        const r = await this.exchange(url, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined }, opts.signal, op);
        if (r.ok) {
          if (!r.text) return undefined as T;
          try {
            return JSON.parse(r.text) as T;
          } catch {
            throw op === 'insert' ? new ProviderError('uncertain', S.uncertain) : new ProviderError('unavailable', S.unavailable);
          }
        }
        needsRefresh = r.status === 401 && !refreshed;
        let body: GoogleErrorBody | null = null;
        try {
          body = r.text ? (JSON.parse(r.text) as GoogleErrorBody) : null;
        } catch {
          body = null;
        }
        err = mapHttpError(r.status, body, parseRetryAfter(r.headers?.get?.('Retry-After'), this.o.now()), op);
      } catch (e) {
        if (!(e instanceof ProviderError)) throw e;
        err = e;
      }
      if (needsRefresh) {
        // 401: one forced refresh (a refresh failure surfaces as is), then the same request again.
        refreshed = true;
        token = await this.o.getAccessToken({ forceRefresh: true, rejectedToken: token });
        attempt--; // a refresh is not a retry
        continue;
      }
      if (op !== 'read' || !err.retryable || err.code === 'uncertain' || attempt >= this.o.maxRetries) throw err;
      if (err.retryAfterMs != null && err.retryAfterMs > this.o.maxDelayMs) throw err;
      const delay = Math.max(err.retryAfterMs ?? 0, backoffDelay(attempt, this.o.baseDelayMs, this.o.maxDelayMs, this.o.random));
      await this.o.sleep(delay);
      if (opts.signal?.aborted) throw abortError(opts.signal);
    }
  }

  // ─── calendars & colours ───

  async listCalendars(signal?: AbortSignal): Promise<GCalCalendarListEntry[]> {
    const out: GCalCalendarListEntry[] = [];
    let pageToken: string | undefined;
    const seen = new Set<string>();
    for (let i = 0; i < MAX_PAGES; i++) {
      const page = await this.request<GCalCalendarListPage>('GET', '/users/me/calendarList', { query: { maxResults: CALENDAR_LIST_PAGE_SIZE, pageToken }, signal });
      for (const c of page?.items ?? []) if (!c.deleted) out.push(c);
      pageToken = page?.nextPageToken || undefined;
      if (!pageToken) return out;
      if (seen.has(pageToken)) throw new ProviderError('unknown', S.unknown);
      seen.add(pageToken);
    }
    throw new ProviderError('unknown', S.unknown);
  }

  async getCalendarListEntry(calendarId: string): Promise<GCalCalendarListEntry | null> {
    try {
      return await this.request<GCalCalendarListEntry>('GET', `/users/me/calendarList/${enc(calendarId)}`);
    } catch (e) {
      if (e instanceof ProviderError && e.code === 'not_found') return null;
      throw e;
    }
  }

  getColors(): Promise<GCalColors> {
    return this.request<GCalColors>('GET', '/colors');
  }

  // ─── events ───

  /** One page of events.list (expanded occurrences, ordered by start). */
  listEventsPage(
    calendarId: string,
    p: { timeMin: string; timeMax: string; pageToken?: string; showDeleted?: boolean; privateExtendedProperty?: string[]; signal?: AbortSignal },
  ): Promise<GCalEventsPage> {
    return this.request<GCalEventsPage>('GET', `/calendars/${enc(calendarId)}/events`, {
      query: {
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: EVENTS_PAGE_SIZE,
        timeMin: p.timeMin,
        timeMax: p.timeMax,
        showDeleted: p.showDeleted ? true : undefined,
        privateExtendedProperty: p.privateExtendedProperty?.length ? p.privateExtendedProperty : undefined,
        pageToken: p.pageToken,
      },
      signal: p.signal,
    });
  }

  /**
   * Every event of every page of every year chunk overlapping [from, to].
   * Events spanning a chunk boundary are de-duplicated by id. Returns the
   * calendar time zone and the caller's access role as reported by Google
   * (null if never reported).
   */
  async listEventsRange(calendarId: string, q: EventsRangeQuery): Promise<{ items: GCalEvent[]; timeZone: string | null; accessRole: string | null }> {
    const byId = new Map<string, GCalEvent>();
    let timeZone: string | null = null;
    let accessRole: string | null = null;
    for (const chunk of yearChunks(q.from, q.to)) {
      const { timeMin, timeMax } = chunkWindow(chunk);
      let pageToken: string | undefined;
      const seen = new Set<string>();
      for (let i = 0; ; i++) {
        if (i >= MAX_PAGES) throw new ProviderError('unknown', S.unknown);
        const page = await this.listEventsPage(calendarId, { timeMin, timeMax, pageToken, showDeleted: q.showDeleted, privateExtendedProperty: q.privateExtendedProperty, signal: q.signal });
        if (page?.timeZone) timeZone = page.timeZone;
        if (page?.accessRole) accessRole = page.accessRole;
        const items = page?.items ?? [];
        for (const ev of items) if (ev?.id && !byId.has(ev.id)) byId.set(ev.id, ev);
        q.onPage?.(items.length);
        pageToken = page?.nextPageToken || undefined;
        if (!pageToken) break;
        if (seen.has(pageToken)) throw new ProviderError('unknown', S.unknown);
        seen.add(pageToken);
      }
    }
    return { items: [...byId.values()], timeZone, accessRole };
  }

  /** Occurrences of a recurring series inside a window (all pages). */
  async listInstances(calendarId: string, eventId: string, p: { timeMin: string; timeMax: string; showDeleted?: boolean }): Promise<GCalEvent[]> {
    const out: GCalEvent[] = [];
    let pageToken: string | undefined;
    for (let i = 0; i < MAX_PAGES; i++) {
      const page = await this.request<GCalEventsPage>('GET', `/calendars/${enc(calendarId)}/events/${enc(eventId)}/instances`, {
        query: { timeMin: p.timeMin, timeMax: p.timeMax, showDeleted: p.showDeleted ? true : undefined, maxResults: EVENTS_PAGE_SIZE, pageToken },
      });
      out.push(...(page?.items ?? []));
      pageToken = page?.nextPageToken || undefined;
      if (!pageToken) return out;
    }
    throw new ProviderError('unknown', S.unknown);
  }

  /** events.get; null when the event does not exist (404/410). */
  async getEvent(calendarId: string, eventId: string): Promise<GCalEvent | null> {
    try {
      return await this.request<GCalEvent>('GET', `/calendars/${enc(calendarId)}/events/${enc(eventId)}`);
    } catch (e) {
      if (e instanceof ProviderError && e.code === 'not_found') return null;
      throw e;
    }
  }

  /** events.insert with sendUpdates=none. Ambiguous failures surface as `uncertain`. */
  insertEvent(calendarId: string, body: GCalEventBody): Promise<GCalEvent> {
    return this.request<GCalEvent>('POST', `/calendars/${enc(calendarId)}/events`, { query: { sendUpdates: 'none' }, body, op: 'insert' });
  }

  /** events.patch with sendUpdates=none (only the given fields change). */
  patchEvent(calendarId: string, eventId: string, body: Partial<GCalEventBody>, etag?: string): Promise<GCalEvent> {
    return this.request<GCalEvent>('PATCH', `/calendars/${enc(calendarId)}/events/${enc(eventId)}`, {
      query: { sendUpdates: 'none' },
      body,
      op: 'write',
      headers: etag ? { 'If-Match': etag } : undefined,
    });
  }

  /** events.update (full replacement) with sendUpdates=none; `etag` → If-Match (412 → conflict). */
  updateEvent(calendarId: string, eventId: string, body: GCalEvent | GCalEventBody, etag?: string): Promise<GCalEvent> {
    return this.request<GCalEvent>('PUT', `/calendars/${enc(calendarId)}/events/${enc(eventId)}`, {
      query: { sendUpdates: 'none' },
      body,
      op: 'write',
      headers: etag ? { 'If-Match': etag } : undefined,
    });
  }
}
