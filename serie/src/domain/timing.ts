/**
 * Timing state machine.
 *
 * Builds a canonical `Timing` from user input, validates it, derives durations
 * DST-correctly, and describes what changes when switching representation.
 * Unknown duration stays `null` in every state that does not establish one.
 */
import type { LocalDate, Timing, TimingState, WallTime } from './types';
import { isWallTime, intervalSeconds, isValidTimeZone, zonedToEpoch, epochToZoned, wallTimeToMinutes } from './zoned';
import { MAX_DURATION_SEC } from './duration';

export const DATE_ONLY: Timing = Object.freeze({
  state: 'date_only',
  start: null,
  end: null,
  endDayOffset: 0,
  timeZone: null,
  declaredSec: null,
  durationSec: null,
  durationSource: null,
}) as Timing;

export type TimingInput =
  | { state: 'date_only' }
  | { state: 'start_only'; start: WallTime; timeZone: string }
  | { state: 'interval'; start: WallTime; end: WallTime; endDayOffset: 0 | 1; timeZone: string }
  | { state: 'duration_only'; declaredSec: number }
  | { state: 'start_duration'; start: WallTime; timeZone: string; declaredSec: number };

export type TimingError =
  | 'time_format'
  | 'zone_invalid'
  | 'end_before_start'
  | 'equal_times'
  | 'interval_non_positive'
  | 'duration_invalid';

export type TimingResult = { ok: true; timing: Timing; note: 'ambiguous_time' | 'nonexistent_time' | null } | { ok: false; error: TimingError; field: 'start' | 'end' | 'duration' | 'zone' };

function validDeclared(sec: unknown): sec is number {
  return typeof sec === 'number' && Number.isFinite(sec) && sec > 0 && sec <= MAX_DURATION_SEC && Number.isInteger(sec);
}

/** Build a canonical Timing for a session date. Pure; never invents values. */
export function buildTiming(date: LocalDate, input: TimingInput): TimingResult {
  switch (input.state) {
    case 'date_only':
      return { ok: true, timing: { ...DATE_ONLY }, note: null };

    case 'start_only': {
      if (!isWallTime(input.start)) return { ok: false, error: 'time_format', field: 'start' };
      if (!isValidTimeZone(input.timeZone)) return { ok: false, error: 'zone_invalid', field: 'zone' };
      const r = zonedToEpoch(date, input.start, input.timeZone);
      return {
        ok: true,
        timing: { ...DATE_ONLY, state: 'start_only', start: input.start, timeZone: input.timeZone },
        note: r.kind === 'ambiguous' ? 'ambiguous_time' : r.kind === 'nonexistent' ? 'nonexistent_time' : null,
      };
    }

    case 'interval': {
      if (!isWallTime(input.start)) return { ok: false, error: 'time_format', field: 'start' };
      if (!isWallTime(input.end)) return { ok: false, error: 'time_format', field: 'end' };
      if (!isValidTimeZone(input.timeZone)) return { ok: false, error: 'zone_invalid', field: 'zone' };
      const off = input.endDayOffset === 1 ? 1 : 0;
      const a = wallTimeToMinutes(input.start), b = wallTimeToMinutes(input.end);
      if (off === 0 && b === a) return { ok: false, error: 'equal_times', field: 'end' };
      if (off === 0 && b < a) return { ok: false, error: 'end_before_start', field: 'end' };
      const iv = intervalSeconds(date, input.start, input.end, off, input.timeZone);
      if (!(iv.seconds > 0) || iv.seconds > MAX_DURATION_SEC) return { ok: false, error: 'interval_non_positive', field: 'end' };
      const kinds = [iv.startKind, iv.endKind];
      return {
        ok: true,
        timing: {
          state: 'interval',
          start: input.start,
          end: input.end,
          endDayOffset: off,
          timeZone: input.timeZone,
          declaredSec: null,
          durationSec: iv.seconds,
          durationSource: 'interval',
        },
        note: kinds.includes('nonexistent') ? 'nonexistent_time' : kinds.includes('ambiguous') ? 'ambiguous_time' : null,
      };
    }

    case 'duration_only': {
      if (!validDeclared(input.declaredSec)) return { ok: false, error: 'duration_invalid', field: 'duration' };
      return {
        ok: true,
        timing: { ...DATE_ONLY, state: 'duration_only', declaredSec: input.declaredSec, durationSec: input.declaredSec, durationSource: 'declared' },
        note: null,
      };
    }

    case 'start_duration': {
      if (!isWallTime(input.start)) return { ok: false, error: 'time_format', field: 'start' };
      if (!isValidTimeZone(input.timeZone)) return { ok: false, error: 'zone_invalid', field: 'zone' };
      if (!validDeclared(input.declaredSec)) return { ok: false, error: 'duration_invalid', field: 'duration' };
      return {
        ok: true,
        timing: {
          ...DATE_ONLY,
          state: 'start_duration',
          start: input.start,
          timeZone: input.timeZone,
          declaredSec: input.declaredSec,
          durationSec: input.declaredSec,
          durationSource: 'declared',
        },
        note: null,
      };
    }
  }
}

/**
 * Repair/validate a timing read from storage. Any inconsistency collapses to the
 * most conservative valid state, so hidden or stale values never reach statistics.
 */
export function normalizeTiming(date: LocalDate, t: Partial<Timing> | null | undefined): Timing {
  if (!t || !t.state) return { ...DATE_ONLY };
  const zone = t.timeZone ?? '';
  let r: TimingResult;
  switch (t.state) {
    case 'start_only':
      r = buildTiming(date, { state: 'start_only', start: t.start as string, timeZone: zone });
      break;
    case 'interval':
      r = buildTiming(date, { state: 'interval', start: t.start as string, end: t.end as string, endDayOffset: t.endDayOffset === 1 ? 1 : 0, timeZone: zone });
      if (!r.ok && isWallTime(t.start) && isValidTimeZone(zone)) r = buildTiming(date, { state: 'start_only', start: t.start, timeZone: zone });
      break;
    case 'duration_only':
      r = buildTiming(date, { state: 'duration_only', declaredSec: t.declaredSec as number });
      break;
    case 'start_duration':
      r = buildTiming(date, { state: 'start_duration', start: t.start as string, timeZone: zone, declaredSec: t.declaredSec as number });
      if (!r.ok && validDeclared(t.declaredSec)) r = buildTiming(date, { state: 'duration_only', declaredSec: t.declaredSec });
      break;
    default:
      r = { ok: true, timing: { ...DATE_ONLY }, note: null };
  }
  return r.ok ? r.timing : { ...DATE_ONLY };
}

/** Removing the end of an interval returns to start-only with unknown duration. */
export function removeEnd(t: Timing): Timing {
  if (t.state !== 'interval') return t;
  return { ...DATE_ONLY, state: 'start_only', start: t.start, timeZone: t.timeZone };
}

/** Clearing all timing returns to date-only; no derived value survives. */
export function clearTiming(): Timing {
  return { ...DATE_ONLY };
}

/** End time derived from start + declared duration (display only, never stored as a fact). */
export function derivedEnd(date: LocalDate, t: Timing): { date: LocalDate; time: WallTime } | null {
  if (t.state !== 'start_duration' || !t.start || !t.timeZone || t.declaredSec == null) return null;
  const s = zonedToEpoch(date, t.start, t.timeZone);
  return epochToZoned(s.epochMs + t.declaredSec * 1000, t.timeZone);
}

export const hasKnownDuration = (t: Timing) => t.durationSec != null && t.durationSec > 0;

/** Machine-readable consequences of switching representation (UI maps them to copy). */
export type TimingChange =
  | 'drops_start'
  | 'drops_end'
  | 'drops_declared'
  | 'duration_becomes_unknown'
  | 'keeps_duration_as_declared'
  | 'duration_from_interval'
  | 'needs_start'
  | 'needs_end'
  | 'needs_duration';

export function describeSwitch(from: Timing, to: TimingState): TimingChange[] {
  if (from.state === to) return [];
  const out: TimingChange[] = [];
  const hasStart = from.start != null;
  const known = from.durationSec != null;
  const willHaveStart = to === 'start_only' || to === 'interval' || to === 'start_duration';
  if (hasStart && !willHaveStart) out.push('drops_start');
  if (from.end != null && to !== 'interval') out.push('drops_end');
  if (from.declaredSec != null && to !== 'duration_only' && to !== 'start_duration') out.push('drops_declared');
  if (!hasStart && willHaveStart) out.push('needs_start');
  if (to === 'interval') {
    out.push('needs_end');
    if (known) out.push('duration_from_interval');
  }
  if (to === 'duration_only' || to === 'start_duration') {
    if (known) out.push('keeps_duration_as_declared');
    else out.push('needs_duration');
  }
  if ((to === 'date_only' || to === 'start_only') && known) out.push('duration_becomes_unknown');
  return out;
}
