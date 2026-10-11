/**
 * Pure helpers shared by the session editor and the selection-details sheet:
 * date entry, date labels, and conversion of form state into repository
 * inputs (SessionPatch / SessionDetailsDraft). Unit-tested.
 */
import type { ID, LocalDate, Place, Session, SessionDetailsDraft, Timing } from '@/domain/types';
import { addDays, compareDates, diffDays, isLocalDate, parseDate, todayIn, weekdayMon0 } from '@/domain/dates';
import { DATE_ONLY } from '@/domain/timing';
import { epochToZoned, isValidTimeZone } from '@/domain/zoned';
import type { SessionPatch } from '@/data/repositories';
import { MONTHS, MONTHS_SHORT, WEEKDAYS, t } from '@/i18n/it';
import { compactPlace, samePlace } from './placeForm';
import { sameTiming } from './timingForm';

// ─── dates ───────────────────────────────────────────────────────────────────

export type DateCheck = { ok: true; date: LocalDate } | { ok: false; error: 'format' | 'future' };

/** A session date typed as AAAA-MM-GG; future dates cannot be logged. */
export function checkSessionDate(raw: string, today: LocalDate): DateCheck {
  const v = raw.trim();
  if (!isLocalDate(v)) return { ok: false, error: 'format' };
  if (compareDates(v, today) > 0) return { ok: false, error: 'future' };
  return { ok: true, date: v };
}

/** ±1 day, never past today. */
export function shiftDate(d: LocalDate, n: number, today: LocalDate): LocalDate {
  const x = addDays(d, n);
  return compareDates(x, today) > 0 ? today : x;
}

/** "sabato 10 ottobre 2026" */
export function longDate(d: LocalDate): string {
  const p = parseDate(d);
  return `${WEEKDAYS[weekdayMon0(d)]} ${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
}

/** "10 OTT 2026" */
export function shortDate(d: LocalDate): string {
  const p = parseDate(d);
  return `${p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y}`;
}

/** Compact list of selected dates: "28, 30 SET · 3, 6 OTT" (or a count when long). */
export function datesSummary(dates: LocalDate[], max = 8): string {
  const sorted = [...dates].sort();
  if (!sorted.length) return '';
  if (sorted.length > max) return t.sessionSheets.datesCount(sorted.length);
  const groups: { key: string; label: string; days: number[] }[] = [];
  for (const d of sorted) {
    const p = parseDate(d);
    const key = `${p.y}-${p.m}`;
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: MONTHS_SHORT[p.m - 1], days: [] };
      groups.push(g);
    }
    g.days.push(p.d);
  }
  return groups.map((g) => `${g.days.join(', ')} ${g.label}`).join(' · ');
}

/** Calendar date of an instant in a zone (for "importata il …"). */
export function instantDate(iso: string, zone: string): LocalDate | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  try {
    return todayIn(zone, new Date(ms));
  } catch {
    return null;
  }
}

/**
 * The imported event's original span, for the provenance line. Stored as dates
 * (exclusive end) for all-day events and as UTC instants for timed ones; timed
 * spans are shown in the given zone, never as raw UTC.
 */
export function provenanceSpanText(span: { allDay: boolean; start: string; end: string }, zone: string): string {
  if (span.allDay) {
    if (!isLocalDate(span.start)) return span.start;
    const last = isLocalDate(span.end) && compareDates(span.end, span.start) > 0 ? addDays(span.end, -1) : span.start;
    if (last === span.start) return t.sessionSheets.provenanceAllDay(shortDate(span.start));
    return t.sessionSheets.provenanceAllDayRange(shortDate(span.start), shortDate(last), diffDays(last, span.start) + 1);
  }
  const tz = isValidTimeZone(zone) ? zone : 'UTC';
  const a = Date.parse(span.start);
  const b = Date.parse(span.end);
  if (!Number.isFinite(a)) return isLocalDate(span.start) ? shortDate(span.start) : span.start;
  const s = epochToZoned(a, tz);
  const from = `${shortDate(s.date)}, ${s.time}`;
  if (!Number.isFinite(b)) return from;
  const e = epochToZoned(b, tz);
  const to = e.date === s.date ? e.time : `${shortDate(e.date)}, ${e.time}`;
  return t.sessionSheets.provenanceTimed(from, to, tz);
}

// ─── repository inputs ───────────────────────────────────────────────────────

const cleanNotes = (s: string) => {
  const v = s.trim();
  return v.length ? v : null;
};

export interface SessionEdits {
  date: LocalDate;
  categoryId: ID;
  notes: string;
  place: Place | null;
  timing: Timing;
}

/** Only the fields that changed; clearing (notes → null, place → null, timing → date only) is a change. */
export function buildSessionPatch(cur: Session, next: SessionEdits): SessionPatch {
  const patch: SessionPatch = {};
  if (next.date !== cur.date) patch.date = next.date;
  if (next.categoryId !== cur.categoryId) patch.categoryId = next.categoryId;
  const notes = cleanNotes(next.notes);
  if (notes !== (cur.notes ?? null)) patch.notes = notes;
  if (!samePlace(next.place, cur.place)) patch.place = compactPlace(next.place);
  // A date change re-derives timing in the repository; send timing whenever it differs or the date moved.
  if (!sameTiming(next.timing, cur.timing) || patch.date) patch.timing = next.timing;
  return patch;
}

export const isEmptyPatch = (p: SessionPatch) => Object.keys(p).length === 0;

/** Details for the current selection; null when the user entered nothing (nothing to apply). */
export function buildDetailsDraft(input: { notes: string; place: Place | null; timing: Timing | null }): SessionDetailsDraft | null {
  const notes = cleanNotes(input.notes);
  const place = compactPlace(input.place);
  const timing = input.timing && input.timing.state !== 'date_only' ? input.timing : null;
  if (!notes && !place && !timing) return null;
  return { notes, place, timing: timing ?? { ...DATE_ONLY } };
}
