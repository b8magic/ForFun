/**
 * Calendar exchange contracts. Providers (Google, Apple) implement
 * `CalendarProvider`; the import/export/auto-export engines are pure and only
 * depend on these types, so they are tested with fake providers.
 *
 * Vocabulary (kept distinct in the UI):
 *   provider   → Google Calendar | Calendari di iPhone (EventKit)
 *   account    → Google account email | iOS calendar source (iCloud, Gmail via CalDAV, …)
 *   calendar   → a concrete calendar inside the account
 *   label      → per-event colour (Google colorId); EventKit has none
 */
import type { CalendarRef, LocalDate, ProviderKind, TimingState, WallTime, DurationSource } from '@/domain/types';

export type { CalendarRef, ProviderKind };

export const refKey = (r: CalendarRef) => `${r.provider}:${r.accountId}:${r.calendarId}`;

export type AccessRole = 'owner' | 'writer' | 'reader' | 'freeBusyReader' | 'unknown';

export interface ExternalCalendar extends CalendarRef {
  /** Human label of the account (email, "iCloud", "Gmail – a@b.com"). */
  accountLabel: string;
  title: string;
  color: string | null;
  access: AccessRole;
  canRead: boolean;
  canWrite: boolean;
  isPrimary: boolean;
  /** Apple only: EventKit source type ('local' | 'caldav' | 'exchange' | 'subscribed' | 'birthdays' | …). */
  sourceType: string | null;
  /** Apple only: EventKit source title (often the account email for CalDAV/Google). */
  sourceName: string | null;
}

export type ConnectionStatus =
  | 'unavailable' // platform or build cannot use this provider
  | 'not_configured' // e.g. missing OAuth client id in this build
  | 'disconnected'
  | 'denied'
  | 'write_only' // iOS 17+ write-only calendar access: cannot read → no import, no duplicate checks
  | 'connected';

export interface Connection {
  provider: ProviderKind;
  status: ConnectionStatus;
  accountId: string | null;
  accountLabel: string | null;
  canRead: boolean;
  canWrite: boolean;
  /** Short explanation for non-connected states (Italian, user-facing). */
  detail: string | null;
}

/** A point in time of an external event. All-day events carry only `date`. */
export interface EventTime {
  date: LocalDate;
  /** Local wall time in `timeZone` (null for all-day). */
  time: WallTime | null;
  timeZone: string | null;
  /** UTC instant (null for all-day). */
  instant: string | null;
}

/** Metadata Serie writes into events it exports, so they are recognised later. */
export interface AppEventMeta {
  v: 1;
  sessionId: string;
  opId: string;
  timingState: TimingState;
  durationSec: number | null;
  durationSource: DurationSource | null;
  /** True when the event's end/span is an export-only scheduling placeholder. */
  schedulingPlaceholder: boolean;
}

export interface ExternalEvent extends CalendarRef {
  eventId: string;
  /** Recurring series id (not the identity of the occurrence). */
  recurringEventId: string | null;
  /** Identity of one occurrence within a series (original start), null for single events. */
  occurrenceKey: string | null;
  title: string;
  notes: string | null;
  location: string | null;
  allDay: boolean;
  start: EventTime;
  /** Exclusive end for all-day events (Google/ICS convention: end.date = last day + 1). */
  end: EventTime;
  status: 'confirmed' | 'tentative' | 'cancelled';
  /** Google colorId ('1'…'11'); null when unset or unsupported. */
  colorId: string | null;
  appMeta: AppEventMeta | null;
  updated: string | null;
}

export interface LabelOption {
  id: string; // Google colorId
  name: string; // Italian display name
  color: string; // hex background
}

export interface EventDraft {
  title: string;
  notes: string | null;
  location: string | null;
  allDay: boolean;
  /** All-day: start.date and exclusive end.date. Timed: date + time + timeZone. */
  start: { date: LocalDate; time: WallTime | null; timeZone: string | null };
  end: { date: LocalDate; time: WallTime | null; timeZone: string | null };
  colorId: string | null;
  appMeta: AppEventMeta;
}

export interface ListEventsQuery {
  calendarIds: string[];
  /** Inclusive range of local dates. Providers chunk and paginate internally until complete. */
  from: LocalDate;
  to: LocalDate;
  /** Include cancelled occurrences so callers can exclude them explicitly. */
  includeCancelled?: boolean;
  signal?: AbortSignal;
  onProgress?: (fetched: number) => void;
}

export class ProviderError extends Error {
  constructor(
    public code: 'offline' | 'unauthorized' | 'forbidden' | 'not_found' | 'rate_limited' | 'conflict' | 'unavailable' | 'uncertain' | 'invalid' | 'unknown',
    message: string,
    public retryAfterMs: number | null = null,
  ) {
    super(message);
  }
  get retryable() {
    return this.code === 'offline' || this.code === 'rate_limited' || this.code === 'uncertain' || this.code === 'unavailable';
  }
}

export interface CalendarProvider {
  readonly kind: ProviderKind;
  readonly capabilities: {
    /** Per-event colour labels (Google: true; Apple/EventKit: false). */
    eventLabels: boolean;
  };
  getConnection(): Promise<Connection>;
  /** Interactive: requests permission / OAuth consent. Called only when the user invokes a calendar feature. */
  connect(access: 'read' | 'readwrite'): Promise<Connection>;
  disconnect(): Promise<void>;
  listCalendars(): Promise<ExternalCalendar[]>;
  listLabels(): Promise<LabelOption[]>;
  /** Complete retrieval: every page of every chunk; recurring events expanded into occurrences. */
  listEvents(q: ListEventsQuery): Promise<ExternalEvent[]>;
  getEvent(calendarId: string, eventId: string, occurrenceKey?: string | null): Promise<ExternalEvent | null>;
  /** Find events previously written by Serie for an operation id (idempotency / reconciliation). */
  findByOpId(calendarId: string, opId: string, around: { from: LocalDate; to: LocalDate }): Promise<ExternalEvent | null>;
  createEvent(calendarId: string, draft: EventDraft): Promise<ExternalEvent>;
  updateEvent(calendarId: string, eventId: string, draft: EventDraft, occurrenceKey?: string | null): Promise<ExternalEvent>;
}
