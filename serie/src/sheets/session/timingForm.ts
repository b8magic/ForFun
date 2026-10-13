/**
 * Timing form ⇄ domain Timing, as pure functions (unit-tested).
 *
 * The editor keeps what the user typed (raw strings) and derives a canonical
 * Timing with buildTiming. Rules:
 *  - a blank field means "not provided": the timing falls back to the most
 *    specific state the filled fields support (never zero, never invented);
 *  - a filled but invalid field is an error the user can see and fix;
 *  - overnight is never inferred: only the explicit next-day flag allows an
 *    end before the start;
 *  - switching mode drops what the new mode cannot hold and preserves valid
 *    details (interval → duration prefills the declared duration, visibly).
 */
import type { LocalDate, Timing, TimingState, WallTime } from '@/domain/types';
import { buildTiming, DATE_ONLY, derivedEnd, describeSwitch, type TimingChange, type TimingError, type TimingInput } from '@/domain/timing';
import { formatDuration, MAX_DURATION_SEC, parseDurationInput, type DurationParse } from '@/domain/duration';
import { isValidTimeZone, isWallTime } from '@/domain/zoned';
import { addDays } from '@/domain/dates';
import { t } from '@/i18n/it';

const s = t.sessionSheets;

export const TIMING_MODES: TimingState[] = ['date_only', 'start_only', 'interval', 'duration_only', 'start_duration'];

export function modeLabel(m: TimingState): string {
  switch (m) {
    case 'date_only':
      return t.timingDateOnly;
    case 'start_only':
      return t.timingStart;
    case 'interval':
      return t.timingInterval;
    case 'duration_only':
      return t.timingDuration;
    case 'start_duration':
      return t.timingStartDuration;
  }
}

export const modeHasStart = (m: TimingState) => m === 'start_only' || m === 'interval' || m === 'start_duration';
export const modeHasEnd = (m: TimingState) => m === 'interval';
export const modeHasDuration = (m: TimingState) => m === 'duration_only' || m === 'start_duration';

/** What the user typed. Every field is a raw string; nothing here is trusted. */
export interface TimingForm {
  mode: TimingState;
  start: string;
  end: string;
  nextDay: boolean;
  /** Raw hours:minutes; legacy decimal input remains readable. Saved seconds survive until edited. */
  duration: string;
  /** Selected IANA zone; blank = use the device zone. */
  zone: string;
}

export function emptyTimingForm(zone: string): TimingForm {
  return { mode: 'date_only', start: '', end: '', nextDay: false, duration: '', zone };
}

/**
 * Normalise typed clock time: "7:45" "745" "0745" "7.45" "7h45" "19" → "HH:MM".
 * Returns the trimmed input unchanged when it cannot be read (validation reports it).
 */
export function normalizeTimeInput(raw: string): string {
  const v = raw.trim();
  const m = /^(\d{1,2})(?:\s*[:.,h]\s*)?(\d{2})?$/i.exec(v);
  if (!m) return v;
  const h = +m[1];
  const mi = m[2] ? +m[2] : 0;
  if (h > 23 || mi > 59) return v;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

/** Prefill hours/minutes without rounding any seconds already present in storage. */
export function durationInputFrom(sec: number): string {
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}${seconds ? `:${String(seconds).padStart(2, '0')}` : ''}`;
}

export interface DurationParts {
  hours: string;
  minutes: string;
}

/** Read both raw fields without losing blanks or partially typed invalid values. */
export function durationPartsFrom(raw: string): DurationParts {
  if (!raw.trim()) return { hours: '', minutes: '' };
  if (raw.includes(':')) {
    const [hours, minutes] = raw.split(':');
    return { hours, minutes };
  }
  const parsed = parseDurationInput(raw);
  return parsed.ok ? durationPartsFrom(durationInputFrom(parsed.seconds)) : { hours: raw, minutes: '' };
}

/** Editing either field replaces any stored sub-minute precision with the entered minutes. */
export function durationInputFromParts({ hours, minutes }: DurationParts): string {
  return !hours.trim() && !minutes.trim() ? '' : `${hours}:${minutes}`;
}

/** Hours and minutes are whole numbers; either blank part means zero, both blank means unknown. */
export function parseFormDuration(raw: string): DurationParse {
  if (!raw.includes(':')) return parseDurationInput(raw);
  const parts = raw.split(':').map((part) => part.trim());
  if (parts.length !== 2 && parts.length !== 3) return { ok: false, error: 'invalid' };
  const [hours, minutes, savedSeconds] = parts;
  if (!hours && !minutes && savedSeconds == null) return { ok: false, error: 'empty' };
  if ((hours && !/^\d+$/.test(hours)) || (minutes && !/^\d{1,2}$/.test(minutes)) || Number(minutes) > 59) return { ok: false, error: 'invalid' };
  // This third part only comes from the exact prefill; the editor exposes hours and minutes.
  if (savedSeconds != null && (!/^\d{2}$/.test(savedSeconds) || Number(savedSeconds) > 59)) return { ok: false, error: 'invalid' };
  const seconds = Number(hours) * 3600 + Number(minutes) * 60 + Number(savedSeconds ?? 0);
  if (!Number.isFinite(seconds)) return { ok: false, error: 'invalid' };
  if (seconds <= 0) return { ok: false, error: 'non_positive' };
  if (seconds > MAX_DURATION_SEC) return { ok: false, error: 'too_long' };
  return { ok: true, seconds };
}

/** Existing second precision must also remain visible in duration summaries. */
export function formatTimingDuration(sec: number): string {
  const seconds = sec % 60;
  if (!seconds) return formatDuration(sec);
  return `${sec >= 60 ? `${formatDuration(sec - seconds)} ` : ''}${seconds} s`;
}

/** Form state for an existing timing (device zone used only when the timing has none). */
export function formFromTiming(timing: Timing, fallbackZone: string): TimingForm {
  return {
    mode: timing.state,
    start: timing.start ?? '',
    end: timing.end ?? '',
    nextDay: timing.endDayOffset === 1,
    duration: timing.declaredSec != null ? durationInputFrom(timing.declaredSec) : '',
    zone: timing.timeZone ?? fallbackZone,
  };
}

export type FieldError = 'time' | 'end_before_start' | 'equal_times' | 'duration' | 'duration_too_short' | 'duration_too_long' | 'zone' | 'needs_start';
export type TimingField = 'start' | 'end' | 'duration' | 'zone';

export interface TimingEvaluation {
  ok: boolean;
  /** Canonical timing to save (null while there are errors). */
  timing: Timing | null;
  /** State that will actually be saved; differs from the chosen mode when fields are blank. */
  effective: TimingState | null;
  errors: Partial<Record<TimingField, FieldError>>;
  note: 'ambiguous_time' | 'nonexistent_time' | null;
  /** Zone used to read clock times (typed, or the device zone when blank). */
  zoneUsed: string;
}

function mapBuildError(e: TimingError): FieldError {
  switch (e) {
    case 'time_format':
      return 'time';
    case 'zone_invalid':
      return 'zone';
    case 'equal_times':
      return 'equal_times';
    case 'end_before_start':
    case 'interval_non_positive':
      return 'end_before_start';
    case 'duration_invalid':
      return 'duration';
  }
}

interface Parsed {
  start: WallTime | null;
  end: WallTime | null;
  declaredSec: number | null;
  zone: string;
  errors: Partial<Record<TimingField, FieldError>>;
}

function parseFields(form: TimingForm, fallbackZone: string): Parsed {
  const errors: Partial<Record<TimingField, FieldError>> = {};
  const mode = form.mode;
  let start: WallTime | null = null;
  let end: WallTime | null = null;
  let declaredSec: number | null = null;
  if (modeHasStart(mode) && form.start.trim()) {
    const v = normalizeTimeInput(form.start);
    if (isWallTime(v)) start = v;
    else errors.start = 'time';
  }
  if (modeHasEnd(mode) && form.end.trim()) {
    const v = normalizeTimeInput(form.end);
    if (isWallTime(v)) end = v;
    else errors.end = 'time';
  }
  if (modeHasDuration(mode) && form.duration.trim()) {
    const p = parseFormDuration(form.duration);
    if (p.ok) declaredSec = p.seconds;
    else errors.duration = p.error === 'too_long' ? 'duration_too_long' : p.error === 'too_short' ? 'duration_too_short' : 'duration';
  }
  const typedZone = form.zone.trim();
  const zone = typedZone || fallbackZone;
  const usesClock = modeHasStart(mode) && (start != null || errors.start != null);
  if (usesClock && typedZone && !isValidTimeZone(typedZone)) errors.zone = 'zone';
  if (mode === 'interval' && !form.start.trim() && (end != null || errors.end != null)) errors.start = 'needs_start';
  return { start, end, declaredSec, zone, errors };
}

/** Evaluate the form for a session date (the date matters for DST-correct durations). */
export function evaluateTiming(date: LocalDate, form: TimingForm, fallbackZone: string): TimingEvaluation {
  const p = parseFields(form, fallbackZone);
  const fail = (errors: Partial<Record<TimingField, FieldError>>): TimingEvaluation => ({ ok: false, timing: null, effective: null, errors, note: null, zoneUsed: p.zone });
  if (Object.keys(p.errors).length) return fail(p.errors);

  let input: TimingInput;
  const { start, end, declaredSec, zone } = p;
  switch (form.mode) {
    case 'date_only':
      input = { state: 'date_only' };
      break;
    case 'start_only':
      input = start ? { state: 'start_only', start, timeZone: zone } : { state: 'date_only' };
      break;
    case 'interval':
      input = start && end ? { state: 'interval', start, end, endDayOffset: form.nextDay ? 1 : 0, timeZone: zone } : start ? { state: 'start_only', start, timeZone: zone } : { state: 'date_only' };
      break;
    case 'duration_only':
      input = declaredSec != null ? { state: 'duration_only', declaredSec } : { state: 'date_only' };
      break;
    case 'start_duration':
      input =
        start && declaredSec != null
          ? { state: 'start_duration', start, timeZone: zone, declaredSec }
          : start
            ? { state: 'start_only', start, timeZone: zone }
            : declaredSec != null
              ? { state: 'duration_only', declaredSec }
              : { state: 'date_only' };
      break;
  }
  const r = buildTiming(date, input);
  if (!r.ok) return fail({ [r.field]: mapBuildError(r.error) });
  return { ok: true, timing: r.timing, effective: r.timing.state, errors: {}, note: r.note, zoneUsed: zone };
}

/**
 * Best-effort timing from whatever is valid right now, used to describe a
 * mode switch even while another field is still being typed.
 */
export function lenientTiming(date: LocalDate, form: TimingForm, fallbackZone: string): Timing {
  const ev = evaluateTiming(date, form, fallbackZone);
  if (ev.ok && ev.timing) return { ...ev.timing, state: form.mode };
  const p = parseFields(form, fallbackZone);
  return {
    ...DATE_ONLY,
    state: form.mode,
    start: p.start,
    end: p.end,
    endDayOffset: form.nextDay && p.end ? 1 : 0,
    timeZone: p.start ? p.zone : null,
    declaredSec: p.declaredSec,
    durationSec: p.declaredSec,
    durationSource: p.declaredSec != null ? 'declared' : null,
  };
}

export interface SwitchPreview {
  to: TimingState;
  changes: TimingChange[];
  /** Italian sentences, one per consequence. */
  lines: string[];
  /** True when the switch removes or reinterprets something the user entered. */
  needsConfirm: boolean;
  next: TimingForm;
  prefill: { field: 'duration' | 'end'; text: string } | null;
}

const LOSSY: TimingChange[] = ['drops_start', 'drops_end', 'drops_declared', 'duration_becomes_unknown', 'keeps_duration_as_declared', 'duration_from_interval'];

/** What switching to `to` will do, plus the resulting form (dropped fields cleared, valid details carried over). */
export function previewSwitch(date: LocalDate, form: TimingForm, to: TimingState, fallbackZone: string): SwitchPreview {
  const cur = lenientTiming(date, form, fallbackZone);
  const changes = form.mode === to ? [] : describeSwitch(cur, to);
  const next: TimingForm = { ...form, mode: to };
  if (!modeHasStart(to)) next.start = '';
  if (!modeHasEnd(to)) {
    next.end = '';
    next.nextDay = false;
  }
  if (!modeHasDuration(to)) next.duration = '';
  // Raw text the new mode keeps but that was never validated stays as typed.
  let prefill: SwitchPreview['prefill'] = null;
  if (modeHasDuration(to) && !modeHasDuration(form.mode) && cur.durationSec != null) {
    next.duration = durationInputFrom(cur.durationSec);
    prefill = { field: 'duration', text: formatTimingDuration(cur.durationSec) };
  }
  if (to === 'interval' && form.mode === 'start_duration') {
    const de = derivedEnd(date, { ...cur, state: 'start_duration' });
    if (de && (de.date === date || de.date === addDays(date, 1))) {
      next.end = de.time;
      next.nextDay = de.date !== date;
      prefill = { field: 'end', text: next.nextDay ? s.derivedNextDay(de.time) : de.time };
    }
  }
  const lines: string[] = [];
  for (const c of changes) {
    switch (c) {
      case 'drops_start':
        lines.push(s.swDropsStart(cur.start ?? ''));
        break;
      case 'drops_end':
        lines.push(s.swDropsEnd(cur.end ?? ''));
        break;
      case 'drops_declared':
        lines.push(s.swDropsDeclared(formatTimingDuration(cur.declaredSec ?? 0)));
        break;
      case 'duration_becomes_unknown':
        lines.push(s.swDurationUnknown);
        break;
      case 'keeps_duration_as_declared':
        lines.push(s.swKeepsDeclared(formatTimingDuration(cur.durationSec ?? 0)));
        break;
      case 'duration_from_interval':
        lines.push(s.swFromInterval);
        break;
      case 'needs_start':
        lines.push(s.swNeedsStart);
        break;
      case 'needs_end':
        lines.push(prefill?.field === 'end' ? s.swEndPrefilled(prefill.text) : s.swNeedsEnd);
        break;
      case 'needs_duration':
        lines.push(s.swNeedsDuration);
        break;
    }
  }
  // Confirm only when something entered is removed or reinterpreted; a declared duration staying declared is not a change.
  const needsConfirm = changes.some((c) => LOSSY.includes(c) && !(c === 'keeps_duration_as_declared' && cur.durationSource === 'declared'));
  return { to, changes, lines, needsConfirm, next, prefill };
}

export function fieldErrorCopy(e: FieldError): string {
  switch (e) {
    case 'time':
      return t.errTime;
    case 'end_before_start':
      return t.errEndBeforeStart;
    case 'equal_times':
      return t.errEqualTimes;
    case 'duration':
      return s.errDurationParts;
    case 'duration_too_long':
      return s.errDurationTooLong;
    case 'duration_too_short':
      return t.errDurationTooShort;
    case 'zone':
      return s.errZone;
    case 'needs_start':
      return s.errNeedsStart;
  }
}

/** The active duration source, stated unambiguously. */
export function durationSourceCopy(timing: Timing | null): { text: string; value: string | null; known: boolean } | null {
  if (!timing) return null;
  if (timing.durationSec != null && timing.durationSource === 'interval') return { text: t.durationFromInterval, value: formatTimingDuration(timing.durationSec), known: true };
  if (timing.durationSec != null && timing.durationSource === 'declared') return { text: t.durationDeclared, value: formatTimingDuration(timing.durationSec), known: true };
  return { text: t.durationUnknown, value: null, known: false };
}

/** Derived end for start + duration, as display text (never stored). */
export function derivedEndCopy(date: LocalDate, timing: Timing | null): string | null {
  if (!timing) return null;
  const de = derivedEnd(date, timing);
  if (!de) return null;
  const time = de.date === date ? de.time : de.date === addDays(date, 1) ? s.derivedNextDay(de.time) : `${de.time} (${de.date})`;
  return t.derivedEnd(time);
}

/** True when the form carries nothing the user typed (used for "empty details"). */
export function isTimingFormEmpty(form: TimingForm): boolean {
  return form.mode === 'date_only' || (!form.start.trim() && !form.end.trim() && !form.duration.trim());
}

/** Structural equality for dirty checks (zones compared as typed). */
export function sameTiming(a: Timing, b: Timing): boolean {
  return (
    a.state === b.state &&
    a.start === b.start &&
    a.end === b.end &&
    a.endDayOffset === b.endDayOffset &&
    (a.start ? a.timeZone === b.timeZone : true) &&
    a.declaredSec === b.declaredSec &&
    a.durationSec === b.durationSec
  );
}
