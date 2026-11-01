/**
 * Date-only arithmetic on 'YYYY-MM-DD' strings.
 * Uses UTC internally so no local timezone or DST can shift a calendar day.
 */
import type { LocalDate } from './types';

const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface YMD {
  y: number;
  m: number; // 1–12
  d: number; // 1–31
}

/** Earliest date Serie accepts for a session or a range (typos like 1026 would create centuries of empty history). */
export const EARLIEST_DATE: LocalDate = '1900-01-01';

export function isLocalDate(s: unknown): s is LocalDate {
  if (typeof s !== 'string') return false;
  const m = RE.exec(s);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function parseDate(s: LocalDate): YMD {
  const m = RE.exec(s);
  if (!m) throw new Error(`Invalid LocalDate: ${s}`);
  return { y: +m[1], m: +m[2], d: +m[3] };
}

export function formatDate(y: number, m: number, d: number): LocalDate {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** Days since 1970-01-01 for a date (proleptic Gregorian). */
export function toDayNumber(s: LocalDate): number {
  const { y, m, d } = parseDate(s);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function fromDayNumber(n: number): LocalDate {
  const dt = new Date(n * 86400000);
  return formatDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(s: LocalDate, n: number): LocalDate {
  return fromDayNumber(toDayNumber(s) + n);
}

export function diffDays(a: LocalDate, b: LocalDate): number {
  return toDayNumber(a) - toDayNumber(b);
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** ISO weekday, Monday = 0 … Sunday = 6. */
export function weekdayMon0(s: LocalDate): number {
  const dow = new Date(toDayNumber(s) * 86400000).getUTCDay(); // 0 = Sunday
  return (dow + 6) % 7;
}

/** Monday of the week containing the date. */
export function startOfWeek(s: LocalDate): LocalDate {
  return addDays(s, -weekdayMon0(s));
}

export interface MonthRef {
  y: number;
  m: number; // 1–12
}

export const monthKey = (r: MonthRef) => `${r.y}-${String(r.m).padStart(2, '0')}`;
export const monthOf = (s: LocalDate): MonthRef => {
  const { y, m } = parseDate(s);
  return { y, m };
};
export function addMonths(r: MonthRef, n: number): MonthRef {
  const idx = r.y * 12 + (r.m - 1) + n;
  return { y: Math.floor(idx / 12), m: (idx % 12 + 12) % 12 + 1 };
}
export function compareMonths(a: MonthRef, b: MonthRef): number {
  return a.y * 12 + a.m - (b.y * 12 + b.m);
}
export const firstOfMonth = (r: MonthRef): LocalDate => formatDate(r.y, r.m, 1);
export const lastOfMonth = (r: MonthRef): LocalDate => formatDate(r.y, r.m, daysInMonth(r.y, r.m));

/** Months from a to b inclusive (a ≤ b), in chronological order. */
export function monthRange(a: MonthRef, b: MonthRef): MonthRef[] {
  const out: MonthRef[] = [];
  for (let r = a; compareMonths(r, b) <= 0; r = addMonths(r, 1)) out.push(r);
  return out;
}

/**
 * Calendar grid for a month, Monday first. Each week is an array of 7 dates
 * (including the leading/trailing days of neighbouring months) so the grid
 * always reads as whole weeks.
 */
export function monthWeeks(r: MonthRef): LocalDate[][] {
  const first = firstOfMonth(r);
  const last = lastOfMonth(r);
  let cur = startOfWeek(first);
  const weeks: LocalDate[][] = [];
  while (compareDates(cur, last) <= 0) {
    const w: LocalDate[] = [];
    for (let i = 0; i < 7; i++) w.push(addDays(cur, i));
    weeks.push(w);
    cur = addDays(cur, 7);
  }
  return weeks;
}

/** Today's date in a given IANA zone (defaults to the device zone). */
export function todayIn(timeZone?: string, now: Date = new Date()): LocalDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** ISO week-year and week number (for weekly statistics). */
export function isoWeek(s: LocalDate): { year: number; week: number; key: string } {
  const n = toDayNumber(s);
  const wd = weekdayMon0(s);
  const thursday = n - wd + 3;
  const ty = new Date(thursday * 86400000).getUTCFullYear();
  const jan1 = Math.floor(Date.UTC(ty, 0, 1) / 86400000);
  const week = Math.floor((thursday - jan1) / 7) + 1;
  return { year: ty, week, key: `${ty}-W${String(week).padStart(2, '0')}` };
}
