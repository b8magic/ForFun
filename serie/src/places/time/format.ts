/**
 * Turns statistics into honest Italian sentences: session counts, active
 * days and recorded hours are always distinct; known hours include coverage.
 */
import type { DurationSummary, LocalDate, PeriodSummary, Session } from '@/domain/types';
import { formatDuration } from '@/domain/duration';
import { parseDate, weekdayMon0 } from '@/domain/dates';
import { derivedEnd } from '@/domain/timing';
import { MONTHS, MONTHS_TITLE, WEEKDAYS, t } from '@/i18n/it';

export function durationLine(d: DurationSummary): string {
  if (d.totalCount === 0 || d.knownCount === 0 || !(d.knownSec > 0)) return '';
  return `${t.recorded(formatDuration(d.knownSec))} · ${t.coverage(d.knownCount, d.totalCount)}`;
}

/** Day previews show recorded time; duration coverage belongs to the statistics. */
export function compactDurationLine(d: DurationSummary): string {
  if (d.totalCount === 0 || d.knownCount === 0 || !(d.knownSec > 0)) return '';
  return formatDuration(d.knownSec);
}

export function countsLine(p: PeriodSummary): string {
  if (p.sessions === 0) return t.emptyMonth;
  return `${t.sessions(p.sessions)} · ${t.activeDays(p.activeDays)}`;
}

export const monthTitle = (y: number, m: number) => `${MONTHS_TITLE[m - 1]} ${y}`;

export function dateLabel(d: LocalDate, withYear = true): string {
  const p = parseDate(d);
  return `${WEEKDAYS[weekdayMon0(d)]} ${p.d} ${MONTHS[p.m - 1]}${withYear ? ` ${p.y}` : ''}`;
}

export function shortDate(d: LocalDate): string {
  const p = parseDate(d);
  return `${p.d} ${MONTHS[p.m - 1].slice(0, 3)} ${p.y}`;
}

/** Preserve a saved place even when it only has coordinates or a map link. */
export function placeSummary(place: Session['place']): string | null {
  if (!place) return null;
  return [place.label?.trim(), place.address?.trim()].filter(Boolean).join(' · ')
    || (place.coords ? 'Posizione salvata' : place.mapUrl?.trim() ? 'Link mappa salvato' : null);
}

/** Inline history previews keep timing and place visible before a bounded note. */
export function sessionPreview(s: Session): { timing: string; place: string | null; notes: string | null } {
  const firstLine = s.notes?.trim().split(/\r\n|\n|\r/, 1)[0].trim();
  const note = firstLine && firstLine.length > 160 ? `${firstLine.slice(0, 159).trimEnd()}…` : firstLine;
  return { timing: recordedTimingSummary(s), place: placeSummary(s.place), notes: note ? `“${note}”` : null };
}

/** Day rows show available timing values without repeating their date or missing fields. */
export function recordedTimingSummary(s: Session): string {
  const tm = s.timing;
  const duration = tm.durationSec != null && tm.durationSec > 0 ? formatDuration(tm.durationSec) : '';
  const start = tm.start ? `dalle ${tm.start}` : '';
  switch (tm.state) {
    case 'date_only':
      return '';
    case 'start_only':
      return start;
    case 'interval': {
      const times = tm.start && tm.end
        ? `${tm.start}–${tm.end}${tm.endDayOffset ? ' (+1 g)' : ''}`
        : start || (tm.end ? `fino alle ${tm.end}${tm.endDayOffset ? ' (+1 g)' : ''}` : '');
      return [times, duration].filter(Boolean).join(' · ');
    }
    case 'duration_only':
      return duration;
    case 'start_duration': {
      const e = derivedEnd(s.date, tm);
      return `${[start, duration].filter(Boolean).join(' · ')}${e ? ` (fine calcolata ${e.time})` : ''}`;
    }
  }
}

/** One-line timing summary for a session (never shows an invented value). */
export function timingSummary(s: Session): string {
  const tm = s.timing;
  switch (tm.state) {
    case 'date_only':
      return `${t.timingDateOnly} · ${t.durationNotSpecified.toLowerCase()}`;
    case 'start_only':
      return `dalle ${tm.start} · ${t.durationNotSpecified.toLowerCase()}`;
    case 'interval':
      return `${tm.start}–${tm.end}${tm.endDayOffset ? ' (+1 g)' : ''} · ${formatDuration(tm.durationSec ?? 0)}`;
    case 'duration_only':
      return `${formatDuration(tm.durationSec ?? 0)} · senza orario`;
    case 'start_duration': {
      const e = derivedEnd(s.date, tm);
      return `dalle ${tm.start} · ${formatDuration(tm.durationSec ?? 0)}${e ? ` (fine calcolata ${e.time})` : ''}`;
    }
  }
}
