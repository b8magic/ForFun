import { buildDetailsDraft, buildSessionPatch, checkSessionDate, datesSummary, isEmptyPatch, longDate, provenanceSpanText, shiftDate } from '../drafts';
import { compactPlace, formatCoords, placeStatus, samePlace, withManualPin, emptyPlace } from '../placeForm';
import { buildTiming, DATE_ONLY } from '@/domain/timing';
import type { Place, Session } from '@/domain/types';
import { t } from '@/i18n/it';

const session = (p: Partial<Session> = {}): Session => ({
  id: 's1',
  categoryId: 'c1',
  date: '2026-10-10',
  timing: { ...DATE_ONLY },
  place: null,
  notes: null,
  origin: 'manual',
  saveRequestId: 'r1',
  createdAt: '2026-10-10T10:00:00.000Z',
  updatedAt: '2026-10-10T10:00:00.000Z',
  ...p,
});

describe('session date entry', () => {
  it('accepts valid past dates and today', () => {
    expect(checkSessionDate('2026-10-09', '2026-10-11')).toEqual({ ok: true, date: '2026-10-09' });
    expect(checkSessionDate(' 2026-10-11 ', '2026-10-11')).toEqual({ ok: true, date: '2026-10-11' });
  });
  it('refuses future dates and malformed text', () => {
    expect(checkSessionDate('2026-10-12', '2026-10-11')).toEqual({ ok: false, error: 'future' });
    expect(checkSessionDate('2026-02-30', '2026-10-11')).toEqual({ ok: false, error: 'format' });
    expect(checkSessionDate('10/10/2026', '2026-10-11')).toEqual({ ok: false, error: 'format' });
  });
  it('steps by one day and never past today', () => {
    expect(shiftDate('2026-10-01', -1, '2026-10-11')).toBe('2026-09-30');
    expect(shiftDate('2026-10-11', 1, '2026-10-11')).toBe('2026-10-11');
  });
  it('formats in Italian', () => {
    expect(longDate('2026-10-10')).toBe('sabato 10 ottobre 2026');
    expect(datesSummary(['2026-10-06', '2026-09-28', '2026-10-03', '2026-09-30'])).toBe('28, 30 SET · 3, 6 OTT');
    expect(datesSummary(Array.from({ length: 9 }, (_, i) => `2026-10-0${i + 1}`))).toBe('9 DATE');
  });
});

describe('buildSessionPatch', () => {
  const tm = (() => {
    const r = buildTiming('2026-10-10', { state: 'duration_only', declaredSec: 3600 });
    if (!r.ok) throw new Error();
    return r.timing;
  })();

  it('is empty when nothing changed', () => {
    const s = session({ notes: 'onde', timing: tm });
    expect(isEmptyPatch(buildSessionPatch(s, { date: s.date, categoryId: s.categoryId, notes: ' onde ', place: null, timing: tm }))).toBe(true);
  });
  it('clears notes, place and timing explicitly', () => {
    const place: Place = { ...emptyPlace(), label: 'La Fuente' };
    const s = session({ notes: 'onde', place, timing: tm });
    expect(buildSessionPatch(s, { date: s.date, categoryId: s.categoryId, notes: '   ', place: null, timing: { ...DATE_ONLY } })).toEqual({ notes: null, place: null, timing: DATE_ONLY });
  });
  it('carries date and activity moves, with timing re-derived for the new date', () => {
    const s = session({ timing: tm });
    expect(buildSessionPatch(s, { date: '2026-10-09', categoryId: 'c2', notes: '', place: null, timing: tm })).toEqual({ date: '2026-10-09', categoryId: 'c2', timing: tm });
  });
});

describe('buildDetailsDraft', () => {
  it('is null when nothing was entered (never stores empty details)', () => {
    expect(buildDetailsDraft({ notes: '  ', place: emptyPlace(), timing: { ...DATE_ONLY } })).toBeNull();
  });
  it('keeps each provided detail independently', () => {
    const r = buildTiming('2026-10-10', { state: 'duration_only', declaredSec: 5400 });
    if (!r.ok) throw new Error();
    expect(buildDetailsDraft({ notes: '', place: null, timing: r.timing })).toEqual({ notes: null, place: null, timing: r.timing });
    expect(buildDetailsDraft({ notes: ' vento ', place: null, timing: null })).toEqual({ notes: 'vento', place: null, timing: DATE_ONLY });
  });
});

describe('place helpers', () => {
  it('collapses an empty place to null and trims text', () => {
    expect(compactPlace({ ...emptyPlace(), label: '  ' })).toBeNull();
    expect(compactPlace({ ...emptyPlace(), label: ' La Fuente ' })?.label).toBe('La Fuente');
  });
  it('a manual pin keeps the original link verbatim', () => {
    const p = withManualPin({ ...emptyPlace(), mapUrl: 'https://maps.app.goo.gl/abc', resolution: 'unresolved' }, { lat: 43.4621, lng: -3.81 });
    expect(p).toMatchObject({ mapUrl: 'https://maps.app.goo.gl/abc', resolution: 'manual', coords: { lat: 43.4621, lng: -3.81 } });
  });
  it('formats coordinates with explicit hemispheres', () => {
    expect(formatCoords({ lat: 43.4621, lng: -3.81 })).toBe('43,46210 N · 3,81000 O');
  });
  it('maps every resolution to its status line', () => {
    expect(placeStatus('resolved')?.text).toBe(t.mapResolved);
    expect(placeStatus('manual')?.text).toBe(t.mapManual);
    expect(placeStatus('pending')?.text).toBe(t.mapPending);
    expect(placeStatus('unresolved')?.text).toBe(t.mapUnresolved);
    expect(placeStatus('unsupported')?.text).toBe(t.mapUnsupported);
    expect(placeStatus('none')).toBeNull();
  });
  it('compares places by content', () => {
    expect(samePlace(null, { ...emptyPlace(), address: ' ' })).toBe(true);
    expect(samePlace({ ...emptyPlace(), label: 'A' }, { ...emptyPlace(), label: 'B' })).toBe(false);
  });
});

describe('provenance span (imported event, display only)', () => {
  it('shows timed spans in the device zone, never as raw UTC', () => {
    // 05:30Z–07:00Z on 3 Oct 2026 is 07:30–09:00 in Rome (CEST, +2)
    expect(provenanceSpanText({ allDay: false, start: '2026-10-03T05:30:00.000Z', end: '2026-10-03T07:00:00.000Z' }, 'Europe/Rome')).toBe('3 OTT 2026, 07:30 → 09:00 (ora di Europe/Rome)');
  });
  it('names the end date when the span crosses midnight locally', () => {
    expect(provenanceSpanText({ allDay: false, start: '2026-10-03T21:30:00.000Z', end: '2026-10-03T23:00:00.000Z' }, 'Europe/Rome')).toBe('3 OTT 2026, 23:30 → 4 OTT 2026, 01:00 (ora di Europe/Rome)');
  });
  it('reads all-day ends as exclusive and keeps multi-day spans visible', () => {
    expect(provenanceSpanText({ allDay: true, start: '2026-10-03', end: '2026-10-04' }, 'Europe/Rome')).toBe(t.sessionSheets.provenanceAllDay('3 OTT 2026'));
    expect(provenanceSpanText({ allDay: true, start: '2026-10-03', end: '2026-10-06' }, 'Europe/Rome')).toBe(t.sessionSheets.provenanceAllDayRange('3 OTT 2026', '5 OTT 2026', 3));
  });
  it('falls back to readable text for malformed records and zones', () => {
    expect(provenanceSpanText({ allDay: false, start: 'boh', end: 'boh' }, 'Europe/Rome')).toBe('boh');
    expect(provenanceSpanText({ allDay: false, start: '2026-10-03T05:30:00.000Z', end: 'x' }, 'Not/AZone')).toBe('3 OTT 2026, 05:30');
  });
});
