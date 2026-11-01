/**
 * Calendar import engine. Pure TS: no React, no Expo, no provider calls.
 *
 * Pipeline (one destination activity per operation):
 *   provider.listEvents(...)  →  buildReview(...)  →  user selection  →  commitImport(...)
 *
 * Rules implemented here (docs/SPEC-calendar.md, "Import — one activity per operation"):
 *  - Filters: source calendars (scope) AND title condition (if set) AND label
 *    condition (if set and the provider exposes per-event labels). The title
 *    condition looks at the title only — never notes, location or attendees —
 *    case-, accent- and whitespace-insensitively.
 *  - Timing: all-day (single or multi-day) → date only, unknown duration,
 *    anchored at the start date; a valid timed interval on the same day or
 *    ending the next day → interval (DST-correct, via domain/timing); zero or
 *    negative length → start only; timed spans of a day or more → start only
 *    with a visible note (the span is kept as provenance, never as duration).
 *    Serie's own exported events restore their original timing from metadata;
 *    scheduling placeholders never become durations.
 *  - Duplicates: provenance → "already imported" (or "imported, then deleted"),
 *    app metadata / export links → "own export", same-date local sessions →
 *    "possible match" (only when clocks are missing or starts are ≤ 30 min apart).
 *    Cancelled occurrences are listed as excluded and cannot be selected.
 *  - Commit: one transaction; deterministic save request ids + provenance
 *    re-check make a retried commit unable to duplicate sessions.
 */
import type { Category, ID, LocalDate, Place, ProviderKind, Session, Timing, TimingState, WallTime } from '@/domain/types';
import type { AppEventMeta, CalendarProvider, EventTime, ExternalCalendar, ExternalEvent } from './types';
import { refKey } from './types';
import { DATE_ONLY, buildTiming } from '@/domain/timing';
import { addDays, compareDates, diffDays, isLocalDate, parseDate } from '@/domain/dates';
import { epochToZoned, isValidTimeZone, isWallTime, zonedToEpoch } from '@/domain/zoned';
import { formatDuration } from '@/domain/duration';
import { MONTHS, t } from '@/i18n/it';
import { DomainError, type ExportLinkRecord, type ProvenanceRecord, type Repositories } from '@/data/repositories';
import { Mutex } from '@/data/driver';
import { REPR_STRINGS } from './representation';
import { APP_META_TIMING_STATES, parseAppMeta } from './appMeta';

// ─── strings (Italian, user-facing) ──────────────────────────────────────────

export const IMPORT_STRINGS = {
  status: {
    new: t.statusNew,
    already_imported: t.statusAlreadyImported,
    imported_then_deleted: 'Importato, poi eliminato',
    own_export: t.statusOwnExport,
    possible_match: t.statusPossibleMatch,
    cancelled: t.statusCancelled,
  } as Record<ImportStatus, string>,
  reasonNew: 'Nuovo evento: verrà importato.',
  reasonAlreadyImported: 'Già importato: la sessione esiste già.',
  reasonImportedThenDeleted: 'Importato in passato, poi la sessione è stata eliminata. Selezionalo per importarlo di nuovo.',
  reasonOwnExport: 'Evento esportato da Serie: la sessione esiste già.',
  reasonLinked: 'Evento collegato a una sessione di Serie: la sessione esiste già.',
  reasonOwnExportDeleted: 'Evento esportato da Serie; la sessione originale è stata eliminata. Selezionalo per ripristinarla.',
  reasonPossibleNoClock: (activity: string, date: string) =>
    `Possibile corrispondenza: il ${date} c’è già una sessione ${activity} e mancano gli orari per distinguerle.`,
  reasonPossibleClose: (activity: string, date: string, time: string, minutes: number) =>
    `Possibile corrispondenza: il ${date} c’è già una sessione ${activity} alle ${time} (${minutes} min di differenza).`,
  reasonPossibleOverlap: (activity: string, date: string, time: string) =>
    `Possibile corrispondenza: il ${date} c’è già una sessione ${activity} (${time}) con orari sovrapposti.`,
  reasonSameEventOtherCalendar: (calendar: string) => `Stesso evento anche in ${calendar}: selezionalo solo se è un’altra sessione.`,
  reasonCancelled: 'Annullato nel calendario: escluso.',
  noteAllDay: 'Giornata intera: durata non specificata.',
  noteAllDayMulti: 'Evento su più giorni: nessuna durata ricavata dall’intervallo.',
  noteMidnightSpan: 'Da mezzanotte a fine giornata: trattato come giornata intera, durata non specificata.',
  noteMultiDayTimed: (time: string) => `Evento su più giorni: resta solo l’ora di inizio (${time}), durata non specificata.`,
  noteZeroLength: 'Inizio e fine coincidono: resta solo l’ora di inizio.',
  noteEndBeforeStart: 'La fine precede l’inizio: resta solo l’ora di inizio.',
  noteNoEnd: 'Evento senza fine leggibile: resta solo l’ora di inizio.',
  noteUnrepresentable: 'Cambio dell’ora: intervallo non rappresentabile, resta solo l’ora di inizio.',
  noteNoTime: 'Evento senza orario leggibile: solo data.',
  noteRestored: 'Orario originale di Serie ripristinato.',
  noteRestoredPlaceholder: 'Orario originale di Serie ripristinato: l’intervallo nel calendario era solo di pianificazione.',
  noteRestoredForeign: 'Evento esportato da Serie su un altro dispositivo: orario originale ripristinato.',
  noteRestoredDurationOnly: 'Orario nel calendario solo di pianificazione: resta la durata registrata, senza orari.',
  placeLinkNotRead: 'Link importato dal calendario: posizione non ancora letta.',
  whenRange: (a: string, b: string) => `Dal ${a} al ${b}`,
  calendarUnknown: 'Calendario sconosciuto',
} as const;

// ─── public types ────────────────────────────────────────────────────────────

export type ProviderCapabilities = CalendarProvider['capabilities'];

export interface ImportFilters {
  /** Selected source calendars (`ExternalEvent.calendarId`). Empty → nothing matches. */
  calendarIds: string[];
  /** Optional narrowing to one connection (recommended: an import uses one connection). */
  provider?: ProviderKind;
  accountId?: string;
  /** "Event title contains" (title only). null/blank → no title condition. */
  titleContains: string | null;
  /** Google colorIds. null/empty → no label condition. Ignored when the provider has no per-event labels. */
  labelIds: string[] | null;
  /** Inclusive range on the session date the event would get (its start date). */
  from: LocalDate;
  to: LocalDate;
}

export interface MatchContext {
  /** `provider.capabilities.eventLabels`. */
  labelsSupported: boolean;
  /** Fallback zone for timed events whose zone is unknown. */
  deviceTimeZone: string;
}

export type ImportStatus = 'new' | 'already_imported' | 'imported_then_deleted' | 'own_export' | 'possible_match' | 'cancelled';

export type TimingMappingKind =
  | 'all_day'
  | 'all_day_multi'
  | 'midnight_span'
  | 'interval'
  | 'overnight'
  | 'zero_length'
  | 'end_before_start'
  | 'no_end'
  | 'multi_day_timed'
  | 'unrepresentable'
  | 'no_time'
  | 'restored';

/** Timing restored from Serie's own metadata (event appMeta or the stored export snapshot). */
export interface TrustedTiming {
  timingState: TimingState;
  durationSec: number | null;
  schedulingPlaceholder: boolean;
  source: 'app_meta' | 'export_snapshot';
}

export interface TimingMapping {
  date: LocalDate;
  timing: Timing;
  kind: TimingMappingKind;
  source: 'event' | TrustedTiming['source'];
  /** Multi-day mapping, e.g. "Dal 3 marzo 2026 al 5 marzo 2026 (3 giorni) → 1 sessione il 3 marzo 2026". */
  mappingNote: string | null;
  /** Visible explanation of how timing was derived (or why duration stays unknown). */
  timingNote: string | null;
  /** Source span kept as provenance only: dates (exclusive end) for all-day, UTC instants for timed. */
  span: { allDay: boolean; start: string; end: string };
  /** The source event's dates and available times, for the review row. */
  sourceWhen: string;
}

export interface ProposedSession {
  date: LocalDate;
  timing: Timing;
  /** "07:30–09:00", "22:00–01:30 (+1)", "07:30"; null without clock time. */
  timeLabel: string | null;
  /** Formatted known duration or "Durata non specificata". */
  durationLabel: string;
  notes: string | null;
  place: Place | null;
  originalTitle: string;
  mappingNote: string | null;
  timingNote: string | null;
  timingSource: TimingMapping['source'];
  provenance: TimingMapping['span'];
}

export interface ReviewItem {
  /** Stable identity of the occurrence: provider:account:calendar:eventId:occurrenceKey. */
  key: string;
  event: ExternalEvent;
  status: ImportStatus;
  statusLabel: string;
  /** Explicit Italian reason for the status. */
  reason: string;
  /** False for cancelled, already imported and own exports whose session still exists. */
  selectable: boolean;
  selectedByDefault: boolean;
  /** Local session involved in the status (already imported / own export / possible match). */
  matchedSessionId: ID | null;
  proposed: ProposedSession;
  /** "Surf · a@b.com · Google Calendar". */
  sourceLabel: string;
  sourceWhen: string;
  notesPreview: string | null;
  /** Destination activity name. */
  destinationLabel: string;
}

export interface BuildReviewInput {
  events: readonly ExternalEvent[];
  filters: ImportFilters;
  capabilities: ProviderCapabilities;
  /** Used for source labels (calendar title + account). Optional. */
  calendars?: readonly ExternalCalendar[];
  /** Provenance for the source calendars (`repos.provenance.listForCalendars`). */
  provenance: readonly ProvenanceRecord[];
  /** All local sessions (every activity): own-export detection uses all, possible matches the target activity. */
  localSessions: readonly Session[];
  exportLinks: readonly ExportLinkRecord[];
  /** Destination activity. */
  category: Pick<Category, 'id' | 'name'>;
  deviceTimeZone: string;
}

// ─── small helpers ───────────────────────────────────────────────────────────

/** "3 marzo 2026". */
export function formatDateIt(date: LocalDate): string {
  if (!isLocalDate(date)) return date;
  const { y, m, d } = parseDate(date);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const sameOccurrence = (a: string | null | undefined, b: string | null | undefined): boolean => {
  const x = a || null, y = b || null;
  if (x === y) return true;
  if (x == null || y == null) return false;
  if (isLocalDate(x) || isLocalDate(y)) return false;
  const ex = Date.parse(x), ey = Date.parse(y);
  return Number.isFinite(ex) && ex === ey;
};

/** Stable key of one event occurrence. */
export function eventKey(e: Pick<ExternalEvent, 'provider' | 'accountId' | 'calendarId' | 'eventId' | 'occurrenceKey'>): string {
  return `${refKey(e)}:${e.eventId}:${e.occurrenceKey ?? ''}`;
}

/** Deterministic save request id for one event inside one import batch. */
export function importRequestId(batchId: string, key: string): string {
  return `import:${batchId}:${key}`;
}

/** Case-, accent- and whitespace-insensitive form used for title matching. */
export function normalizeForMatch(s: string): string {
  let x = s;
  try {
    x = x.normalize('NFD');
  } catch {
    /* runtime without normalize: keep accents */
  }
  return x
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Title-only "contains" condition. A blank needle is no condition. */
export function titleMatches(title: string | null | undefined, needle: string | null | undefined): boolean {
  const n = needle ? normalizeForMatch(needle) : '';
  if (!n) return true;
  return normalizeForMatch(title ?? '').includes(n);
}

/** Whether the label filter is active for this provider (else the UI shows `t.labelsUnsupported`). */
export function labelFilterApplies(filters: Pick<ImportFilters, 'labelIds'>, labelsSupported: boolean): boolean {
  return labelsSupported && !!filters.labelIds && filters.labelIds.length > 0;
}

function zoneFor(e: ExternalEvent, deviceTimeZone: string): string {
  if (isValidTimeZone(e.start.timeZone)) return e.start.timeZone;
  return isValidTimeZone(deviceTimeZone) ? deviceTimeZone : 'UTC';
}

interface ZonedPoint {
  date: LocalDate;
  time: WallTime;
  epochMs: number;
}

/** A timed event point as wall time in `zone` (the session's zone). The UTC instant wins when present. */
function pointIn(p: EventTime, zone: string): ZonedPoint | null {
  const ms = p.instant ? Date.parse(p.instant) : NaN;
  if (Number.isFinite(ms)) return { ...epochToZoned(ms, zone), epochMs: ms };
  if (isLocalDate(p.date) && isWallTime(p.time)) {
    const r = zonedToEpoch(p.date, p.time, isValidTimeZone(p.timeZone) ? p.timeZone : zone);
    return { ...epochToZoned(r.epochMs, zone), epochMs: r.epochMs };
  }
  return null;
}

/** The session date an event would get: start date (in the event's zone for timed events). */
export function anchorDate(e: ExternalEvent, deviceTimeZone: string): LocalDate | null {
  if (e.allDay) return isLocalDate(e.start.date) ? e.start.date : null;
  const p = pointIn(e.start, zoneFor(e, deviceTimeZone));
  if (p) return p.date;
  return isLocalDate(e.start.date) ? e.start.date : null;
}

// ─── filters ─────────────────────────────────────────────────────────────────

/**
 * Combined rule: in the selected source calendars AND title condition (if set)
 * AND label condition (if set and supported) AND start date within the range.
 * Event status is not considered here (cancelled events are listed as excluded).
 */
export function matchEvent(e: ExternalEvent, filters: ImportFilters, ctx: MatchContext): boolean {
  if (!filters.calendarIds.includes(e.calendarId)) return false;
  if (filters.provider && e.provider !== filters.provider) return false;
  if (filters.accountId && e.accountId !== filters.accountId) return false;
  if (!titleMatches(e.title, filters.titleContains)) return false;
  if (labelFilterApplies(filters, ctx.labelsSupported) && (e.colorId == null || !filters.labelIds!.includes(e.colorId))) return false;
  const d = anchorDate(e, ctx.deviceTimeZone);
  if (!d) return false;
  if (isLocalDate(filters.from) && compareDates(d, filters.from) < 0) return false;
  if (isLocalDate(filters.to) && compareDates(d, filters.to) > 0) return false;
  return true;
}

// ─── timing ──────────────────────────────────────────────────────────────────


/** Serie's metadata on an event, through the validator both providers use (`parseAppMeta`). */
function validMeta(m: AppEventMeta | null | undefined): AppEventMeta | null {
  return parseAppMeta(m);
}

/** Trusted timing for an event: its Serie metadata, else the snapshot of a stored export link. */
export function trustedTimingOf(e: ExternalEvent, link: ExportLinkRecord | null | undefined): TrustedTiming | null {
  const m = validMeta(e.appMeta);
  if (m) return { timingState: m.timingState, durationSec: m.durationSec, schedulingPlaceholder: !!m.schedulingPlaceholder, source: 'app_meta' };
  const s = link?.snapshot;
  if (s && APP_META_TIMING_STATES.includes(s.timingState)) {
    return { timingState: s.timingState, durationSec: s.durationSec, schedulingPlaceholder: !!s.schedulingPlaceholder, source: 'export_snapshot' };
  }
  return null;
}

const iso = (ms: number) => new Date(ms).toISOString();

function startOnly(date: LocalDate, start: WallTime, zone: string): Timing {
  const r = buildTiming(date, { state: 'start_only', start, timeZone: zone });
  return r.ok ? r.timing : { ...DATE_ONLY };
}

function declaredOf(sec: number | null | undefined): number | null {
  return typeof sec === 'number' && Number.isFinite(sec) && sec > 0 ? Math.round(sec) : null;
}

function withZone(label: string, zone: string, deviceTimeZone: string): string {
  return zone !== deviceTimeZone ? `${label} (${zone})` : label;
}

/** Event-only mapping (no metadata). */
function mapFromEvent(e: ExternalEvent, deviceTimeZone: string): (TimingMapping & { startPoint: ZonedPoint | null; endPoint: ZonedPoint | null; zone: string | null }) | null {
  if (e.allDay) {
    const start = e.start.date;
    if (!isLocalDate(start)) return null;
    const endEx = isLocalDate(e.end.date) && compareDates(e.end.date, start) > 0 ? e.end.date : addDays(start, 1);
    const days = diffDays(endEx, start);
    const last = addDays(endEx, -1);
    const span = { allDay: true, start, end: endEx };
    const base = { date: start, timing: { ...DATE_ONLY }, source: 'event' as const, span, startPoint: null, endPoint: null, zone: null };
    if (days > 1) {
      return {
        ...base,
        kind: 'all_day_multi',
        mappingNote: t.multiDay(formatDateIt(start), formatDateIt(last), days),
        timingNote: IMPORT_STRINGS.noteAllDayMulti,
        sourceWhen: `${IMPORT_STRINGS.whenRange(formatDateIt(start), formatDateIt(last))} · ${t.allDay}`,
      };
    }
    return { ...base, kind: 'all_day', mappingNote: null, timingNote: IMPORT_STRINGS.noteAllDay, sourceWhen: `${formatDateIt(start)} · ${t.allDay}` };
  }

  const zone = zoneFor(e, deviceTimeZone);
  const s = pointIn(e.start, zone);
  if (!s) {
    if (!isLocalDate(e.start.date)) return null;
    return {
      date: e.start.date,
      timing: { ...DATE_ONLY },
      kind: 'no_time',
      source: 'event',
      mappingNote: null,
      timingNote: IMPORT_STRINGS.noteNoTime,
      span: { allDay: false, start: e.start.instant ?? e.start.date, end: e.end.instant ?? e.end.date },
      sourceWhen: formatDateIt(e.start.date),
      startPoint: null,
      endPoint: null,
      zone: null,
    };
  }
  const en = pointIn(e.end, zone);
  const span = { allDay: false, start: iso(s.epochMs), end: iso((en ?? s).epochMs) };
  const common = { date: s.date, source: 'event' as const, span, startPoint: s, endPoint: en, zone };
  const asStartOnly = (kind: TimingMappingKind, note: string, sourceWhen: string, mappingNote: string | null = null) => ({
    ...common,
    timing: startOnly(s.date, s.time, zone),
    kind,
    mappingNote,
    timingNote: note,
    sourceWhen: withZone(sourceWhen, zone, deviceTimeZone),
  });

  if (!en) return asStartOnly('no_end', IMPORT_STRINGS.noteNoEnd, `${formatDateIt(s.date)} · ${s.time}`);

  const lengthSec = Math.round((en.epochMs - s.epochMs) / 1000);
  const dayOffset = diffDays(en.date, s.date);

  // Whole-day spans written as timed events (00:00–00:00 of a later day, or
  // 00:00–23:59 as some apps store "all day") are day markers in disguise: never hours.
  const midnightToMidnight = en.time === '00:00' && dayOffset >= 1;
  const midnightToEndOfDay = en.time === '23:59' && dayOffset >= 0;
  if (s.time === '00:00' && (midnightToMidnight || midnightToEndOfDay)) {
    const last = midnightToMidnight ? addDays(en.date, -1) : en.date;
    const days = diffDays(last, s.date) + 1;
    const multi = days > 1;
    return {
      ...common,
      timing: { ...DATE_ONLY },
      kind: 'midnight_span',
      mappingNote: multi ? t.multiDay(formatDateIt(s.date), formatDateIt(last), days) : null,
      timingNote: IMPORT_STRINGS.noteMidnightSpan,
      sourceWhen: withZone(
        multi ? IMPORT_STRINGS.whenRange(formatDateIt(s.date), formatDateIt(last)) : `${formatDateIt(s.date)} · ${s.time}–${en.time}${dayOffset ? ' (+1)' : ''}`,
        zone,
        deviceTimeZone,
      ),
    };
  }
  if (lengthSec === 0) return asStartOnly('zero_length', IMPORT_STRINGS.noteZeroLength, `${formatDateIt(s.date)} · ${s.time}`);
  if (lengthSec < 0) return asStartOnly('end_before_start', IMPORT_STRINGS.noteEndBeforeStart, `${formatDateIt(s.date)} · ${s.time}`);

  if (lengthSec >= 86400 || dayOffset >= 2 || dayOffset < 0) {
    const last = en.time === '00:00' ? addDays(en.date, -1) : en.date;
    const days = diffDays(last, s.date) + 1;
    return asStartOnly(
      'multi_day_timed',
      IMPORT_STRINGS.noteMultiDayTimed(s.time),
      `${IMPORT_STRINGS.whenRange(`${formatDateIt(s.date)} ${s.time}`, `${formatDateIt(en.date)} ${en.time}`)}`,
      days > 1 ? t.multiDay(formatDateIt(s.date), formatDateIt(last), days) : null,
    );
  }

  const off = dayOffset === 1 ? 1 : 0;
  const when = `${formatDateIt(s.date)} · ${s.time}–${en.time}${off ? ' (+1)' : ''}`;
  const r = buildTiming(s.date, { state: 'interval', start: s.time, end: en.time, endDayOffset: off, timeZone: zone });
  // Wall times have minute precision. A gap of a minute or more between the wall-derived
  // and the real elapsed time means a wall time fell in the repeated hour of a DST fall
  // back, which a wall-time interval cannot express: never store a wrong duration.
  if (!r.ok || Math.abs((r.timing.durationSec ?? 0) - lengthSec) >= 60) return asStartOnly('unrepresentable', IMPORT_STRINGS.noteUnrepresentable, when);
  return {
    ...common,
    timing: r.timing,
    kind: off ? 'overnight' : 'interval',
    mappingNote: null,
    timingNote: null,
    sourceWhen: withZone(when, zone, deviceTimeZone),
  };
}

/** Restore the original timing state of a Serie event. Never derives hours from spans or placeholders. */
function restoreTiming(date: LocalDate, trusted: TrustedTiming, base: NonNullable<ReturnType<typeof mapFromEvent>>): Timing {
  const sp = base.startPoint;
  const zone = base.zone;
  const declared = declaredOf(trusted.durationSec);
  const durationOnly = (): Timing => {
    if (declared == null) return { ...DATE_ONLY };
    const r = buildTiming(date, { state: 'duration_only', declaredSec: declared });
    return r.ok ? r.timing : { ...DATE_ONLY };
  };
  const start = (): Timing => (sp && zone ? startOnly(date, sp.time, zone) : { ...DATE_ONLY });
  switch (trusted.timingState) {
    case 'date_only':
      return { ...DATE_ONLY };
    case 'duration_only':
      return durationOnly();
    case 'start_only':
      return start();
    case 'start_duration': {
      // With a placeholder the event's start is an export-only time chosen for the
      // calendar, not the recorded start: keep the declared duration, invent no clock time.
      if (trusted.schedulingPlaceholder) return durationOnly();
      if (sp && zone && declared != null) {
        const r = buildTiming(date, { state: 'start_duration', start: sp.time, timeZone: zone, declaredSec: declared });
        if (r.ok) return r.timing;
      }
      return sp && zone ? start() : durationOnly();
    }
    case 'interval': {
      // Recorded intervals are always exported with their real endpoints; a placeholder
      // means the event carries an export-only time instead. Then neither its start nor
      // its span is recorded timing: keep only the recorded duration (if any).
      if (trusted.schedulingPlaceholder) return durationOnly();
      // Rebuild the recorded interval from the event's endpoints (not through the
      // day-marker / multi-day heuristics meant for foreign events).
      const ep = base.endPoint;
      if (sp && ep && zone) {
        const off = diffDays(ep.date, sp.date);
        if (off === 0 || off === 1) {
          const r = buildTiming(date, { state: 'interval', start: sp.time, end: ep.time, endDayOffset: off, timeZone: zone });
          const realSec = Math.round((ep.epochMs - sp.epochMs) / 1000);
          // Same guard as for foreign events: a wall time in a repeated DST hour must not yield a wrong duration.
          if (r.ok && Math.abs((r.timing.durationSec ?? 0) - realSec) < 60) return r.timing;
        }
      }
      return start();
    }
  }
}

/**
 * Map an external event to the proposed session date and timing.
 * `trusted` (from `trustedTimingOf`) restores Serie's own exported timing.
 */
export function mapEventTiming(e: ExternalEvent, deviceTimeZone: string, trusted?: TrustedTiming | null): TimingMapping | null {
  const base = mapFromEvent(e, deviceTimeZone);
  if (!base) return null;
  const { startPoint: _sp, endPoint: _ep, zone: _z, ...plain } = base;
  if (!trusted) return plain;
  const timing = restoreTiming(base.date, trusted, base);
  const placeholderOnlyTime = trusted.schedulingPlaceholder && (trusted.timingState === 'interval' || trusted.timingState === 'start_duration');
  return {
    ...plain,
    timing,
    kind: 'restored',
    source: trusted.source,
    timingNote: placeholderOnlyTime && timing.durationSec != null
      ? IMPORT_STRINGS.noteRestoredDurationOnly
      : trusted.schedulingPlaceholder
        ? IMPORT_STRINGS.noteRestoredPlaceholder
        : IMPORT_STRINGS.noteRestored,
  };
}

export function timeLabelOf(timing: Timing): string | null {
  if (!timing.start) return null;
  if (timing.state === 'interval' && timing.end) return `${timing.start}–${timing.end}${timing.endDayOffset ? ' (+1)' : ''}`;
  return timing.start;
}

export function durationLabelOf(timing: Timing): string {
  return timing.durationSec != null && timing.durationSec > 0 ? formatDuration(timing.durationSec) : t.durationNotSpecified;
}

// ─── notes & place ───────────────────────────────────────────────────────────

const HTML_HINT = /<\/?(br|p|div|a|b|i|u|span|ul|ol|li|strong|em|html|body)\b[^<>]*>/i;
const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', euro: '€', deg: '°', middot: '·',
};
/** Accented letters as named entities (&egrave; &Agrave; &uuml; …) → base letter + combining mark. */
const ACCENT_MARKS: Record<string, string> = { grave: '\u0300', acute: '\u0301', circ: '\u0302', tilde: '\u0303', uml: '\u0308' };

function decodeEntities(s: string): string {
  const out = s.replace(/&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]+);/gi, (m, k: string) => {
    if (k[0] === '#') {
      const code = k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : m;
    }
    if (ENTITIES[k] != null) return ENTITIES[k];
    const acc = /^([a-z])(grave|acute|circ|tilde|uml)$/i.exec(k);
    return acc ? acc[1] + ACCENT_MARKS[acc[2].toLowerCase()] : m;
  });
  try {
    return out.normalize('NFC');
  } catch {
    return out;
  }
}

/** Source notes as plain text. Google descriptions may be HTML; plain text is left untouched. */
export function notesFromEvent(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let s = raw.replace(/\r\n?/g, '\n');
  if (HTML_HINT.test(s)) {
    s = s
      .replace(/<a\b[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))[^>]*>([\s\S]*?)<\/a\s*>/gi, (_m, dq: string | undefined, sq: string | undefined, bare: string | undefined, inner: string) => {
        const href = (dq ?? sq ?? bare ?? '').trim();
        const text = inner.replace(/<\/?[a-z][a-z0-9]*\b[^<>]*>/gi, '').trim();
        if (!href) return text;
        return text && text !== href ? `${text} (${href})` : href;
      })
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|ul|ol)\s*>/gi, '\n')
      .replace(/<li\b[^<>]*>/gi, '• ')
      .replace(/<\/?[a-z][a-z0-9]*\b[^<>]*>/gi, '');
    s = decodeEntities(s);
  }
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return s.length ? s : null;
}

/** One-line notes preview for the review row. */
export function notesPreview(notes: string | null, max = 120): string | null {
  if (!notes) return null;
  const one = notes.replace(/\s+/g, ' ').trim();
  if (!one) return null;
  // Count code points, not UTF-16 units, so an emoji is never cut in half.
  const chars = Array.from(one);
  return chars.length > max ? `${chars.slice(0, max - 1).join('').trimEnd()}…` : one;
}

/**
 * Notes of one of Serie's own exported events, without the lines the export added
 * to the description (see representation.ts: "Durata: …" first, "Mappa: <link>" last).
 * Only exact matches are removed, and the map line only when its link is kept on the place.
 */
export function stripExportLines(notes: string | null, trusted: Pick<TrustedTiming, 'timingState' | 'durationSec'>, place: Place | null): string | null {
  if (!notes) return notes;
  const paras = notes.split(/\n{2,}/);
  const sec = declaredOf(trusted.durationSec);
  if (trusted.timingState === 'duration_only' && sec != null && paras.length && paras[0].trim() === REPR_STRINGS.durationLine(formatDuration(sec))) paras.shift();
  if (place?.mapUrl && paras.length && paras[paras.length - 1].trim() === REPR_STRINGS.mapLine(place.mapUrl)) paras.pop();
  const out = paras.join('\n\n').trim();
  return out.length ? out : null;
}

const MAPS_URL_RE = /https?:\/\/(?:(?:www\.)?google\.[a-z.]{2,6}\/maps|maps\.google\.[a-z.]{2,6}|goo\.gl\/maps|maps\.app\.goo\.gl|maps\.apple\.com)[^\s<>"']*/i;

/** First supported maps link in a text (Google Maps, short links, Apple Maps). Coordinates are never guessed here. */
export function findMapsLink(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = MAPS_URL_RE.exec(text);
  return m ? m[0].replace(/[).,;:!?\]]+$/, '') : null;
}

/** Location text → Place (label / address), keeping a maps link verbatim and unresolved. */
export function placeFromEvent(location: string | null | undefined, notes?: string | null): Place | null {
  const loc = (location ?? '').trim();
  const link = findMapsLink(loc) ?? findMapsLink(notes);
  const text = (link ? loc.replace(link, ' ') : loc).replace(/[ \t]+/g, ' ').trim();
  let label: string | null = null;
  let address: string | null = null;
  if (text) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      label = lines[0];
      address = lines.slice(1).join(', ');
    } else {
      label = lines[0] ?? null;
    }
  }
  if (!label && !address && !link) return null;
  return {
    label,
    address,
    mapUrl: link,
    coords: null,
    resolution: link ? 'unresolved' : 'none',
    resolutionNote: link ? IMPORT_STRINGS.placeLinkNotRead : null,
  };
}

function sourceLabelOf(e: ExternalEvent, calendars: readonly ExternalCalendar[] | undefined): string {
  const provider = e.provider === 'google' ? t.google : t.apple;
  const k = refKey(e);
  const cal = calendars?.find((c) => refKey(c) === k);
  if (!cal) return `${e.calendarId || IMPORT_STRINGS.calendarUnknown} · ${provider}`;
  const parts = [cal.title];
  if (cal.accountLabel && cal.accountLabel !== cal.title) parts.push(cal.accountLabel);
  parts.push(provider);
  return parts.join(' · ');
}

// ─── duplicates ──────────────────────────────────────────────────────────────

// Lookups are indexed so multi-year reviews stay linear (events × records would freeze the JS thread).
const SEP = '\u0001';
const calKey = (r: { provider: string; accountId: string; calendarId: string }, id: string) => [r.provider, r.accountId, r.calendarId, id].join(SEP);

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}

/** Provenance indexed by event id and by series id (each bucket keeps list order). */
export interface ProvenanceIndex {
  byEvent: Map<string, ProvenanceRecord[]>;
  bySeries: Map<string, ProvenanceRecord[]>;
}

export function indexProvenance(provenance: readonly ProvenanceRecord[]): ProvenanceIndex {
  const ix: ProvenanceIndex = { byEvent: new Map(), bySeries: new Map() };
  for (const p of provenance) {
    push(ix.byEvent, calKey(p, p.externalEventId), p);
    if (p.recurringEventId) push(ix.bySeries, calKey(p, p.recurringEventId), p);
  }
  return ix;
}

/** Provenance of a previous import of this exact occurrence (exact event id first, then same series occurrence). */
export function lookupProvenance(e: ExternalEvent, ix: ProvenanceIndex): ProvenanceRecord | null {
  for (const p of ix.byEvent.get(calKey(e, e.eventId)) ?? []) if (sameOccurrence(p.occurrenceKey, e.occurrenceKey)) return p;
  // Same occurrence of the same series under a different instance id.
  if (e.recurringEventId && e.occurrenceKey) {
    for (const p of ix.bySeries.get(calKey(e, e.recurringEventId)) ?? []) if (sameOccurrence(p.occurrenceKey, e.occurrenceKey)) return p;
  }
  return null;
}

/** Provenance of a previous import of this exact occurrence. */
export function findProvenance(e: ExternalEvent, provenance: readonly ProvenanceRecord[]): ProvenanceRecord | null {
  return lookupProvenance(e, indexProvenance(provenance));
}

/** Export links indexed by event identity, operation id and session (first record wins, as stored). */
export interface ExportLinkIndex {
  byEvent: Map<string, ExportLinkRecord[]>;
  byOp: Map<string, ExportLinkRecord>;
  bySession: Map<string, ExportLinkRecord>;
}

export function indexExportLinks(links: readonly ExportLinkRecord[]): ExportLinkIndex {
  const ix: ExportLinkIndex = { byEvent: new Map(), byOp: new Map(), bySession: new Map() };
  for (const l of links) {
    push(ix.byEvent, calKey(l, l.externalEventId), l);
    if (!ix.byOp.has(l.opId)) ix.byOp.set(l.opId, l);
    if (l.sessionId != null && !ix.bySession.has(l.sessionId)) ix.bySession.set(l.sessionId, l);
  }
  return ix;
}

/** Export link describing this event (by event identity, by operation id, or by the metadata session). */
export function lookupExportLink(e: ExternalEvent, ix: ExportLinkIndex): ExportLinkRecord | null {
  for (const l of ix.byEvent.get(calKey(e, e.eventId)) ?? []) if (sameOccurrence(l.occurrenceKey, e.occurrenceKey)) return l;
  const m = validMeta(e.appMeta);
  if (!m) return null;
  return ix.byOp.get(m.opId) ?? ix.bySession.get(m.sessionId) ?? null;
}

export function findExportLink(e: ExternalEvent, links: readonly ExportLinkRecord[]): ExportLinkRecord | null {
  return lookupExportLink(e, indexExportLinks(links));
}

interface OwnExport {
  /** The local session still exists. */
  live: boolean;
  sessionId: ID | null;
  linkedOnly: boolean;
}

function ownExportOf(e: ExternalEvent, link: ExportLinkRecord | null, sessionIds: ReadonlySet<string>): OwnExport | null {
  const m = validMeta(e.appMeta);
  if (m && sessionIds.has(m.sessionId)) return { live: true, sessionId: m.sessionId, linkedOnly: false };
  if (link) {
    // export_links.session_id is set to NULL when the session is deleted, so non-null means it exists.
    if (link.sessionId != null) return { live: true, sessionId: link.sessionId, linkedOnly: !m };
    return { live: false, sessionId: null, linkedOnly: !m };
  }
  return null;
}

function startEpoch(date: LocalDate, timing: Timing): number | null {
  if (!timing.start || !isValidTimeZone(timing.timeZone) || !isLocalDate(date)) return null;
  return zonedToEpoch(date, timing.start, timing.timeZone).epochMs;
}

/** Possible-match window between start times. */
export const POSSIBLE_MATCH_WINDOW_MIN = 30;

interface PossibleMatch {
  session: Session;
  kind: 'close' | 'overlap' | 'no_clock';
  minutes: number | null;
}

/** End instant of a known recorded span (interval, start + declared duration); null otherwise. */
function endEpoch(start: number | null, timing: Timing): number | null {
  if (start == null || (timing.state !== 'interval' && timing.state !== 'start_duration')) return null;
  return timing.durationSec != null && timing.durationSec > 0 ? start + timing.durationSec * 1000 : null;
}

/**
 * Heuristic match against local sessions of the target activity on the same date:
 * a candidate matches when either side has no clock time (cannot tell them apart),
 * both starts are within 30 minutes, or the recorded times overlap (one activity
 * cannot happen twice at once). Never by date alone when times clearly differ.
 */
function possibleMatchOf(date: LocalDate, timing: Timing, candidates: readonly Session[]): PossibleMatch | null {
  const ev = startEpoch(date, timing);
  const evEnd = endEpoch(ev, timing);
  let close: PossibleMatch | null = null;
  let overlap: PossibleMatch | null = null;
  let noClock: PossibleMatch | null = null;
  for (const s of candidates) {
    const ls = startEpoch(s.date, s.timing);
    if (ev == null || ls == null) {
      noClock ??= { session: s, kind: 'no_clock', minutes: null };
      continue;
    }
    const minutes = Math.round(Math.abs(ev - ls) / 60000);
    if (minutes <= POSSIBLE_MATCH_WINDOW_MIN) {
      if (!close || minutes < close.minutes!) close = { session: s, kind: 'close', minutes };
      continue;
    }
    // A point (start only) overlaps a span when it falls inside it; two spans when they intersect.
    const lsEnd = endEpoch(ls, s.timing);
    const overlaps = (evEnd != null && ls >= ev && ls < evEnd) || (lsEnd != null && ev >= ls && ev < lsEnd);
    if (overlaps) overlap ??= { session: s, kind: 'overlap', minutes };
  }
  return close ?? overlap ?? noClock;
}

// ─── review ──────────────────────────────────────────────────────────────────

type Classification = Pick<ReviewItem, 'status' | 'reason' | 'selectable' | 'selectedByDefault' | 'matchedSessionId'>;

/** Build the review list for the events returned by the provider. Only matching events are listed. */
export function buildReview(input: BuildReviewInput): ReviewItem[] {
  const ctx: MatchContext = { labelsSupported: input.capabilities.eventLabels, deviceTimeZone: input.deviceTimeZone };
  const sessionIds = new Set(input.localSessions.map((s) => s.id));
  const targetByDate = new Map<LocalDate, Session[]>();
  for (const s of input.localSessions) {
    if (s.categoryId !== input.category.id) continue;
    const arr = targetByDate.get(s.date);
    if (arr) arr.push(s);
    else targetByDate.set(s.date, [s]);
  }

  const provIx = indexProvenance(input.provenance);
  const linkIx = indexExportLinks(input.exportLinks);
  const seen = new Set<string>();
  const out: (ReviewItem & { sortKey: number })[] = [];
  for (const e of input.events) {
    if (!matchEvent(e, input.filters, ctx)) continue;
    const key = eventKey(e);
    if (seen.has(key)) continue;
    seen.add(key);

    const link = lookupExportLink(e, linkIx);
    const trusted = trustedTimingOf(e, link);
    const mapping = mapEventTiming(e, input.deviceTimeZone, trusted);
    if (!mapping) continue;
    const own = ownExportOf(e, link, sessionIds);
    // Serie metadata but no local trace (exported from another install): timing restored, status decided below.
    if (trusted?.source === 'app_meta' && !own && !trusted.schedulingPlaceholder) mapping.timingNote = IMPORT_STRINGS.noteRestoredForeign;

    const rawNotes = notesFromEvent(e.notes);
    const place = placeFromEvent(e.location, rawNotes);
    const notes = trusted ? stripExportLines(rawNotes, trusted, place) : rawNotes;
    const c = classify(e, mapping, input, provIx, own, targetByDate.get(mapping.date) ?? []);
    out.push({
      key,
      event: e,
      ...c,
      statusLabel: IMPORT_STRINGS.status[c.status],
      proposed: {
        date: mapping.date,
        timing: mapping.timing,
        timeLabel: timeLabelOf(mapping.timing),
        durationLabel: durationLabelOf(mapping.timing),
        notes,
        place,
        originalTitle: e.title,
        mappingNote: mapping.mappingNote,
        timingNote: mapping.timingNote,
        timingSource: mapping.source,
        provenance: mapping.span,
      },
      sourceLabel: sourceLabelOf(e, input.calendars),
      sourceWhen: mapping.sourceWhen,
      notesPreview: notesPreview(notes),
      destinationLabel: input.category.name,
      sortKey: startEpoch(mapping.date, mapping.timing) ?? Date.parse(`${mapping.date}T00:00:00Z`),
    });
  }
  out.sort((a, b) => compareDates(a.proposed.date, b.proposed.date) || a.sortKey - b.sortKey || a.event.title.localeCompare(b.event.title) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  // One event can be listed from several selected calendars of the same account (e.g. a Google
  // event in a shared calendar and in the attendee's own calendar keeps one id). Only the first
  // copy keeps its default; later copies need an explicit choice instead of a silent second import.
  const firstCopy = new Map<string, ReviewItem>();
  for (const item of out) {
    const e = item.event;
    if (item.status === 'cancelled') continue; // a cancelled copy is excluded, not a reason to doubt a live one
    const identity = `${e.provider}:${e.accountId}:${e.eventId}:${e.occurrenceKey ?? ''}`;
    const first = firstCopy.get(identity);
    if (!first) {
      firstCopy.set(identity, item);
      continue;
    }
    if (item.status !== 'new') continue;
    item.status = 'possible_match';
    item.statusLabel = IMPORT_STRINGS.status.possible_match;
    item.reason = IMPORT_STRINGS.reasonSameEventOtherCalendar(first.sourceLabel);
    item.selectedByDefault = false;
  }
  return out.map(({ sortKey: _s, ...item }) => item);
}

function classify(e: ExternalEvent, mapping: TimingMapping, input: BuildReviewInput, provIx: ProvenanceIndex, own: OwnExport | null, sameDate: readonly Session[]): Classification {
  const S = IMPORT_STRINGS;
  if (e.status === 'cancelled') return { status: 'cancelled', reason: S.reasonCancelled, selectable: false, selectedByDefault: false, matchedSessionId: null };
  const prov = lookupProvenance(e, provIx);
  if (prov?.sessionId) return { status: 'already_imported', reason: S.reasonAlreadyImported, selectable: false, selectedByDefault: false, matchedSessionId: prov.sessionId };
  if (own?.live) {
    return { status: 'own_export', reason: own.linkedOnly ? S.reasonLinked : S.reasonOwnExport, selectable: false, selectedByDefault: false, matchedSessionId: own.sessionId };
  }
  if (prov) return { status: 'imported_then_deleted', reason: S.reasonImportedThenDeleted, selectable: true, selectedByDefault: false, matchedSessionId: null };
  if (own) return { status: 'own_export', reason: S.reasonOwnExportDeleted, selectable: true, selectedByDefault: false, matchedSessionId: null };
  const pm = possibleMatchOf(mapping.date, mapping.timing, sameDate);
  if (pm) {
    const date = formatDateIt(mapping.date);
    const localTime = timeLabelOf(pm.session.timing);
    const reason =
      pm.kind === 'no_clock' || pm.minutes == null || !pm.session.timing.start
        ? S.reasonPossibleNoClock(input.category.name, date)
        : pm.kind === 'overlap'
          ? S.reasonPossibleOverlap(input.category.name, date, localTime ?? pm.session.timing.start)
          : S.reasonPossibleClose(input.category.name, date, pm.session.timing.start, pm.minutes);
    return { status: 'possible_match', reason, selectable: true, selectedByDefault: false, matchedSessionId: pm.session.id };
  }
  return { status: 'new', reason: S.reasonNew, selectable: true, selectedByDefault: true, matchedSessionId: null };
}

// ─── selection ───────────────────────────────────────────────────────────────

/** Selected review keys. Treated as immutable: helpers return a new set. */
export type ImportSelection = ReadonlySet<string>;
export type ReviewScope = (item: ReviewItem) => boolean;

export const scopeAll: ReviewScope = () => true;
export const scopeStatus = (...statuses: ImportStatus[]): ReviewScope => (i) => statuses.includes(i.status);
export const scopeKeys = (keys: Iterable<string>): ReviewScope => {
  const set = new Set(keys);
  return (i) => set.has(i.key);
};

export function defaultSelection(items: readonly ReviewItem[]): Set<string> {
  return new Set(items.filter((i) => i.selectable && i.selectedByDefault).map((i) => i.key));
}

export function setSelected(items: readonly ReviewItem[], selection: ImportSelection, key: string, selected: boolean): Set<string> {
  const next = new Set(selection);
  const item = items.find((i) => i.key === key);
  if (!item || !item.selectable) {
    next.delete(key);
    return next;
  }
  if (selected) next.add(key);
  else next.delete(key);
  return next;
}

export function toggleSelected(items: readonly ReviewItem[], selection: ImportSelection, key: string): Set<string> {
  return setSelected(items, selection, key, !selection.has(key));
}

/** Select every selectable item in the explicit scope; choices outside the scope are kept. */
export function selectAll(items: readonly ReviewItem[], selection: ImportSelection, scope: ReviewScope = scopeAll): Set<string> {
  const next = new Set(selection);
  for (const i of items) if (i.selectable && scope(i)) next.add(i.key);
  return next;
}

/** Deselect every item in the explicit scope; choices outside the scope are kept. */
export function deselectAll(items: readonly ReviewItem[], selection: ImportSelection, scope: ReviewScope = scopeAll): Set<string> {
  const next = new Set(selection);
  for (const i of items) if (scope(i)) next.delete(i.key);
  return next;
}

export interface SelectionCounts {
  selected: number;
  selectable: number;
  total: number;
}

/** Accurate counts (stale or non-selectable keys never count). */
export function selectionCounts(items: readonly ReviewItem[], selection: ImportSelection, scope: ReviewScope = scopeAll): SelectionCounts {
  let selected = 0, selectable = 0, total = 0;
  for (const i of items) {
    if (!scope(i)) continue;
    total++;
    if (!i.selectable) continue;
    selectable++;
    if (selection.has(i.key)) selected++;
  }
  return { selected, selectable, total };
}

export function selectedItems(items: readonly ReviewItem[], selection: ImportSelection): ReviewItem[] {
  return items.filter((i) => i.selectable && selection.has(i.key));
}

/**
 * Keep the user's choices when the review is rebuilt (e.g. after a refresh):
 * items seen before with the same status keep their selection state; new items
 * and items whose status changed get their default; non-selectable items drop out.
 */
export function reconcileSelection(prevItems: readonly ReviewItem[], prevSelection: ImportSelection, nextItems: readonly ReviewItem[]): Set<string> {
  const before = new Map(prevItems.filter((i) => i.selectable).map((i) => [i.key, i.status] as const));
  const next = new Set<string>();
  for (const i of nextItems) {
    if (!i.selectable) continue;
    // A changed status (e.g. new → possible match) needs a fresh look: it gets its new default.
    const keep = before.get(i.key) === i.status;
    if (keep ? prevSelection.has(i.key) : i.selectedByDefault) next.add(i.key);
  }
  return next;
}

// ─── commit ──────────────────────────────────────────────────────────────────

export interface CommitImportInput {
  category: Pick<Category, 'id'>;
  /** The selected review items. Non-selectable items are skipped, never imported. */
  items: readonly ReviewItem[];
  /** One id per confirmed import; a retried commit must reuse it. */
  batchId: string;
  /** ISO instant used for createdAt / importedAt. */
  now: string;
  /** Session id generator (platform/ids `newId`). */
  newId: () => string;
}

export type CommitSkipReason = 'not_selectable' | 'duplicate_item' | 'already_imported' | 'own_export';

export interface CommitImportResult {
  /** Sessions created by this call, as stored. */
  sessions: Session[];
  skipped: { key: string; reason: CommitSkipReason }[];
}

/**
 * One lock per database: the provenance re-check and the write transaction of
 * an import run as one unit relative to any other import, so two overlapping
 * commits (even with different batch ids) cannot both pass the re-check.
 */
const commitLocks = new WeakMap<object, Mutex>();
function commitLock(repos: Repositories): Mutex {
  let m = commitLocks.get(repos.db);
  if (!m) {
    m = new Mutex();
    commitLocks.set(repos.db, m);
  }
  return m;
}

/**
 * Create sessions + provenance for the selected items in ONE transaction.
 * Idempotent: the provenance table is re-read first (a retried or repeated commit
 * skips occurrences that already have a live session), and each session carries a
 * deterministic save request id (batch × occurrence) so a re-delivered batch hits
 * the unique index instead of duplicating. Re-check + transaction are serialized
 * per database, so overlapping commits with different batch ids cannot both create.
 */
export function commitImport(repos: Repositories, input: CommitImportInput): Promise<CommitImportResult> {
  return commitLock(repos).lock(() => commitImportLocked(repos, input));
}

async function commitImportLocked(repos: Repositories, input: CommitImportInput): Promise<CommitImportResult> {
  if (!input.batchId) throw new DomainError('batch_id_required');
  const category = await repos.categories.get(input.category.id);
  if (!category) throw new DomainError('category_missing');

  const skipped: CommitImportResult['skipped'] = [];
  const unique: ReviewItem[] = [];
  const seen = new Set<string>();
  for (const item of input.items) {
    if (seen.has(item.key)) {
      skipped.push({ key: item.key, reason: 'duplicate_item' });
      continue;
    }
    seen.add(item.key);
    if (!item.selectable || item.status === 'cancelled' || item.event.status === 'cancelled') {
      skipped.push({ key: item.key, reason: 'not_selectable' });
      continue;
    }
    if (!isLocalDate(item.proposed.date)) throw new DomainError('invalid_date', item.proposed.date);
    unique.push(item);
  }

  // Fresh state: provenance and export links may have changed since the review was built.
  const byConnection = new Map<string, { provider: ProviderKind; accountId: string; calendarIds: Set<string> }>();
  for (const i of unique) {
    const k = `${i.event.provider}:${i.event.accountId}`;
    const g = byConnection.get(k) ?? { provider: i.event.provider, accountId: i.event.accountId, calendarIds: new Set<string>() };
    g.calendarIds.add(i.event.calendarId);
    byConnection.set(k, g);
  }
  const provenance: ProvenanceRecord[] = [];
  for (const g of byConnection.values()) provenance.push(...(await repos.provenance.listForCalendars(g.provider, g.accountId, [...g.calendarIds])));
  const linkIx = indexExportLinks(unique.length ? await repos.exportLinks.all() : []);
  const provIx = indexProvenance(provenance);

  const toCreate: { item: ReviewItem; session: Session }[] = [];
  for (const item of unique) {
    const e = item.event;
    if (lookupProvenance(e, provIx)?.sessionId) {
      skipped.push({ key: item.key, reason: 'already_imported' });
      continue;
    }
    const meta = validMeta(e.appMeta);
    const link = lookupExportLink(e, linkIx);
    if (link?.sessionId != null || (meta && (await repos.sessions.get(meta.sessionId)))) {
      skipped.push({ key: item.key, reason: 'own_export' });
      continue;
    }
    toCreate.push({
      item,
      session: {
        id: input.newId(),
        categoryId: category.id,
        date: item.proposed.date,
        timing: item.proposed.timing,
        place: item.proposed.place,
        notes: item.proposed.notes,
        origin: 'import',
        saveRequestId: importRequestId(input.batchId, item.key),
        createdAt: input.now,
        updatedAt: input.now,
      },
    });
  }

  if (!toCreate.length) return { sessions: [], skipped };
  const createdIds = await repos.db.transaction(async (tx) => {
    const ids: string[] = [];
    for (const { item, session } of toCreate) {
      const n = await repos.sessions.insertMany(tx, [session]);
      if (n !== 1) {
        // Same batch × occurrence already stored (re-delivered commit): its provenance was written with it.
        skipped.push({ key: item.key, reason: 'already_imported' });
        continue;
      }
      const e = item.event;
      await repos.provenance.insert(tx, {
        sessionId: session.id,
        provider: e.provider,
        accountId: e.accountId,
        calendarId: e.calendarId,
        externalEventId: e.eventId,
        recurringEventId: e.recurringEventId,
        occurrenceKey: e.occurrenceKey,
        originalTitle: item.proposed.originalTitle,
        sourceAllDay: item.proposed.provenance.allDay,
        sourceStart: item.proposed.provenance.start,
        sourceEnd: item.proposed.provenance.end,
        importBatchId: input.batchId,
        importedAt: input.now,
      });
      ids.push(session.id);
    }
    return ids;
  });

  if (!createdIds.length) return { sessions: [], skipped };
  const stored = new Map((await repos.sessions.listByCategory(category.id)).map((s) => [s.id, s]));
  return { sessions: createdIds.map((id) => stored.get(id)).filter((s): s is Session => !!s), skipped };
}
