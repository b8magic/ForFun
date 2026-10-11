/**
 * Serie — domain model.
 *
 * Pure data shapes shared by storage, statistics, calendar exchange and the
 * motion layer. Nothing here imports React, Expo or platform code.
 *
 * Integrity rules encoded by these types:
 *  - Calendar dates are date-only strings (YYYY-MM-DD) and never timestamps.
 *  - Clock time and duration are separate. Unknown duration is `null`, never 0,
 *    never 24 h, never an export placeholder.
 *  - A known duration always records where it came from (interval or declared).
 *  - Import provenance and export links live in their own records, not in Session.
 */

/** Calendar date in the session's own frame of reference: 'YYYY-MM-DD'. */
export type LocalDate = string;
/** 24-hour wall-clock time: 'HH:MM'. */
export type WallTime = string;
/** ISO-8601 instant in UTC, e.g. '2026-10-10T07:32:00.000Z'. */
export type Instant = string;
/** Stable identifier (UUID v4). */
export type ID = string;

// ─── Activities ──────────────────────────────────────────────────────────────

/**
 * The motion pattern that lives inside an activity's identity disc. Each
 * category picks one; the same pattern recolours the week-lines while that
 * activity is active, so identity survives every transformation.
 */
export type PatternKind =
  | 'swell' // undulating stripes (Surf)
  | 'stride' // strided dashes travelling in alternate directions (Run)
  | 'pulse' // stripes breathing in thickness (Train)
  | 'drift' // inclined stripes drifting on a heading (Travel)
  | 'ripple' // concentric rings expanding from the centre
  | 'grain'; // fine stippled rows

export interface Category {
  id: ID;
  name: string;
  /** Hex colour from the curated activity palette (see ui/theme.ts). */
  color: string;
  pattern: PatternKind;
  sortOrder: number;
  createdAt: Instant;
  updatedAt: Instant;
}

// ─── Timing ──────────────────────────────────────────────────────────────────

/**
 * The four timing states required by the product, plus the optional
 * "start + declared duration" convenience.
 *
 *  date_only      date, no clock time, no duration        → duration unknown
 *  start_only     date + start time                        → duration unknown
 *  interval       date + start + end (+ explicit next-day) → duration derived from the interval
 *  duration_only  date + declared duration, no clock time  → duration declared
 *  start_duration date + start + declared duration         → duration declared; end is derived, never stored as fact
 */
export type TimingState = 'date_only' | 'start_only' | 'interval' | 'duration_only' | 'start_duration';

export type DurationSource = 'interval' | 'declared';

export interface Timing {
  state: TimingState;
  /** Start wall time on the session date. Present for start_only, interval, start_duration. */
  start: WallTime | null;
  /** End wall time. Present only for interval. */
  end: WallTime | null;
  /** Interval only: 1 when the user explicitly said the session ended the next day. */
  endDayOffset: 0 | 1;
  /** IANA zone used to interpret start/end. Present whenever a clock time is present. */
  timeZone: string | null;
  /** Declared duration in whole seconds (duration_only, start_duration). */
  declaredSec: number | null;
  /** Canonical known duration in whole seconds; null = unknown. */
  durationSec: number | null;
  durationSource: DurationSource | null;
}

// ─── Place ───────────────────────────────────────────────────────────────────

export type PlaceResolution =
  | 'none' // no map link given
  | 'resolved' // coordinates read from a supported link
  | 'manual' // user placed or corrected the pin
  | 'pending' // short link waiting for network resolution
  | 'unresolved' // link kept, could not be resolved (offline / ambiguous)
  | 'unsupported'; // link kept, not a recognised maps link

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Place {
  /** Place name, e.g. "La Fuente". */
  label: string | null;
  /** Free-form address. */
  address: string | null;
  /** The original pasted link, preserved verbatim. */
  mapUrl: string | null;
  coords: Coordinates | null;
  resolution: PlaceResolution;
  /** Human-readable reason when unresolved/unsupported. */
  resolutionNote: string | null;
}

// ─── Session ─────────────────────────────────────────────────────────────────

export type SessionOrigin = 'manual' | 'import';

export interface Session {
  id: ID;
  categoryId: ID;
  /** The recorded session date. History and period statistics attribute the whole session here. */
  date: LocalDate;
  timing: Timing;
  place: Place | null;
  notes: string | null;
  origin: SessionOrigin;
  /**
   * Idempotency key of the logging action that created this session
   * (one key per Save tap, combined with the date). Repeated delivery of the
   * same save cannot create duplicates; separate saves on the same date can.
   */
  saveRequestId: string | null;
  createdAt: Instant;
  updatedAt: Instant;
}

/** Optional details a user may attach while logging (each field independent). */
export interface SessionDetailsDraft {
  notes?: string | null;
  place?: Place | null;
  timing?: Timing;
}

// ─── Statistics ──────────────────────────────────────────────────────────────

export interface DurationSummary {
  /** Sum of known durations, whole seconds. */
  knownSec: number;
  /** Sessions that have a known duration. */
  knownCount: number;
  /** All sessions in scope (known + unknown). */
  totalCount: number;
}

export interface PeriodSummary {
  sessions: number;
  /** Distinct dates with ≥1 session. Never presented as a session count. */
  activeDays: number;
  duration: DurationSummary;
}

export interface Milestone {
  id: string;
  /** Explicit rule, shown to the user (e.g. "10 sessioni registrate"). */
  rule: string;
  kind: 'sessions' | 'hours' | 'first' | 'weeks';
  threshold: number;
  reached: boolean;
  /** Date the threshold was crossed (by session date order), if reached. */
  reachedOn: LocalDate | null;
}

// ─── Calendar exchange records (stored separately from sessions) ─────────────

export type ProviderKind = 'google' | 'apple';

/** Identity of a concrete destination/source calendar. */
export interface CalendarRef {
  provider: ProviderKind;
  /** Google account email or Apple calendar source id. */
  accountId: string;
  calendarId: string;
}

export interface ImportProvenance {
  sessionId: ID;
  provider: ProviderKind;
  accountId: string;
  calendarId: string;
  externalEventId: string;
  /** Parent series id for recurring events (not the identity of the occurrence). */
  recurringEventId: string | null;
  /** Occurrence identity: original start of the instance, when recurring. */
  occurrenceKey: string | null;
  originalTitle: string;
  /** The source event's span, kept as provenance only (never as activity duration). */
  sourceAllDay: boolean;
  sourceStart: string;
  sourceEnd: string;
  importBatchId: ID;
  importedAt: Instant;
}

export type ExportLinkStatus = 'created' | 'linked' | 'updated';

/** What we wrote (or linked) last time, so later reads never reinterpret calendar conventions as duration. */
export interface ExportSnapshot {
  title: string;
  notes: string | null;
  location: string | null;
  allDay: boolean;
  start: string; // date or ISO instant
  end: string;
  timeZone: string | null;
  timingState: TimingState;
  durationSec: number | null;
  durationSource: DurationSource | null;
  schedulingPlaceholder: boolean;
  categoryName: string;
}

export interface ExportLink {
  id: ID;
  sessionId: ID;
  provider: ProviderKind;
  accountId: string;
  calendarId: string;
  externalEventId: string;
  occurrenceKey: string | null;
  status: ExportLinkStatus;
  /** Deterministic operation id (session × destination) used for idempotent retries. */
  opId: string;
  snapshot: ExportSnapshot;
  exportedAt: Instant;
}

export type ExportJobStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed' // retryable failure (offline, rate limit, auth)
  | 'uncertain' // request may have been applied; must reconcile before retrying
  | 'needs_review' // duplicate, ambiguity or unapproved representation
  | 'cancelled';

export interface ExportJob {
  id: ID;
  opId: string;
  sessionId: ID;
  provider: ProviderKind;
  accountId: string;
  calendarId: string;
  kind: 'auto' | 'manual';
  status: ExportJobStatus;
  attempts: number;
  lastError: string | null;
  /** Reason shown in "Da rivedere". */
  reviewReason: string | null;
  nextAttemptAt: Instant | null;
  createdAt: Instant;
  updatedAt: Instant;
}
