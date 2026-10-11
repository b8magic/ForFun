import { testRepos } from '@/test/sqljs';
import { mkSession } from '@/test/factories';
import { bootstrap } from '@/data/bootstrap';
import { DomainError, type ExportLinkRecord, type ProvenanceRecord } from '@/data/repositories';
import { buildTiming } from '@/domain/timing';
import { zonedToEpoch } from '@/domain/zoned';
import { summarize } from '@/domain/stats';
import type { Category, Timing } from '@/domain/types';
import type { AppEventMeta, ExternalCalendar, ExternalEvent } from '../types';
import {
  IMPORT_STRINGS,
  findExportLink,
  findProvenance,
  buildReview,
  commitImport,
  defaultSelection,
  deselectAll,
  eventKey,
  importRequestId,
  labelFilterApplies,
  mapEventTiming,
  matchEvent,
  notesFromEvent,
  placeFromEvent,
  reconcileSelection,
  scopeStatus,
  selectAll,
  selectedItems,
  selectionCounts,
  setSelected,
  titleMatches,
  toggleSelected,
  type BuildReviewInput,
  type ImportFilters,
  type ReviewItem,
} from '../importEngine';

const TZ = 'Europe/Rome';
const ACC = 'me@example.com';
const GOOGLE = { eventLabels: true };
const APPLE = { eventLabels: false };
const CAT = { id: 'surf', name: 'Surf' };

const instant = (date: string, time: string, tz = TZ) => new Date(zonedToEpoch(date, time, tz).epochMs).toISOString();

let n = 0;
function ev(p: Partial<ExternalEvent> = {}): ExternalEvent {
  n++;
  return {
    provider: 'google',
    accountId: ACC,
    calendarId: 'cal-surf',
    eventId: `ev${n}`,
    recurringEventId: null,
    occurrenceKey: null,
    title: 'Surf',
    notes: null,
    location: null,
    allDay: true,
    start: { date: '2026-03-03', time: null, timeZone: null, instant: null },
    end: { date: '2026-03-04', time: null, timeZone: null, instant: null },
    status: 'confirmed',
    colorId: null,
    appMeta: null,
    updated: null,
    ...p,
  };
}
const allDay = (start: string, endExclusive: string, p: Partial<ExternalEvent> = {}) =>
  ev({ allDay: true, start: { date: start, time: null, timeZone: null, instant: null }, end: { date: endExclusive, time: null, timeZone: null, instant: null }, ...p });
function timed(date: string, start: string, endDate: string, end: string, p: Partial<ExternalEvent> = {}, tz = TZ, endTz = tz): ExternalEvent {
  return ev({
    allDay: false,
    start: { date, time: start, timeZone: tz, instant: instant(date, start, tz) },
    end: { date: endDate, time: end, timeZone: endTz, instant: instant(endDate, end, endTz) },
    ...p,
  });
}
const meta = (p: Partial<AppEventMeta> = {}): AppEventMeta => ({
  v: 1,
  sessionId: 'sess-gone',
  opId: 'op-gone',
  timingState: 'date_only',
  durationSec: null,
  durationSource: null,
  schedulingPlaceholder: false,
  ...p,
});
const F = (p: Partial<ImportFilters> = {}): ImportFilters => ({ calendarIds: ['cal-surf'], titleContains: null, labelIds: null, from: '2026-01-01', to: '2026-12-31', ...p });
const review = (events: ExternalEvent[], p: Partial<BuildReviewInput> = {}) =>
  buildReview({ events, filters: F(), capabilities: GOOGLE, provenance: [], localSessions: [], exportLinks: [], category: CAT, deviceTimeZone: TZ, ...p });
const one = (e: ExternalEvent, p: Partial<BuildReviewInput> = {}) => {
  const items = review([e], p);
  expect(items).toHaveLength(1);
  return items[0];
};
const ctx = { labelsSupported: true, deviceTimeZone: TZ };
const timing = (date: string, input: Parameters<typeof buildTiming>[1]): Timing => {
  const r = buildTiming(date, input);
  if (!r.ok) throw new Error(r.error);
  return r.timing;
};
function link(p: Partial<ExportLinkRecord> = {}): ExportLinkRecord {
  return {
    id: 'link-1',
    sessionId: null,
    provider: 'google',
    accountId: ACC,
    calendarId: 'cal-surf',
    externalEventId: 'none',
    occurrenceKey: null,
    status: 'created',
    opId: 'op-link',
    snapshot: {
      title: 'Surf',
      notes: null,
      location: null,
      allDay: false,
      start: '2026-03-03T06:00:00.000Z',
      end: '2026-03-03T07:00:00.000Z',
      timeZone: TZ,
      timingState: 'start_only',
      durationSec: null,
      durationSource: null,
      schedulingPlaceholder: true,
      categoryName: 'Surf',
    },
    exportedAt: '2026-03-04T10:00:00.000Z',
    ...p,
  };
}
function prov(e: ExternalEvent, sessionId: string | null, p: Partial<ProvenanceRecord> = {}): ProvenanceRecord {
  return {
    id: `p-${e.eventId}`,
    sessionId,
    provider: e.provider,
    accountId: e.accountId,
    calendarId: e.calendarId,
    externalEventId: e.eventId,
    recurringEventId: e.recurringEventId,
    occurrenceKey: e.occurrenceKey,
    originalTitle: e.title,
    sourceAllDay: e.allDay,
    sourceStart: e.start.instant ?? e.start.date,
    sourceEnd: e.end.instant ?? e.end.date,
    importBatchId: 'b0',
    importedAt: '2026-01-01T00:00:00.000Z',
    ...p,
  };
}

// ─── filters ─────────────────────────────────────────────────────────────────

describe('filters', () => {
  it('title filter looks at the title only (notes/location containing "surf" do not match)', () => {
    const events = [
      ev({ title: 'Surf mattina' }),
      ev({ title: 'Corsa', notes: 'poi surf con Luca' }),
      ev({ title: 'Allenamento', location: 'Surf Club Levanto' }),
      ev({ title: 'Lezione di SURF' }),
    ];
    const items = review(events, { filters: F({ titleContains: 'surf' }) });
    expect(items.map((i) => i.event.title).sort()).toEqual(['Lezione di SURF', 'Surf mattina']);
  });

  it('is case-, accent- and whitespace-insensitive; a blank phrase is no condition', () => {
    expect(titleMatches('Sùrf   con\tamici', 'surf con amici')).toBe(true);
    expect(titleMatches('Uscita all’alba', "all'alba")).toBe(true);
    expect(titleMatches('Corsa', 'surf')).toBe(false);
    expect(titleMatches('Corsa', '   ')).toBe(true);
    expect(titleMatches('Corsa', null)).toBe(true);
  });

  it('applies calendar scope; no selected calendar means nothing matches', () => {
    const a = ev({ calendarId: 'cal-surf' });
    const b = ev({ calendarId: 'cal-work' });
    expect(review([a, b]).map((i) => i.event.eventId)).toEqual([a.eventId]);
    expect(review([a, b], { filters: F({ calendarIds: [] }) })).toHaveLength(0);
    expect(review([a, b], { filters: F({ calendarIds: ['cal-surf', 'cal-work'] }) })).toHaveLength(2);
  });

  it('combines calendar, title and label conditions (Google labels)', () => {
    const e1 = ev({ title: 'Surf', colorId: '5' });
    const e2 = ev({ title: 'Surf', colorId: '7' });
    const e3 = ev({ title: 'Corsa', colorId: '5' });
    const e4 = ev({ title: 'Surf', colorId: null });
    const e5 = ev({ title: 'Surf', colorId: '5', calendarId: 'cal-work' });
    const all = [e1, e2, e3, e4, e5];
    const ids = (f: Partial<ImportFilters>) => review(all, { filters: F(f) }).map((i) => i.event.eventId).sort();
    expect(ids({ labelIds: ['5'] })).toEqual([e1.eventId, e3.eventId].sort());
    expect(ids({ titleContains: 'surf' })).toEqual([e1.eventId, e2.eventId, e4.eventId].sort());
    expect(ids({ titleContains: 'surf', labelIds: ['5'] })).toEqual([e1.eventId]);
    expect(ids({ titleContains: 'surf', labelIds: ['5', '7'] })).toEqual([e1.eventId, e2.eventId].sort());
    expect(ids({ labelIds: [] })).toHaveLength(4); // empty label list = no label condition
  });

  it('ignores the label condition for providers without per-event labels (disclosed via labelFilterApplies)', () => {
    const a = ev({ provider: 'apple', accountId: 'icloud', colorId: null });
    const b = ev({ provider: 'apple', accountId: 'icloud', colorId: null, title: 'Corsa' });
    const f = F({ labelIds: ['5'], titleContains: 'surf' });
    expect(labelFilterApplies(f, false)).toBe(false);
    expect(labelFilterApplies(f, true)).toBe(true);
    expect(review([a, b], { filters: f, capabilities: APPLE }).map((i) => i.event.eventId)).toEqual([a.eventId]);
  });

  it('narrows to one connection when provider/account are given', () => {
    const g = ev({ provider: 'google', accountId: ACC });
    const other = ev({ provider: 'google', accountId: 'other@example.com' });
    expect(matchEvent(g, F({ provider: 'google', accountId: ACC }), ctx)).toBe(true);
    expect(matchEvent(other, F({ provider: 'google', accountId: ACC }), ctx)).toBe(false);
    expect(matchEvent(g, F({ provider: 'apple' }), ctx)).toBe(false);
  });

  it('keeps only events whose session date (start date) is inside the range', () => {
    const inside = allDay('2026-01-10', '2026-01-11');
    const before = allDay('2025-12-30', '2026-01-02'); // overlaps, but would be dated 30 Dec
    const after = timed('2027-01-01', '07:00', '2027-01-01', '08:00');
    expect(review([inside, before, after]).map((i) => i.event.eventId)).toEqual([inside.eventId]);
  });
});

// ─── timing ──────────────────────────────────────────────────────────────────

describe('timing mapping', () => {
  it('all-day → date only with unknown duration (never 24 h)', () => {
    const i = one(allDay('2026-03-03', '2026-03-04'));
    expect(i.proposed.date).toBe('2026-03-03');
    expect(i.proposed.timing.state).toBe('date_only');
    expect(i.proposed.timing.durationSec).toBeNull();
    expect(i.proposed.timing.start).toBeNull();
    expect(i.proposed.durationLabel).toBe('Durata non specificata');
    expect(i.proposed.timeLabel).toBeNull();
    expect(i.proposed.provenance).toEqual({ allDay: true, start: '2026-03-03', end: '2026-03-04' });
    expect(i.sourceWhen).toBe('3 marzo 2026 · Giornata intera');
  });

  it('multi-day all-day → one session on the start date, span kept as provenance, visible mapping', () => {
    const i = one(allDay('2026-03-03', '2026-03-06'));
    expect(i.proposed.date).toBe('2026-03-03');
    expect(i.proposed.timing.state).toBe('date_only');
    expect(i.proposed.timing.durationSec).toBeNull();
    expect(i.proposed.mappingNote).toBe('Dal 3 marzo 2026 al 5 marzo 2026 (3 giorni) → 1 sessione il 3 marzo 2026');
    expect(i.proposed.provenance).toEqual({ allDay: true, start: '2026-03-03', end: '2026-03-06' });
    expect(i.sourceWhen).toContain('Dal 3 marzo 2026 al 5 marzo 2026');
  });

  it('timed interval → known duration from the interval, visible in the preview', () => {
    const i = one(timed('2026-05-10', '07:30', '2026-05-10', '09:00'));
    expect(i.proposed.timing).toMatchObject({ state: 'interval', start: '07:30', end: '09:00', endDayOffset: 0, timeZone: TZ, durationSec: 5400, durationSource: 'interval' });
    expect(i.proposed.durationLabel).toBe('1 h 30 min');
    expect(i.proposed.timeLabel).toBe('07:30–09:00');
    expect(i.proposed.provenance).toEqual({ allDay: false, start: instant('2026-05-10', '07:30'), end: instant('2026-05-10', '09:00') });
  });

  it('overnight interval ending the next day → endDayOffset 1', () => {
    const i = one(timed('2026-05-10', '22:00', '2026-05-11', '01:30'));
    expect(i.proposed.date).toBe('2026-05-10');
    expect(i.proposed.timing).toMatchObject({ state: 'interval', endDayOffset: 1, durationSec: 3.5 * 3600 });
    expect(i.proposed.timeLabel).toBe('22:00–01:30 (+1)');
  });

  it('computes durations DST-correctly (spring forward and fall back overnight)', () => {
    const spring = one(timed('2026-03-29', '01:30', '2026-03-29', '03:30'));
    expect(spring.proposed.timing.durationSec).toBe(3600);
    const fall = one(timed('2026-10-24', '22:00', '2026-10-25', '06:00'));
    expect(fall.proposed.timing).toMatchObject({ state: 'interval', endDayOffset: 1, durationSec: 9 * 3600 });
  });

  it('never stores a wrong duration for a wall time in the repeated DST hour', () => {
    // 25 Oct 2026, Rome: 02:30 happens twice. This event starts at the SECOND 02:30 (CET) and lasts 1 h.
    const e = ev({
      allDay: false,
      start: { date: '2026-10-25', time: '02:30', timeZone: TZ, instant: '2026-10-25T01:30:00.000Z' },
      end: { date: '2026-10-25', time: '03:30', timeZone: TZ, instant: '2026-10-25T02:30:00.000Z' },
    });
    const i = one(e);
    expect(i.proposed.timing).toMatchObject({ state: 'start_only', start: '02:30', durationSec: null });
    expect(i.proposed.timingNote).toBe(IMPORT_STRINGS.noteUnrepresentable);
    // The first 02:30 (CEST) is representable and keeps its real duration.
    const first = one(ev({
      allDay: false,
      start: { date: '2026-10-25', time: '02:30', timeZone: TZ, instant: '2026-10-25T00:30:00.000Z' },
      end: { date: '2026-10-25', time: '04:00', timeZone: TZ, instant: '2026-10-25T03:00:00.000Z' },
    }));
    expect(first.proposed.timing).toMatchObject({ state: 'interval', durationSec: 2.5 * 3600 });
  });

  it('expresses an end given in another zone in the start zone', () => {
    const i = one(timed('2026-06-01', '08:00', '2026-06-01', '10:00', {}, TZ, 'Europe/London'));
    expect(i.proposed.timing).toMatchObject({ state: 'interval', start: '08:00', end: '11:00', timeZone: TZ, durationSec: 3 * 3600 });
  });

  it('zero-length timed event → start only, unknown duration', () => {
    const i = one(timed('2026-05-10', '07:30', '2026-05-10', '07:30'));
    expect(i.proposed.timing).toMatchObject({ state: 'start_only', start: '07:30', durationSec: null });
    expect(i.proposed.timingNote).toBe(IMPORT_STRINGS.noteZeroLength);
    expect(i.proposed.durationLabel).toBe('Durata non specificata');
  });

  it('timed event spanning several days → start only on the start date with a visible note', () => {
    const i = one(timed('2026-03-03', '07:00', '2026-03-05', '18:00'));
    expect(i.proposed.date).toBe('2026-03-03');
    expect(i.proposed.timing).toMatchObject({ state: 'start_only', start: '07:00', durationSec: null });
    expect(i.proposed.mappingNote).toBe('Dal 3 marzo 2026 al 5 marzo 2026 (3 giorni) → 1 sessione il 3 marzo 2026');
    expect(i.proposed.timingNote).toBe(IMPORT_STRINGS.noteMultiDayTimed('07:00'));
    expect(i.proposed.provenance.allDay).toBe(false);
  });

  it('a 24 h or longer span crossing one midnight is not an interval', () => {
    const i = one(timed('2026-03-03', '07:00', '2026-03-04', '08:00'));
    expect(i.proposed.timing).toMatchObject({ state: 'start_only', durationSec: null });
  });

  it('midnight-to-midnight timed spans are day markers: date only, no hours', () => {
    const single = one(timed('2026-03-03', '00:00', '2026-03-04', '00:00'));
    expect(single.proposed.timing.state).toBe('date_only');
    expect(single.proposed.timing.durationSec).toBeNull();
    const multi = one(timed('2026-03-03', '00:00', '2026-03-06', '00:00'));
    expect(multi.proposed.timing.state).toBe('date_only');
    expect(multi.proposed.mappingNote).toContain('(3 giorni)');
  });

  it('uses the device zone when the event has no usable zone', () => {
    const start = instant('2026-05-10', '07:00', 'UTC');
    const end = instant('2026-05-10', '08:00', 'UTC');
    const e = ev({ allDay: false, start: { date: '2026-05-10', time: '07:00', timeZone: null, instant: start }, end: { date: '2026-05-10', time: '08:00', timeZone: null, instant: end } });
    const m = mapEventTiming(e, TZ)!;
    expect(m.timing).toMatchObject({ state: 'interval', start: '09:00', end: '10:00', timeZone: TZ, durationSec: 3600 });
  });

  it('preserves notes and location; map links are kept verbatim without guessed coordinates', () => {
    const i = one(timed('2026-05-10', '07:30', '2026-05-10', '09:00', { location: 'Spiaggia di Levante https://maps.app.goo.gl/AbC123', notes: 'Onde belle,\nvento da terra' }));
    expect(i.proposed.notes).toBe('Onde belle,\nvento da terra');
    expect(i.notesPreview).toBe('Onde belle, vento da terra');
    expect(i.proposed.place).toEqual({
      label: 'Spiaggia di Levante',
      address: null,
      mapUrl: 'https://maps.app.goo.gl/AbC123',
      coords: null,
      resolution: 'unresolved',
      resolutionNote: IMPORT_STRINGS.placeLinkNotRead,
    });
    expect(placeFromEvent('La Fuente\nCalle del Mar 3, Conil')).toMatchObject({ label: 'La Fuente', address: 'Calle del Mar 3, Conil', mapUrl: null, resolution: 'none' });
    expect(placeFromEvent('Zoom https://zoom.us/j/1')).toMatchObject({ label: 'Zoom https://zoom.us/j/1', mapUrl: null });
    expect(placeFromEvent(null, 'posto: https://www.google.com/maps/place/Levanto).')).toMatchObject({ mapUrl: 'https://www.google.com/maps/place/Levanto', label: null });
    expect(placeFromEvent('   ')).toBeNull();
  });

  it('turns Google HTML descriptions into plain text and leaves plain text alone', () => {
    expect(notesFromEvent('Onde belle<br>con <a href="https://x.it/a">Luca</a> &amp; Sara')).toBe('Onde belle\ncon Luca (https://x.it/a) & Sara');
    expect(notesFromEvent('a < b e c > d')).toBe('a < b e c > d');
    expect(notesFromEvent('<p>1 &lt; 2</p><ul><li>tavola</li><li>muta</li></ul>')).toBe('1 < 2\n• tavola\n• muta');
    expect(notesFromEvent('  \n ')).toBeNull();
  });

  it('labels the source calendar and account', () => {
    const cal: ExternalCalendar = {
      provider: 'google', accountId: ACC, calendarId: 'cal-surf', accountLabel: ACC, title: 'Mare', color: null, access: 'owner', canRead: true, canWrite: true, isPrimary: false, sourceType: null, sourceName: null,
    };
    expect(one(ev(), { calendars: [cal] }).sourceLabel).toBe(`Mare · ${ACC} · Google Calendar`);
    expect(one(ev()).sourceLabel).toBe('cal-surf · Google Calendar');
  });
});

// ─── own exports ─────────────────────────────────────────────────────────────

describe('own exported events', () => {
  const live = [mkSession({ id: 'sess-live', date: '2026-03-03', categoryId: 'surf' })];

  it('duration only (date marker) → declared duration, no clock times; skipped because the session exists', () => {
    const e = allDay('2026-03-03', '2026-03-04', { appMeta: meta({ sessionId: 'sess-live', timingState: 'duration_only', durationSec: 5400, durationSource: 'declared' }) });
    const i = one(e, { localSessions: live });
    expect(i.status).toBe('own_export');
    expect(i.selectable).toBe(false);
    expect(i.selectedByDefault).toBe(false);
    expect(i.matchedSessionId).toBe('sess-live');
    expect(i.proposed.timing).toMatchObject({ state: 'duration_only', start: null, end: null, declaredSec: 5400, durationSec: 5400, durationSource: 'declared' });
    expect(i.proposed.timingSource).toBe('app_meta');
  });

  it('duration only exported with an explicit outgoing scheduling time keeps no times', () => {
    const e = timed('2026-03-03', '18:00', '2026-03-03', '19:30', { appMeta: meta({ timingState: 'duration_only', durationSec: 3600, durationSource: 'declared', schedulingPlaceholder: true }) });
    const m = mapEventTiming(e, TZ, { timingState: 'duration_only', durationSec: 3600, schedulingPlaceholder: true, source: 'app_meta' })!;
    expect(m.timing).toMatchObject({ state: 'duration_only', start: null, durationSec: 3600 });
  });

  it('start only with a scheduling placeholder → start only, duration unknown (placeholder never becomes hours)', () => {
    const e = timed('2026-03-03', '07:00', '2026-03-03', '08:00', { appMeta: meta({ timingState: 'start_only', schedulingPlaceholder: true }) });
    const i = one(e);
    expect(i.proposed.timing).toMatchObject({ state: 'start_only', start: '07:00', end: null, durationSec: null });
    expect(i.proposed.durationLabel).toBe('Durata non specificata');
    expect(i.proposed.timingNote).toBe(IMPORT_STRINGS.noteRestoredPlaceholder);
  });

  it('date only stays unknown even when the calendar shows a timed span', () => {
    const e = timed('2026-03-03', '09:00', '2026-03-03', '10:00', { appMeta: meta({ timingState: 'date_only', schedulingPlaceholder: true }) });
    expect(one(e).proposed.timing).toMatchObject({ state: 'date_only', start: null, durationSec: null });
  });

  it('interval and start + declared duration are restored from the event and metadata', () => {
    const iv = one(timed('2026-03-03', '07:00', '2026-03-03', '08:15', { appMeta: meta({ timingState: 'interval', durationSec: 4500, durationSource: 'interval' }) }));
    expect(iv.proposed.timing).toMatchObject({ state: 'interval', durationSec: 4500 });
    const sd = one(timed('2026-03-04', '07:00', '2026-03-04', '09:00', { appMeta: meta({ sessionId: 's2', timingState: 'start_duration', durationSec: 2700, durationSource: 'declared' }) }));
    expect(sd.proposed.timing).toMatchObject({ state: 'start_duration', start: '07:00', end: null, declaredSec: 2700, durationSec: 2700 });
  });

  it('a recorded 24 h interval survives restoration (day-marker heuristics apply to foreign events only)', () => {
    const e = timed('2026-03-03', '00:00', '2026-03-04', '00:00', { appMeta: meta({ timingState: 'interval', durationSec: 86400, durationSource: 'interval' }) });
    expect(one(e).proposed.timing).toMatchObject({ state: 'interval', endDayOffset: 1, durationSec: 86400 });
    const foreign = timed('2026-03-05', '00:00', '2026-03-06', '00:00');
    expect(one(foreign).proposed.timing.durationSec).toBeNull();
  });

  it('seconds in source instants do not trigger the DST note', () => {
    const e = ev({
      allDay: false,
      start: { date: '2026-05-10', time: '07:30', timeZone: TZ, instant: '2026-05-10T05:30:40.000Z' },
      end: { date: '2026-05-10', time: '09:00', timeZone: TZ, instant: '2026-05-10T07:00:10.000Z' },
    });
    const i = one(e);
    expect(i.proposed.timing.durationSec).toBe(5400);
    expect(i.proposed.timingNote).toBeNull();
  });

  it('own export whose session was deleted can be restored explicitly (deselected by default)', () => {
    const e = timed('2026-03-03', '07:00', '2026-03-03', '08:00', { appMeta: meta({ sessionId: 'sess-gone', opId: 'op-1', timingState: 'start_only', schedulingPlaceholder: true }) });
    const i = one(e, { exportLinks: [link({ opId: 'op-1', sessionId: null, externalEventId: 'different-id' })] });
    expect(i.status).toBe('own_export');
    expect(i.selectable).toBe(true);
    expect(i.selectedByDefault).toBe(false);
    expect(i.reason).toBe(IMPORT_STRINGS.reasonOwnExportDeleted);
  });

  it('a linked event without metadata is recognised through the export link and its snapshot', () => {
    const e = timed('2026-03-03', '07:00', '2026-03-03', '08:00');
    const withLive = one(e, { exportLinks: [link({ externalEventId: e.eventId, sessionId: 'sess-live', status: 'linked' })], localSessions: live });
    expect(withLive.status).toBe('own_export');
    expect(withLive.selectable).toBe(false);
    expect(withLive.reason).toBe(IMPORT_STRINGS.reasonLinked);
    const deleted = one(e, { exportLinks: [link({ externalEventId: e.eventId, sessionId: null })] });
    expect(deleted.selectable).toBe(true);
    // Snapshot says start only with a placeholder: the 1 h span is not a duration.
    expect(deleted.proposed.timing).toMatchObject({ state: 'start_only', start: '07:00', durationSec: null });
    expect(deleted.proposed.timingSource).toBe('export_snapshot');
  });

  it('metadata from another install (no local trace) restores timing but is a normal new item', () => {
    const e = timed('2026-03-05', '07:00', '2026-03-05', '08:00', { appMeta: meta({ sessionId: 'elsewhere', timingState: 'start_only', schedulingPlaceholder: false }) });
    const i = one(e);
    expect(i.status).toBe('new');
    expect(i.proposed.timing).toMatchObject({ state: 'start_only', durationSec: null });
    expect(i.proposed.timingNote).toBe(IMPORT_STRINGS.noteRestoredForeign);
  });
});

// ─── duplicates, recurrence, cancellation ────────────────────────────────────

describe('statuses', () => {
  function series() {
    const occ = (date: string, status: ExternalEvent['status'] = 'confirmed') =>
      timed(date, '07:00', date, '08:30', { eventId: `ser_${date.replace(/-/g, '')}T060000Z`, recurringEventId: 'ser', occurrenceKey: instant(date, '07:00'), status });
    return [occ('2026-04-01'), occ('2026-04-08'), occ('2026-04-15', 'cancelled'), occ('2026-04-22')];
  }

  it('recurring occurrences are separate items; cancelled ones are listed as excluded and not selectable', () => {
    const items = review(series());
    expect(items).toHaveLength(4);
    expect(new Set(items.map((i) => i.key)).size).toBe(4);
    const cancelled = items.find((i) => i.proposed.date === '2026-04-15')!;
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.selectable).toBe(false);
    expect(cancelled.reason).toBe(IMPORT_STRINGS.reasonCancelled);
    expect(items.filter((i) => i.status === 'new')).toHaveLength(3);
    expect(defaultSelection(items).has(cancelled.key)).toBe(false);
  });

  it('provenance marks only the imported occurrence (series id is not occurrence identity)', () => {
    const ev0 = series();
    const items = review(ev0, { provenance: [prov(ev0[0], 'sess-a')] });
    expect(items.map((i) => i.status)).toEqual(['already_imported', 'new', 'cancelled', 'new']);
    expect(items[0].selectable).toBe(false);
    expect(items[0].matchedSessionId).toBe('sess-a');
    // Same occurrence under another instance id (e.g. re-keyed by the provider) still matches.
    const moved = { ...ev0[1], eventId: 'renamed-instance' };
    const p = prov(ev0[1], 'sess-b');
    expect(one(moved, { provenance: [p] }).status).toBe('already_imported');
  });

  it('imported, then deleted → re-importable explicitly, deselected by default', () => {
    const e = allDay('2026-03-03', '2026-03-04');
    const i = one(e, { provenance: [prov(e, null)] });
    expect(i.status).toBe('imported_then_deleted');
    expect(i.selectable).toBe(true);
    expect(i.selectedByDefault).toBe(false);
  });

  it('possible match: same date and no clock time on one side → review required', () => {
    const local = [mkSession({ id: 'loc', date: '2026-05-10', categoryId: 'surf' })];
    const i = one(timed('2026-05-10', '07:00', '2026-05-10', '08:00'), { localSessions: local });
    expect(i.status).toBe('possible_match');
    expect(i.selectedByDefault).toBe(false);
    expect(i.selectable).toBe(true);
    expect(i.matchedSessionId).toBe('loc');
    expect(i.reason).toBe(IMPORT_STRINGS.reasonPossibleNoClock('Surf', '10 maggio 2026'));
    // all-day event vs a timed local session: no clock on the event side
    const timedLocal = [mkSession({ id: 'loc2', date: '2026-05-11', categoryId: 'surf', timing: timing('2026-05-11', { state: 'start_only', start: '07:00', timeZone: TZ }) })];
    expect(one(allDay('2026-05-11', '2026-05-12'), { localSessions: timedLocal }).status).toBe('possible_match');
  });

  it('possible match: starts within 30 minutes; clearly different times are not a match', () => {
    const local = [mkSession({ id: 'loc', date: '2026-05-10', categoryId: 'surf', timing: timing('2026-05-10', { state: 'start_only', start: '07:00', timeZone: TZ }) })];
    const close = one(timed('2026-05-10', '07:20', '2026-05-10', '08:30'), { localSessions: local });
    expect(close.status).toBe('possible_match');
    expect(close.reason).toBe(IMPORT_STRINGS.reasonPossibleClose('Surf', '10 maggio 2026', '07:00', 20));
    const far = one(timed('2026-05-10', '15:00', '2026-05-10', '16:30'), { localSessions: local });
    expect(far.status).toBe('new');
    expect(far.selectedByDefault).toBe(true);
  });

  it('sessions of other activities never cause a possible match; two events on one date are both importable', () => {
    const otherActivity = [mkSession({ date: '2026-05-10', categoryId: 'run' })];
    const a = timed('2026-05-10', '07:00', '2026-05-10', '08:00');
    const b = timed('2026-05-10', '17:00', '2026-05-10', '18:00');
    const items = review([b, a], { localSessions: otherActivity });
    expect(items.map((i) => i.status)).toEqual(['new', 'new']);
    expect(items.map((i) => i.event.eventId)).toEqual([a.eventId, b.eventId]); // sorted by date/time
    expect(defaultSelection(items).size).toBe(2);
  });

  it('dedupes the same occurrence returned twice by the provider', () => {
    const e = allDay('2026-03-03', '2026-03-04');
    expect(review([e, { ...e }])).toHaveLength(1);
  });
});

// ─── selection ───────────────────────────────────────────────────────────────

describe('selection helpers', () => {
  function items(): ReviewItem[] {
    const local = [mkSession({ date: '2026-05-10', categoryId: 'surf' })];
    const cancelled = allDay('2026-05-01', '2026-05-02', { status: 'cancelled' });
    const imported = allDay('2026-05-02', '2026-05-03');
    return review([allDay('2026-05-03', '2026-05-04'), allDay('2026-05-04', '2026-05-05'), allDay('2026-05-10', '2026-05-11'), cancelled, imported], {
      localSessions: local,
      provenance: [prov(imported, 'sess-x')],
    });
  }

  it('defaults, explicit scopes, toggles and accurate counts', () => {
    const list = items();
    expect(list.map((i) => i.status)).toEqual(['cancelled', 'already_imported', 'new', 'new', 'possible_match']);
    let sel = defaultSelection(list);
    expect(selectionCounts(list, sel)).toEqual({ selected: 2, selectable: 3, total: 5 });

    sel = selectAll(list, sel, scopeStatus('possible_match'));
    expect(selectionCounts(list, sel).selected).toBe(3);
    sel = deselectAll(list, sel, scopeStatus('new'));
    expect(selectedItems(list, sel).map((i) => i.status)).toEqual(['possible_match']);
    sel = selectAll(list, sel);
    expect(selectionCounts(list, sel)).toEqual({ selected: 3, selectable: 3, total: 5 });
    // Non-selectable items cannot be selected individually either.
    const cancelledKey = list[0].key;
    expect(setSelected(list, sel, cancelledKey, true).has(cancelledKey)).toBe(false);
    expect(toggleSelected(list, sel, list[2].key).has(list[2].key)).toBe(false);
    sel = deselectAll(list, sel);
    expect(selectionCounts(list, sel).selected).toBe(0);
    expect(selectionCounts(list, new Set(['stale-key']))).toEqual({ selected: 0, selectable: 3, total: 5 });
  });

  it('preserves choices when the review is rebuilt', () => {
    const first = items();
    let sel = defaultSelection(first);
    sel = setSelected(first, sel, first[2].key, false); // user deselects a new item
    sel = setSelected(first, sel, first[4].key, true); // and accepts the possible match
    const rebuilt = [...items().slice(0, 0), ...first]; // same keys
    const extra = allDay('2026-05-20', '2026-05-21');
    const next = [...rebuilt, ...review([extra])];
    const kept = reconcileSelection(first, sel, next);
    expect(kept.has(first[2].key)).toBe(false);
    expect(kept.has(first[4].key)).toBe(true);
    expect(kept.has(first[3].key)).toBe(true);
    expect(kept.has(eventKey(extra))).toBe(true); // new item → its default
  });
});

// ─── commit (real SQLite through sql.js) ─────────────────────────────────────

describe('commitImport', () => {
  async function setup() {
    const repos = await testRepos();
    const b = await bootstrap(repos);
    const surf = b.categories.find((c) => c.name === 'Surf')!;
    let k = 0;
    const newId = () => `imp-${++k}-${Math.random().toString(36).slice(2, 8)}`;
    const fresh = async (events: ExternalEvent[], category: Category = surf) =>
      buildReview({
        events,
        filters: F(),
        capabilities: GOOGLE,
        provenance: await repos.provenance.listForCalendars('google', ACC, ['cal-surf']),
        localSessions: await repos.sessions.listAll(),
        exportLinks: await repos.exportLinks.all(),
        category,
        deviceTimeZone: TZ,
      });
    return { repos, surf, newId, fresh };
  }
  const NOW = '2026-10-11T09:00:00.000Z';

  function batch() {
    const multi = allDay('2026-03-03', '2026-03-06', { title: 'Surf trip Portogallo', notes: 'Ericeira', location: 'Ericeira\nPortugal' });
    const interval = timed('2026-03-10', '07:30', '2026-03-10', '09:00', { title: 'surf alba' });
    const placeholder = timed('2026-03-12', '07:00', '2026-03-12', '08:00', { title: 'Surf', appMeta: meta({ sessionId: 'elsewhere', timingState: 'start_only', schedulingPlaceholder: true }) });
    const occ = timed('2026-03-15', '18:00', '2026-03-15', '19:00', { title: 'Surf serale', eventId: 'ser_20260315T170000Z', recurringEventId: 'ser', occurrenceKey: instant('2026-03-15', '18:00') });
    return { multi, interval, placeholder, occ, all: [multi, interval, placeholder, occ] };
  }

  it('creates sessions and provenance in one transaction; stats ignore placeholders and spans', async () => {
    const { repos, surf, newId, fresh } = await setup();
    const { all, multi, occ } = batch();
    const items = await fresh(all);
    const res = await commitImport(repos, { category: surf, items: selectedItems(items, defaultSelection(items)), batchId: 'batch-1', now: NOW, newId });
    expect(res.sessions).toHaveLength(4);
    expect(res.skipped).toEqual([]);
    for (const s of res.sessions) {
      expect(s.origin).toBe('import');
      expect(s.categoryId).toBe(surf.id);
      expect(s.saveRequestId).toMatch(/^import:batch-1:/);
    }
    const byDate = Object.fromEntries(res.sessions.map((s) => [s.date, s]));
    expect(byDate['2026-03-03'].timing.state).toBe('date_only');
    expect(byDate['2026-03-03'].notes).toBe('Ericeira');
    expect(byDate['2026-03-03'].place).toMatchObject({ label: 'Ericeira', address: 'Portugal' });
    expect(byDate['2026-03-10'].timing).toMatchObject({ state: 'interval', durationSec: 5400 });
    expect(byDate['2026-03-12'].timing).toMatchObject({ state: 'start_only', start: '07:00', durationSec: null });

    const stored = await repos.provenance.listForCalendars('google', ACC, ['cal-surf']);
    expect(stored).toHaveLength(4);
    const pm = stored.find((p) => p.externalEventId === multi.eventId)!;
    expect(pm).toMatchObject({ originalTitle: 'Surf trip Portogallo', sourceAllDay: true, sourceStart: '2026-03-03', sourceEnd: '2026-03-06', importBatchId: 'batch-1', sessionId: byDate['2026-03-03'].id });
    const po = stored.find((p) => p.externalEventId === occ.eventId)!;
    expect(po).toMatchObject({ recurringEventId: 'ser', occurrenceKey: occ.occurrenceKey, sourceAllDay: false, sourceStart: occ.start.instant, sourceEnd: occ.end.instant });

    const summary = summarize(await repos.sessions.listByCategory(surf.id));
    expect(summary.sessions).toBe(4);
    // Only real intervals count (1 h 30 + 1 h); the placeholder hour and the 3-day span add nothing.
    expect(summary.duration).toEqual({ knownSec: 5400 + 3600, knownCount: 2, totalCount: 4 });
  });

  it('is idempotent: same batch, a different batch, and a concurrent double commit never duplicate', async () => {
    const { repos, surf, newId, fresh } = await setup();
    const items = await fresh(batch().all);
    const selected = selectedItems(items, defaultSelection(items));
    const [a, b] = await Promise.all([
      commitImport(repos, { category: surf, items: selected, batchId: 'batch-1', now: NOW, newId }),
      commitImport(repos, { category: surf, items: selected, batchId: 'batch-1', now: NOW, newId }),
    ]);
    expect(a.sessions.length + b.sessions.length).toBe(4);
    expect((await repos.sessions.listAll()).length).toBe(4);

    const again = await commitImport(repos, { category: surf, items: selected, batchId: 'batch-1', now: NOW, newId });
    expect(again.sessions).toEqual([]);
    expect(again.skipped.map((s) => s.reason)).toEqual(['already_imported', 'already_imported', 'already_imported', 'already_imported']);
    const otherBatch = await commitImport(repos, { category: surf, items: selected, batchId: 'batch-2', now: NOW, newId });
    expect(otherBatch.sessions).toEqual([]);
    expect((await repos.sessions.listAll()).length).toBe(4);
    expect(await repos.provenance.listForCalendars('google', ACC, ['cal-surf'])).toHaveLength(4);
  });

  it('a repeated import shows already imported; deleted sessions can be re-imported explicitly', async () => {
    const { repos, surf, newId, fresh } = await setup();
    const { all, interval } = batch();
    const first = await fresh(all);
    const res = await commitImport(repos, { category: surf, items: selectedItems(first, defaultSelection(first)), batchId: 'b1', now: NOW, newId });

    const second = await fresh(all);
    expect(second.map((i) => i.status)).toEqual(['already_imported', 'already_imported', 'already_imported', 'already_imported']);
    expect(defaultSelection(second).size).toBe(0);

    const deleted = res.sessions.find((s) => s.date === interval.start.date)!;
    await repos.sessions.remove([deleted.id]);
    const third = await fresh(all);
    const item = third.find((i) => i.key === eventKey(interval))!;
    expect(item.status).toBe('imported_then_deleted');
    expect(defaultSelection(third).has(item.key)).toBe(false);

    const sel = setSelected(third, defaultSelection(third), item.key, true);
    const re = await commitImport(repos, { category: surf, items: selectedItems(third, sel), batchId: 'b2', now: NOW, newId });
    expect(re.sessions).toHaveLength(1);
    expect(re.sessions[0].timing).toMatchObject({ state: 'interval', durationSec: 5400 });
    const p = (await repos.provenance.listForCalendars('google', ACC, ['cal-surf'])).find((x) => x.externalEventId === interval.eventId)!;
    expect(p.sessionId).toBe(re.sessions[0].id);
    expect((await fresh(all)).every((i) => i.status === 'already_imported')).toBe(true);
  });

  it('skips non-selectable items and own exports whose session exists', async () => {
    const { repos, surf, newId, fresh } = await setup();
    const saved = await repos.sessions.saveBatch({ categoryId: surf.id, dates: ['2026-03-20'], requestId: 'manual-1' });
    const ownId = saved.sessions[0].id;
    const own = allDay('2026-03-20', '2026-03-21', { appMeta: meta({ sessionId: ownId, timingState: 'date_only' }) });
    const cancelled = allDay('2026-03-21', '2026-03-22', { status: 'cancelled' });
    const items = await fresh([own, cancelled]);
    expect(items.map((i) => i.status)).toEqual(['own_export', 'cancelled']);
    // Even if a caller forces them through, nothing is imported.
    const forced = items.map((i) => ({ ...i, selectable: i.status === 'own_export' ? true : i.selectable }));
    const res = await commitImport(repos, { category: surf, items: forced, batchId: 'b', now: NOW, newId });
    expect(res.sessions).toEqual([]);
    expect(res.skipped).toEqual([
      { key: eventKey(cancelled), reason: 'not_selectable' },
      { key: eventKey(own), reason: 'own_export' },
    ]);
    expect(await repos.sessions.listAll()).toHaveLength(1);
  });

  it('rolls back everything when a write fails mid-batch', async () => {
    const { repos, surf, newId, fresh } = await setup();
    const items = await fresh(batch().all);
    const original = repos.provenance.insert;
    let calls = 0;
    repos.provenance.insert = async (tx, p) => {
      if (++calls === 2) throw new Error('disk full');
      return original(tx, p);
    };
    await expect(commitImport(repos, { category: surf, items: selectedItems(items, defaultSelection(items)), batchId: 'b', now: NOW, newId })).rejects.toThrow('disk full');
    repos.provenance.insert = original;
    expect(await repos.sessions.listAll()).toHaveLength(0);
    expect(await repos.provenance.listForCalendars('google', ACC, ['cal-surf'])).toHaveLength(0);
  });

  it('refuses a missing activity or batch id', async () => {
    const { repos, newId, surf } = await setup();
    await expect(commitImport(repos, { category: { id: 'nope' }, items: [], batchId: 'b', now: NOW, newId })).rejects.toBeInstanceOf(DomainError);
    await expect(commitImport(repos, { category: surf, items: [], batchId: '', now: NOW, newId })).rejects.toBeInstanceOf(DomainError);
  });

  it('derives the save request id from batch and occurrence identity', () => {
    const e = batch().occ;
    expect(importRequestId('b-7', eventKey(e))).toBe(`import:b-7:google:${ACC}:cal-surf:${e.eventId}:${e.occurrenceKey}`);
  });
});

// ─── adversarial review regressions ──────────────────────────────────────────

describe('review regressions', () => {
  const NOW = '2026-10-11T09:00:00.000Z';

  it('two concurrent commits with DIFFERENT batch ids never duplicate an occurrence', async () => {
    const repos = await testRepos();
    const b = await bootstrap(repos);
    const surf = b.categories.find((c) => c.name === 'Surf')!;
    let k = 0;
    const newId = () => `cc-${++k}`;
    const events = [allDay('2026-02-03', '2026-02-04'), timed('2026-02-05', '07:00', '2026-02-05', '08:00')];
    const items = buildReview({ events, filters: F(), capabilities: GOOGLE, provenance: [], localSessions: [], exportLinks: [], category: surf, deviceTimeZone: TZ });
    const sel = selectedItems(items, defaultSelection(items));
    const [x, y] = await Promise.all([
      commitImport(repos, { category: surf, items: sel, batchId: 'tap-1', now: NOW, newId }),
      commitImport(repos, { category: surf, items: sel, batchId: 'tap-2', now: NOW, newId }),
    ]);
    expect(x.sessions.length + y.sessions.length).toBe(2);
    const all = await repos.sessions.listAll();
    expect(all).toHaveLength(2);
    const provs = await repos.provenance.listForCalendars('google', ACC, ['cal-surf']);
    expect(provs).toHaveLength(2);
    expect(new Set(provs.map((p) => p.sessionId))).toEqual(new Set(all.map((s) => s.id)));
  });

  it('HTML notes keep single-quoted / unquoted links and decode numeric and accented entities', () => {
    expect(notesFromEvent("Vedi <a href='https://x.it/a'>qui</a><br>ok")).toBe('Vedi qui (https://x.it/a)\nok');
    expect(notesFromEvent('Vedi <a href=https://x.it/b>qui</a>')).toBe('Vedi qui (https://x.it/b)');
    expect(notesFromEvent('<p>L&#8217;onda &#x27;bella&#x27; &egrave; arrivata &agrave; riva</p>')).toBe('L’onda \'bella\' è arrivata à riva');
  });

  it('an own exported interval/start+duration written with an export-only time never adopts that time', () => {
    // Interval session exported with an outgoing time override (placeholder): the event's 18:00 is not the recorded start.
    const iv = timed('2026-03-03', '18:00', '2026-03-03', '19:30', { appMeta: meta({ timingState: 'interval', durationSec: 4500, durationSource: 'interval', schedulingPlaceholder: true }) });
    const i = one(iv);
    expect(i.proposed.timing).toMatchObject({ state: 'duration_only', start: null, end: null, durationSec: 4500 });
    const sd = timed('2026-03-04', '18:00', '2026-03-04', '18:45', { appMeta: meta({ sessionId: 's-sd', timingState: 'start_duration', durationSec: 2700, durationSource: 'declared', schedulingPlaceholder: true }) });
    expect(one(sd).proposed.timing).toMatchObject({ state: 'duration_only', start: null, declaredSec: 2700, durationSec: 2700 });
    // Unknown recorded duration + placeholder → date only, never the span.
    const unk = timed('2026-03-05', '18:00', '2026-03-05', '19:00', { appMeta: meta({ sessionId: 's-u', timingState: 'interval', durationSec: null, durationSource: null, schedulingPlaceholder: true }) });
    expect(one(unk).proposed.timing).toMatchObject({ state: 'date_only', durationSec: null });
  });

  it('a rebuilt review deselects an item whose status turned into a possible match', () => {
    const e = timed('2026-06-10', '07:00', '2026-06-10', '08:00');
    const first = review([e]);
    const sel = defaultSelection(first);
    expect(sel.has(first[0].key)).toBe(true);
    const rebuilt = review([e], { localSessions: [mkSession({ date: '2026-06-10', categoryId: 'surf' })] });
    expect(rebuilt[0].status).toBe('possible_match');
    expect(reconcileSelection(first, sel, rebuilt).has(rebuilt[0].key)).toBe(false);
    // An explicit choice on an unchanged item is still preserved.
    const off = setSelected(first, sel, first[0].key, false);
    expect(reconcileSelection(first, off, review([e])).has(first[0].key)).toBe(false);
  });

  it('restoring an own export strips the lines Serie added to the description, keeping the map link on the place', () => {
    const e = allDay('2026-03-07', '2026-03-08', {
      notes: 'Durata: 1 h 30 min\n\nOnde lunghe\n\nMappa: https://maps.app.goo.gl/XyZ',
      location: 'La Fuente, Conil',
      appMeta: meta({ sessionId: 'gone-1', timingState: 'duration_only', durationSec: 5400, durationSource: 'declared' }),
    });
    const i = one(e);
    expect(i.proposed.notes).toBe('Onde lunghe');
    expect(i.proposed.place).toMatchObject({ label: 'La Fuente, Conil', mapUrl: 'https://maps.app.goo.gl/XyZ' });
    // Foreign events keep their notes verbatim.
    const f = allDay('2026-03-09', '2026-03-10', { notes: 'Durata: 1 h 30 min\n\nOnde lunghe' });
    expect(one(f).proposed.notes).toBe('Durata: 1 h 30 min\n\nOnde lunghe');
  });

  it('00:00–23:59 timed events are day markers too: no hours', () => {
    const i = one(timed('2026-07-01', '00:00', '2026-07-01', '23:59'));
    expect(i.proposed.timing).toMatchObject({ state: 'date_only', durationSec: null });
    expect(i.proposed.durationLabel).toBe('Durata non specificata');
    const multi = one(timed('2026-07-03', '00:00', '2026-07-05', '23:59'));
    expect(multi.proposed.timing.state).toBe('date_only');
    expect(multi.proposed.mappingNote).toContain('(3 giorni)');
  });

  it('notes preview never cuts an emoji in half', () => {
    const e = allDay('2026-03-11', '2026-03-12', { notes: `${'a'.repeat(118)}🏄‍♂️🌊 dopo` });
    const p = one(e).notesPreview!;
    expect(p.endsWith('…')).toBe(true);
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(p)).toBe(false);
  });

  it('title filter: NFD/NFC forms, emoji and mixed case match the title only', () => {
    expect(titleMatches('🏄 Súrf all’alba', 'SÚRF')).toBe(true);
    expect(titleMatches('Kitesurf', 'surf')).toBe(true);
    expect(titleMatches('Corsa', 'surf')).toBe(false);
  });
});

describe('possible match: overlapping recorded times', () => {
  const local = () => [mkSession({ id: 'L', date: '2026-05-10', categoryId: 'surf', timing: timing('2026-05-10', { state: 'interval', start: '07:00', end: '10:00', endDayOffset: 0, timeZone: TZ }) })];

  it('an event inside a local interval needs review even when the starts are more than 30 min apart', () => {
    const i = one(timed('2026-05-10', '07:45', '2026-05-10', '09:45'), { localSessions: local() });
    expect(i.status).toBe('possible_match');
    expect(i.selectedByDefault).toBe(false);
    expect(i.matchedSessionId).toBe('L');
    expect(i.reason).toBe(IMPORT_STRINGS.reasonPossibleOverlap('Surf', '10 maggio 2026', '07:00–10:00'));
  });

  it('an event interval covering a local start-only session needs review', () => {
    const startOnly = [mkSession({ id: 'S', date: '2026-05-10', categoryId: 'surf', timing: timing('2026-05-10', { state: 'start_only', start: '08:00', timeZone: TZ }) })];
    expect(one(timed('2026-05-10', '07:00', '2026-05-10', '09:00'), { localSessions: startOnly }).status).toBe('possible_match');
  });

  it('back-to-back or separate sessions on the same day stay new (never by date alone)', () => {
    expect(one(timed('2026-05-10', '10:00', '2026-05-10', '11:00'), { localSessions: local() }).status).toBe('new');
    expect(one(timed('2026-05-10', '16:00', '2026-05-10', '18:00'), { localSessions: local() }).status).toBe('new');
    // A local start-only session and an event start-only far apart: no overlap evidence.
    const startOnly = [mkSession({ date: '2026-05-10', categoryId: 'surf', timing: timing('2026-05-10', { state: 'start_only', start: '07:00', timeZone: TZ }) })];
    const e = timed('2026-05-10', '15:00', '2026-05-10', '15:00'); // zero length → start only
    expect(one(e, { localSessions: startOnly }).status).toBe('new');
  });
});

describe('same event in several selected calendars', () => {
  it('the copy of an event already listed from another selected calendar needs review (no silent double import)', () => {
    const a = timed('2026-05-12', '07:00', '2026-05-12', '08:30', { eventId: 'shared-1', calendarId: 'cal-surf' });
    const b = { ...a, calendarId: 'cal-club' };
    const items = review([a, b], { filters: F({ calendarIds: ['cal-surf', 'cal-club'] }) });
    expect(items).toHaveLength(2);
    const statuses = items.map((i) => i.status).sort();
    expect(statuses).toEqual(['new', 'possible_match']);
    expect(defaultSelection(items).size).toBe(1);
    // Deterministic: the first item in review order is the original, later copies point at it.
    const [original, copy] = items;
    expect(original.status).toBe('new');
    expect(copy.status).toBe('possible_match');
    expect(copy.selectable).toBe(true);
    expect(copy.selectedByDefault).toBe(false);
    expect(copy.reason).toBe(IMPORT_STRINGS.reasonSameEventOtherCalendar(original.sourceLabel));
    // A cancelled copy does not cast doubt on the live one.
    const live = review([{ ...b, status: 'cancelled' }, a], { filters: F({ calendarIds: ['cal-surf', 'cal-club'] }) });
    expect(live.map((i) => i.status).sort()).toEqual(['cancelled', 'new']);
    // Different occurrences of a series are not copies of each other.
    const o1 = timed('2026-05-13', '07:00', '2026-05-13', '08:00', { eventId: 'ser_1', recurringEventId: 'ser', occurrenceKey: instant('2026-05-13', '07:00') });
    const o2 = timed('2026-05-20', '07:00', '2026-05-20', '08:00', { eventId: 'ser_2', recurringEventId: 'ser', occurrenceKey: instant('2026-05-20', '07:00') });
    expect(review([o1, o2]).map((i) => i.status)).toEqual(['new', 'new']);
  });
});

describe('indexed lookups keep their precedence', () => {
  it('exact event id beats a same-series fallback listed earlier; other calendars never match', () => {
    const e = timed('2026-04-01', '07:00', '2026-04-01', '08:00', { eventId: 'inst-new', recurringEventId: 'ser', occurrenceKey: instant('2026-04-01', '07:00') });
    const seriesOnly = prov({ ...e, eventId: 'inst-old' }, 'sess-old', { id: 'p-old' });
    const exact = prov(e, 'sess-exact', { id: 'p-exact' });
    expect(findProvenance(e, [seriesOnly, exact])?.id).toBe('p-exact');
    expect(findProvenance(e, [seriesOnly])?.id).toBe('p-old');
    expect(findProvenance(e, [prov({ ...e, calendarId: 'cal-other' }, 'x')])).toBeNull();
    // Occurrence keys are compared as instants (format variants of one instant are the same occurrence).
    expect(findProvenance(e, [prov(e, 's', { occurrenceKey: e.occurrenceKey!.replace('.000Z', 'Z') })])).not.toBeNull();
    expect(findProvenance(e, [prov(e, 's', { occurrenceKey: instant('2026-04-08', '07:00') })])).toBeNull();
  });

  it('event identity beats operation id, which beats session id', () => {
    const e = timed('2026-04-02', '07:00', '2026-04-02', '08:00', { appMeta: meta({ sessionId: 'S1', opId: 'OP1' }) });
    const bySession = link({ id: 'l-session', sessionId: 'S1', opId: 'other-op', externalEventId: 'x1' });
    const byOp = link({ id: 'l-op', opId: 'OP1', externalEventId: 'x2' });
    const byEvent = link({ id: 'l-event', opId: 'op-3', externalEventId: e.eventId });
    expect(findExportLink(e, [bySession, byOp, byEvent])?.id).toBe('l-event');
    expect(findExportLink(e, [bySession, byOp])?.id).toBe('l-op');
    expect(findExportLink(e, [bySession])?.id).toBe('l-session');
    expect(findExportLink({ ...e, appMeta: null }, [bySession, byOp])).toBeNull();
  });
});
