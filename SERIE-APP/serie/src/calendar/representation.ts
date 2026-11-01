/**
 * Export representation: how a session's recorded timing becomes the time of
 * an outgoing calendar event, and how the outgoing event content is composed.
 *
 *   date_only       → all-day date marker (start.date = date, end.date = date + 1),
 *                     disclosed: not a claim that the activity lasted all day.
 *   start_only      → needs a scheduling span. With a user-approved export-only
 *                     span (per item) or a configured visible preset (batch) →
 *                     timed start…start+span, flagged `schedulingPlaceholder`.
 *                     Otherwise 'pending_representation' and NO draft.
 *   interval        → timed with the recorded start/end in the session zone
 *                     (end on the next day when endDayOffset = 1).
 *   duration_only   → all-day date marker carrying "Durata: 1 h 30 min" in the
 *                     description. Never an invented start time; a time chosen
 *                     explicitly by the user for the outgoing event is allowed
 *                     (export-only).
 *   start_duration  → timed start…derived end (start + declared duration).
 *
 * `AppEventMeta` always carries the TRUE recorded timing state, duration and
 * duration source; spans that exist only for the calendar set
 * `schedulingPlaceholder = true`, so re-import never turns them into hours.
 *
 * Per-item overrides (title/notes/location/date/time) change the outgoing
 * event only. `overrideToSessionPatch` is the explicit "apply back to the
 * session" step and is never called implicitly.
 *
 * Pure: no React, no Expo. Inputs are never mutated.
 */
import type { AppEventMeta, EventDraft, ExternalEvent } from './types';
import type { ExportSnapshot, LocalDate, Place, Session, Timing, TimingState, WallTime } from '@/domain/types';
import type { SessionPatch } from '@/data/repositories';
import { addDays, isLocalDate } from '@/domain/dates';
import { deviceTimeZone, epochToZoned, isValidTimeZone, isWallTime, zonedToEpoch, zoneOffsetMinutes } from '@/domain/zoned';
import { buildTiming, describeSwitch, type TimingChange, type TimingError, type TimingInput } from '@/domain/timing';
import { formatDuration } from '@/domain/duration';
import { t } from '@/i18n/it';
import { resolveTitle, type ResolvedTitle } from './titles';
import { canonicalAppMeta } from './appMeta';

// ─── user-facing strings (Italian) ───────────────────────────────────────────

export const REPR_STRINGS = {
  dateOnly: t.reprDateOnly,
  startOnlyPending: t.reprStartOnly,
  startOnlyApproved: t.reprStartOnlyApproved,
  interval: t.reprInterval,
  durationMarker: t.reprDuration,
  startDuration: 'Inizio registrato, fine calcolata dalla durata dichiarata.',
  outgoingTime: 'Orario scelto solo per il calendario: la sessione non cambia.',
  invalidDate: 'Data non valida.',
  invalidTime: 'Orario non valido. Usa ore:minuti, ad esempio 07:45.',
  invalidZone: 'Fuso orario non valido.',
  endNotAfterStart: 'La fine deve essere dopo l’inizio.',
  invalidSpan: 'Intervallo di pianificazione non valido.',
  invalidSessionTiming: 'Orario della sessione incompleto.',
  durationLine: (d: string) => `Durata: ${d}`,
  mapLine: (url: string) => `Mappa: ${url}`,
} as const;

// ─── types ───────────────────────────────────────────────────────────────────

/** An explicit outgoing time chosen in the export review (export-only). */
export interface OutgoingTime {
  start: WallTime;
  /** End wall time. When omitted the end comes from `spanMin`, the recorded duration, or an approved span. */
  end?: WallTime | null;
  /** 1 when `end` is on the day after the outgoing date. */
  endDayOffset?: 0 | 1;
  /** Export-only span in minutes, used when no `end` is given. */
  spanMin?: number | null;
  /** IANA zone; defaults to the session zone, then the provided default zone. */
  timeZone?: string | null;
}

/**
 * Per-event outgoing overrides. `undefined` = use the session value.
 * They never change the stored session or category name.
 */
export interface ExportOverride {
  /** Base title (prefix/suffix are still applied). Blank = activity name. */
  baseTitle?: string | null;
  /** Outgoing notes (`null` = none). Ignored when notes are excluded for the batch. */
  notes?: string | null;
  /** Outgoing location text (`null` = none). Ignored when location is excluded for the batch. */
  location?: string | null;
  /** Outgoing date. */
  date?: LocalDate | null;
  /** Outgoing clock time (export-only). */
  time?: OutgoingTime | null;
  /** Per-item user-approved scheduling span for start-only sessions (minutes). */
  startOnlySpanMin?: number | null;
}

export type RepresentationKind =
  | 'date_marker' // date_only → all-day marker
  | 'scheduling_span' // start_only + approved export-only span
  | 'interval' // recorded interval
  | 'duration_marker' // duration_only → all-day marker + "Durata: …" line
  | 'start_duration' // start + declared duration → derived end
  | 'outgoing_time'; // explicit export-only time chosen by the user

export interface DraftTime {
  date: LocalDate;
  time: WallTime | null;
  timeZone: string | null;
}

export type RepresentationError = 'invalid_date' | 'invalid_time' | 'invalid_zone' | 'end_not_after_start' | 'invalid_span' | 'invalid_session_timing';

export interface ReadyRepresentation {
  status: 'ready';
  kind: RepresentationKind;
  allDay: boolean;
  start: DraftTime;
  /** All-day: exclusive end date. Timed: end wall time. */
  end: DraftTime;
  /** True when the event's clock placement or span exists only for the calendar. */
  schedulingPlaceholder: boolean;
  /** Outgoing event span in minutes for timed events (calendar span, NOT activity duration). */
  spanMin: number | null;
  /** Labelled line added to the description (duration-only: "Durata: 1 h 30 min"). */
  descriptionLine: string | null;
  /** Italian disclosure shown in the review row. */
  disclosure: string;
  outgoingDate: LocalDate;
  /** DST note for a typed wall time that falls in a gap or overlap. */
  zoneNote: 'ambiguous_time' | 'nonexistent_time' | null;
}

export interface PendingRepresentation {
  status: 'pending_representation';
  kind: 'pending_representation';
  disclosure: string;
  outgoingDate: LocalDate;
}

export interface InvalidRepresentation {
  status: 'invalid';
  kind: 'invalid';
  error: RepresentationError;
  disclosure: string;
  outgoingDate: LocalDate;
}

export type TimeRepresentation = ReadyRepresentation | PendingRepresentation | InvalidRepresentation;

export interface RepresentOptions {
  /** Batch preset / approval for start-only sessions (minutes); null = not approved. */
  startOnlySpanMin?: number | null;
  override?: ExportOverride | null;
  /** Zone for an outgoing time when the session has none (defaults to the device zone). */
  defaultTimeZone?: string | null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const MAX_SPAN_MIN = 24 * 60;

/** A usable scheduling span: whole minutes, 1…1440. Anything else = not approved. */
export function validSpanMin(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_SPAN_MIN ? v : null;
}

const invalid = (error: RepresentationError, outgoingDate: LocalDate): InvalidRepresentation => {
  const disclosure = {
    invalid_date: REPR_STRINGS.invalidDate,
    invalid_time: REPR_STRINGS.invalidTime,
    invalid_zone: REPR_STRINGS.invalidZone,
    end_not_after_start: REPR_STRINGS.endNotAfterStart,
    invalid_span: REPR_STRINGS.invalidSpan,
    invalid_session_timing: REPR_STRINGS.invalidSessionTiming,
  }[error];
  return { status: 'invalid', kind: 'invalid', error, disclosure, outgoingDate };
};

const pending = (outgoingDate: LocalDate): PendingRepresentation => ({
  status: 'pending_representation',
  kind: 'pending_representation',
  disclosure: REPR_STRINGS.startOnlyPending,
  outgoingDate,
});

function allDayMarker(kind: 'date_marker' | 'duration_marker', date: LocalDate, descriptionLine: string | null, disclosure: string): ReadyRepresentation {
  return {
    status: 'ready',
    kind,
    allDay: true,
    start: { date, time: null, timeZone: null },
    end: { date: addDays(date, 1), time: null, timeZone: null },
    schedulingPlaceholder: false,
    spanMin: null,
    descriptionLine,
    disclosure,
    outgoingDate: date,
    zoneNote: null,
  };
}

/**
 * Wall time of an instant, expressed so that reading it back (date + time +
 * zone, as providers do) gives the SAME instant. During the repeated hour of a
 * DST fall-back the wall time is ambiguous and is read back as its first
 * occurrence; an instant in the second pass is therefore expressed in the
 * equivalent fixed-offset zone ('Etc/GMT-1' for CET), or UTC when the offset is
 * not a whole hour. Otherwise a derived end could silently lose an hour.
 */
export function wallAt(epochMs: number, timeZone: string): { date: LocalDate; time: WallTime; timeZone: string } {
  const z = epochToZoned(epochMs, timeZone);
  if (zonedToEpoch(z.date, z.time, timeZone).epochMs === epochMs) return { ...z, timeZone };
  const off = zoneOffsetMinutes(timeZone, epochMs);
  const h = off / 60;
  const fixed = off === 0 ? 'UTC' : Number.isInteger(h) && h >= -12 && h <= 14 ? `Etc/GMT${h > 0 ? '-' : '+'}${Math.abs(h)}` : 'UTC';
  const zone = isValidTimeZone(fixed) ? fixed : 'UTC';
  return { ...epochToZoned(epochMs, zone), timeZone: zone };
}

/** Wall time `seconds` after a zoned start, rounded to the nearest minute (DST-safe, see `wallAt`). */
function zonedPlus(date: LocalDate, start: WallTime, timeZone: string, seconds: number): { date: LocalDate; time: WallTime; timeZone: string } {
  const s = zonedToEpoch(date, start, timeZone).epochMs;
  const e = Math.round((s + seconds * 1000) / 60000) * 60000;
  return wallAt(e, timeZone);
}

const zoneNoteOf = (...kinds: ('exact' | 'ambiguous' | 'nonexistent')[]): ReadyRepresentation['zoneNote'] =>
  kinds.includes('nonexistent') ? 'nonexistent_time' : kinds.includes('ambiguous') ? 'ambiguous_time' : null;

function timed(
  kind: RepresentationKind,
  date: LocalDate,
  start: WallTime,
  /** End wall time; `timeZone` only when it differs from the start zone (fixed offset in a repeated DST hour). */
  end: { date: LocalDate; time: WallTime; timeZone?: string },
  timeZone: string,
  extra: { schedulingPlaceholder: boolean; descriptionLine: string | null; disclosure: string },
): ReadyRepresentation | InvalidRepresentation {
  const endZone = end.timeZone ?? timeZone;
  const s = zonedToEpoch(date, start, timeZone);
  const e = zonedToEpoch(end.date, end.time, endZone);
  if (!(e.epochMs > s.epochMs)) return invalid('end_not_after_start', date);
  return {
    status: 'ready',
    kind,
    allDay: false,
    start: { date, time: start, timeZone },
    end: { date: end.date, time: end.time, timeZone: endZone },
    schedulingPlaceholder: extra.schedulingPlaceholder,
    spanMin: Math.round((e.epochMs - s.epochMs) / 60000),
    descriptionLine: extra.descriptionLine,
    disclosure: extra.disclosure,
    outgoingDate: date,
    zoneNote: zoneNoteOf(s.kind, e.kind),
  };
}

const knownSec = (tm: Timing): number | null => (tm.durationSec != null && tm.durationSec > 0 ? tm.durationSec : null);

const durationLineFor = (tm: Timing): string | null => {
  const sec = tm.state === 'duration_only' ? (tm.declaredSec ?? knownSec(tm)) : null;
  return sec != null && sec > 0 ? REPR_STRINGS.durationLine(formatDuration(sec)) : null;
};

/** "1 h 30 min" for a known recorded duration, otherwise "Durata non specificata". */
export function durationLabel(session: Session): string {
  const sec = knownSec(session.timing);
  return sec != null ? formatDuration(sec) : t.durationNotSpecified;
}

// ─── timing → representation ─────────────────────────────────────────────────

/** Map a session's recorded timing (plus outgoing overrides) to an event time representation. */
export function representTiming(session: Session, opts: RepresentOptions = {}): TimeRepresentation {
  const ov = opts.override ?? null;
  const date = ov?.date ?? session.date;
  if (!isLocalDate(date)) return invalid('invalid_date', session.date);
  const tm = session.timing;

  if (ov?.time) return outgoingTime(session, date, ov.time, opts);

  switch (tm.state) {
    case 'date_only':
      return allDayMarker('date_marker', date, null, REPR_STRINGS.dateOnly);

    case 'duration_only': {
      const line = durationLineFor(tm);
      if (!line) return allDayMarker('date_marker', date, null, REPR_STRINGS.dateOnly);
      const sec = (tm.declaredSec ?? knownSec(tm)) as number;
      return allDayMarker('duration_marker', date, line, REPR_STRINGS.durationMarker(formatDuration(sec)));
    }

    case 'start_only': {
      if (!isWallTime(tm.start) || !isValidTimeZone(tm.timeZone)) return invalid('invalid_session_timing', date);
      const span = validSpanMin(ov?.startOnlySpanMin) ?? validSpanMin(opts.startOnlySpanMin);
      if (span == null) return pending(date);
      return timed('scheduling_span', date, tm.start, zonedPlus(date, tm.start, tm.timeZone, span * 60), tm.timeZone, {
        schedulingPlaceholder: true,
        descriptionLine: null,
        disclosure: REPR_STRINGS.startOnlyApproved(span),
      });
    }

    case 'interval': {
      if (!isWallTime(tm.start) || !isWallTime(tm.end) || !isValidTimeZone(tm.timeZone)) return invalid('invalid_session_timing', date);
      const endDate = tm.endDayOffset === 1 ? addDays(date, 1) : date;
      return timed('interval', date, tm.start, { date: endDate, time: tm.end }, tm.timeZone, {
        schedulingPlaceholder: false,
        descriptionLine: null,
        disclosure: REPR_STRINGS.interval,
      });
    }

    case 'start_duration': {
      const sec = tm.declaredSec ?? knownSec(tm);
      if (!isWallTime(tm.start) || !isValidTimeZone(tm.timeZone) || sec == null || !(sec > 0)) return invalid('invalid_session_timing', date);
      return timed('start_duration', date, tm.start, zonedPlus(date, tm.start, tm.timeZone, sec), tm.timeZone, {
        schedulingPlaceholder: false,
        descriptionLine: null,
        disclosure: REPR_STRINGS.startDuration,
      });
    }
  }
  return invalid('invalid_session_timing', date);
}

function outgoingTime(session: Session, date: LocalDate, ot: OutgoingTime, opts: RepresentOptions): TimeRepresentation {
  const tm = session.timing;
  const zone = ot.timeZone ?? tm.timeZone ?? opts.defaultTimeZone ?? deviceTimeZone();
  if (!isWallTime(ot.start)) return invalid('invalid_time', date);
  if (!isValidTimeZone(zone)) return invalid('invalid_zone', date);
  const extra = { schedulingPlaceholder: true, descriptionLine: durationLineFor(tm), disclosure: REPR_STRINGS.outgoingTime };

  if (ot.end != null) {
    if (!isWallTime(ot.end)) return invalid('invalid_time', date);
    const endDate = ot.endDayOffset === 1 ? addDays(date, 1) : date;
    return timed('outgoing_time', date, ot.start, { date: endDate, time: ot.end }, zone, extra);
  }
  if (ot.spanMin != null && validSpanMin(ot.spanMin) == null) return invalid('invalid_span', date);
  const spanSec =
    validSpanMin(ot.spanMin) != null
      ? (ot.spanMin as number) * 60
      : (knownSec(tm) ?? (validSpanMin(opts.override?.startOnlySpanMin) ?? validSpanMin(opts.startOnlySpanMin) ?? 0) * 60);
  if (!spanSec) return pending(date);
  return timed('outgoing_time', date, ot.start, zonedPlus(date, ot.start, zone, spanSec), zone, extra);
}

// ─── content ─────────────────────────────────────────────────────────────────

/**
 * Location text for the event's location field, plus a "Mappa: <link>" line
 * for the description when a readable place AND a map link both exist (so the
 * link is preserved without breaking the provider's geocoding of the text).
 */
export function placeToLocation(place: Place | null | undefined): { location: string | null; mapLine: string | null } {
  if (!place) return { location: null, mapLine: null };
  const label = place.label?.trim() || null;
  const address = place.address?.trim() || null;
  const url = place.mapUrl?.trim() || null;
  let location: string | null;
  if (label && address) location = address.toLowerCase().includes(label.toLowerCase()) ? address : `${label}, ${address}`;
  else location = label ?? address;
  let mapLine: string | null = null;
  if (location && url) mapLine = REPR_STRINGS.mapLine(url);
  if (!location && url) location = url;
  if (!location && place.coords) location = `${place.coords.lat.toFixed(6)}, ${place.coords.lng.toFixed(6)}`;
  return { location, mapLine };
}

const blankToNull = (s: string | null | undefined): string | null => (s == null || s.trim() === '' ? null : s);

/** Metadata written into the outgoing event: the session's TRUE timing, in the canonical form every reader accepts. */
export function appMetaFor(session: Session, opId: string, schedulingPlaceholder: boolean): AppEventMeta {
  return canonicalAppMeta({
    v: 1,
    sessionId: session.id,
    opId,
    timingState: session.timing.state,
    durationSec: knownSec(session.timing),
    durationSource: knownSec(session.timing) != null ? session.timing.durationSource : null,
    schedulingPlaceholder,
  });
}

export interface DraftOptions {
  categoryName: string;
  opId: string;
  prefix: string;
  suffix: string;
  includeNotes: boolean;
  includeLocation: boolean;
  startOnlySpanMin?: number | null;
  /** Destination label (Google colorId). Pass null when the destination has no labels. */
  colorId?: string | null;
  override?: ExportOverride | null;
  defaultTimeZone?: string | null;
}

export type DraftResult =
  | { status: 'ready'; draft: EventDraft; representation: ReadyRepresentation; title: ResolvedTitle }
  | { status: 'pending_representation'; draft: null; representation: PendingRepresentation; title: ResolvedTitle }
  | { status: 'invalid'; draft: null; representation: InvalidRepresentation; title: ResolvedTitle };

/** Compose the outgoing event for one session. Never mutates the session. */
export function buildEventDraft(session: Session, o: DraftOptions): DraftResult {
  const ov = o.override ?? null;
  const title = resolveTitle({ prefix: o.prefix, suffix: o.suffix, categoryName: o.categoryName, override: ov?.baseTitle ?? null });
  const representation = representTiming(session, { startOnlySpanMin: o.startOnlySpanMin ?? null, override: ov, defaultTimeZone: o.defaultTimeZone ?? null });
  if (representation.status === 'pending_representation') return { status: 'pending_representation', draft: null, representation, title };
  if (representation.status === 'invalid') return { status: 'invalid', draft: null, representation, title };

  const notesText = o.includeNotes ? blankToNull(ov && ov.notes !== undefined ? ov.notes : session.notes) : null;
  let location: string | null = null;
  let mapLine: string | null = null;
  if (o.includeLocation) {
    if (ov && ov.location !== undefined) location = blankToNull(ov.location);
    else ({ location, mapLine } = placeToLocation(session.place));
  }
  const lines = [representation.descriptionLine, notesText, mapLine].filter((x): x is string => !!x);

  const draft: EventDraft = {
    title: title.final,
    notes: lines.length ? lines.join('\n\n') : null,
    location,
    allDay: representation.allDay,
    start: { ...representation.start },
    end: { ...representation.end },
    colorId: o.colorId ?? null,
    appMeta: appMetaFor(session, o.opId, representation.schedulingPlaceholder),
  };
  return { status: 'ready', draft, representation, title };
}

// ─── snapshots (what was written or linked) ──────────────────────────────────

const instantOf = (date: LocalDate, time: WallTime, timeZone: string): string => new Date(zonedToEpoch(date, time, timeZone).epochMs).toISOString();

/** Snapshot of an outgoing draft (stored on the export link after a write). */
export function snapshotFromDraft(draft: EventDraft, categoryName: string): ExportSnapshot {
  const timedOk = !draft.allDay && isWallTime(draft.start.time) && isValidTimeZone(draft.start.timeZone);
  const endZone = isValidTimeZone(draft.end.timeZone) ? draft.end.timeZone : draft.start.timeZone;
  return {
    title: draft.title,
    notes: draft.notes,
    location: draft.location,
    allDay: draft.allDay,
    start: timedOk ? instantOf(draft.start.date, draft.start.time as string, draft.start.timeZone as string) : draft.start.date,
    end: timedOk && isWallTime(draft.end.time) && isValidTimeZone(endZone) ? instantOf(draft.end.date, draft.end.time, endZone) : draft.end.date,
    timeZone: draft.allDay ? null : draft.start.timeZone,
    timingState: draft.appMeta.timingState,
    durationSec: draft.appMeta.durationSec,
    durationSource: draft.appMeta.durationSource,
    schedulingPlaceholder: draft.appMeta.schedulingPlaceholder,
    categoryName,
  };
}

/** Instant (ISO) or date of an external event time, as stored in snapshots. */
export function eventTimeValue(ev: ExternalEvent, which: 'start' | 'end'): string {
  const p = ev[which];
  if (ev.allDay) return p.date;
  if (p.instant) return new Date(Date.parse(p.instant)).toISOString();
  if (isWallTime(p.time) && isValidTimeZone(p.timeZone)) return instantOf(p.date, p.time, p.timeZone);
  return p.date;
}

/**
 * Snapshot of an existing external event (used for 'link', which never changes
 * the event, and for writes reconciled after an uncertain outcome). Timing
 * provenance comes from `meta`: the session's true timing, never the event span.
 */
export function snapshotFromEvent(
  ev: ExternalEvent,
  meta: Pick<AppEventMeta, 'timingState' | 'durationSec' | 'durationSource' | 'schedulingPlaceholder'>,
  categoryName: string,
): ExportSnapshot {
  return {
    title: ev.title,
    notes: ev.notes,
    location: ev.location,
    allDay: ev.allDay,
    start: eventTimeValue(ev, 'start'),
    end: eventTimeValue(ev, 'end'),
    timeZone: ev.allDay ? null : ev.start.timeZone,
    timingState: meta.timingState,
    durationSec: meta.durationSec,
    durationSource: meta.durationSource,
    schedulingPlaceholder: meta.schedulingPlaceholder,
    categoryName,
  };
}

// ─── explicit "apply to session" ─────────────────────────────────────────────

export type ApplyField = 'notes' | 'location' | 'date' | 'time';

export type ApplyResult =
  | {
      ok: true;
      patch: SessionPatch;
      applied: ApplyField[];
      /** Consequences of a timing change (e.g. duration becomes unknown), for the confirmation copy. */
      timingChanges: TimingChange[];
    }
  | { ok: false; error: 'invalid_date' | TimingError; field: ApplyField };

/**
 * Build a SessionPatch from an export override — ONLY for the fields the user
 * explicitly chose to apply back. Titles are never applied (sessions have no
 * title and the category name is not renamed from here). Scheduling spans are
 * export-only and never become a duration: an outgoing start without an end
 * becomes start-only (or start + the already declared duration).
 */
export function overrideToSessionPatch(session: Session, override: ExportOverride, fields: readonly ApplyField[]): ApplyResult {
  const patch: SessionPatch = {};
  const applied: ApplyField[] = [];
  let timingChanges: TimingChange[] = [];
  const want = new Set(fields);

  if (want.has('date') && override.date != null) {
    if (!isLocalDate(override.date)) return { ok: false, error: 'invalid_date', field: 'date' };
    if (override.date !== session.date) {
      patch.date = override.date;
      applied.push('date');
    }
  }
  if (want.has('notes') && override.notes !== undefined) {
    patch.notes = blankToNull(override.notes);
    applied.push('notes');
  }
  if (want.has('location') && override.location !== undefined) {
    const text = blankToNull(override.location);
    const cur = session.place;
    patch.place = text
      ? { label: text, address: null, mapUrl: cur?.mapUrl ?? null, coords: cur?.coords ?? null, resolution: cur?.resolution ?? 'none', resolutionNote: cur?.resolutionNote ?? null }
      : null;
    applied.push('location');
  }
  if (want.has('time') && override.time) {
    const ot = override.time;
    const tm = session.timing;
    const zone = ot.timeZone ?? tm.timeZone ?? deviceTimeZone();
    let input: TimingInput;
    if (ot.end != null) input = { state: 'interval', start: ot.start, end: ot.end, endDayOffset: ot.endDayOffset === 1 ? 1 : 0, timeZone: zone };
    else if (tm.declaredSec != null) input = { state: 'start_duration', start: ot.start, timeZone: zone, declaredSec: tm.declaredSec };
    else input = { state: 'start_only', start: ot.start, timeZone: zone };
    const r = buildTiming(patch.date ?? session.date, input);
    if (!r.ok) return { ok: false, error: r.error, field: 'time' };
    patch.timing = r.timing;
    timingChanges = describeSwitch(tm, r.timing.state as TimingState);
    applied.push('time');
  }
  return { ok: true, patch, applied, timingChanges };
}
