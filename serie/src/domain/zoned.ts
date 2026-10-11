/**
 * Wall-clock time in an IANA zone ⇄ UTC instants, DST-correct, using only Intl.
 *
 * A wall time can be ambiguous (falls back: occurs twice) or nonexistent
 * (springs forward: skipped). We resolve:
 *  - ambiguous  → the earlier occurrence (first pass through the hour)
 *  - nonexistent → shifted forward by the gap (e.g. 02:30 → 03:30 in Rome on spring-forward)
 * Both cases are reported so the UI can explain them.
 */
import type { LocalDate, WallTime } from './types';
import { parseDate, addDays } from './dates';

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(timeZone: string) {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    dtf(tz).format(0);
    return true;
  } catch {
    return false;
  }
}

/** Offset of the zone from UTC at a given instant, in minutes (e.g. +120 for CEST). */
export function zoneOffsetMinutes(timeZone: string, epochMs: number): number {
  const parts = dtf(timeZone).formatToParts(new Date(epochMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  let h = get('hour');
  if (h === 24) h = 0;
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), h, get('minute'), get('second'));
  return Math.round((asUTC - (epochMs - (epochMs % 1000))) / 60000);
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export function isWallTime(s: unknown): s is WallTime {
  return typeof s === 'string' && TIME_RE.test(s);
}
export function parseWallTime(s: WallTime): { h: number; m: number } {
  const r = TIME_RE.exec(s);
  if (!r) throw new Error(`Invalid wall time: ${s}`);
  return { h: +r[1], m: +r[2] };
}
export function wallTimeToMinutes(s: WallTime): number {
  const { h, m } = parseWallTime(s);
  return h * 60 + m;
}
export function minutesToWallTime(min: number): WallTime {
  const x = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
}

export interface ZonedResolution {
  epochMs: number;
  kind: 'exact' | 'ambiguous' | 'nonexistent';
}

/** Convert a wall time on a date in a zone to an instant. */
export function zonedToEpoch(date: LocalDate, time: WallTime, timeZone: string): ZonedResolution {
  const { y, m, d } = parseDate(date);
  const { h, m: mi } = parseWallTime(time);
  const naive = Date.UTC(y, m - 1, d, h, mi);
  // Candidate offsets around the naive instant (covers any DST shift ≤ 3h).
  const offsets = new Set<number>();
  for (const probe of [-36, -12, 0, 12, 36]) offsets.add(zoneOffsetMinutes(timeZone, naive + probe * 3600000));
  const hits: number[] = [];
  for (const off of offsets) {
    const cand = naive - off * 60000;
    if (zoneOffsetMinutes(timeZone, cand) === off) hits.push(cand);
  }
  hits.sort((a, b) => a - b);
  if (hits.length === 1) return { epochMs: hits[0], kind: 'exact' };
  if (hits.length > 1) return { epochMs: hits[0], kind: 'ambiguous' };
  // Nonexistent wall time (spring forward): interpret with the pre-transition
  // offset, which lands the same distance past the gap (02:30 → 03:30).
  const before = zoneOffsetMinutes(timeZone, naive - 6 * 3600000);
  return { epochMs: naive - before * 60000, kind: 'nonexistent' };
}

/**
 * Elapsed seconds of an interval given as wall times on the session date in a zone.
 * endDayOffset = 1 means the end is on the following calendar day (explicit, never assumed).
 */
export function intervalSeconds(
  date: LocalDate,
  start: WallTime,
  end: WallTime,
  endDayOffset: 0 | 1,
  timeZone: string,
): { seconds: number; startKind: ZonedResolution['kind']; endKind: ZonedResolution['kind'] } {
  const s = zonedToEpoch(date, start, timeZone);
  const e = zonedToEpoch(endDayOffset ? addDays(date, 1) : date, end, timeZone);
  return { seconds: Math.round((e.epochMs - s.epochMs) / 1000), startKind: s.kind, endKind: e.kind };
}

/** Wall time in a zone for an instant (used to derive display-only end times and to read calendar events). */
export function epochToZoned(epochMs: number, timeZone: string): { date: LocalDate; time: WallTime } {
  const parts = dtf(timeZone).formatToParts(new Date(epochMs));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const hh = get('hour') === '24' ? '00' : get('hour');
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${hh}:${get('minute')}` };
}

/** Device zone, with a safe fallback. */
export function deviceTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(tz) ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}
