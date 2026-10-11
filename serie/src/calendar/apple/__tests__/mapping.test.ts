import type { AppEventMeta, EventDraft } from '../../types';
import { ProviderError } from '../../types';
import { diffDays } from '@/domain/dates';
import {
  chunkDateRange,
  composeEventId,
  draftToDetails,
  eventTimes,
  MAX_CHUNK_DAYS,
  mapStatus,
  occurrenceKeyOf,
  parseEventId,
  toExternalCalendar,
  toExternalEvent,
  type EKEventLike,
} from '../mapping';
import { metaFromUrl, metaToUrl, splitNotesMeta } from '../meta';

const TZ = 'Europe/Rome';
const META: AppEventMeta = {
  v: 1,
  sessionId: 's-1',
  opId: 'op-1',
  timingState: 'interval',
  durationSec: 5400,
  durationSource: 'interval',
  schedulingPlaceholder: false,
};

const ev = (p: Partial<EKEventLike>): EKEventLike => ({
  id: 'E1',
  calendarId: 'C1',
  title: 'Surf',
  location: null,
  notes: null,
  url: null,
  timeZone: null,
  startDate: '2026-03-05T07:30:00.000Z',
  endDate: '2026-03-05T09:00:00.000Z',
  allDay: false,
  status: 'none',
  recurrenceRule: null,
  ...p,
});

describe('chunkDateRange', () => {
  it('splits a multi-year range into contiguous chunks of at most one year', () => {
    const chunks = chunkDateRange('2015-02-10', '2026-10-11');
    expect(chunks[0].from).toBe('2015-02-10');
    expect(chunks[chunks.length - 1].toExclusive).toBe('2026-10-12');
    for (let i = 0; i < chunks.length; i++) {
      const days = diffDays(chunks[i].toExclusive, chunks[i].from);
      expect(days).toBeGreaterThan(0);
      expect(days).toBeLessThanOrEqual(MAX_CHUNK_DAYS);
      if (i > 0) expect(chunks[i].from).toBe(chunks[i - 1].toExclusive);
    }
    const total = chunks.reduce((n, c) => n + diffDays(c.toExclusive, c.from), 0);
    expect(total).toBe(diffDays('2026-10-12', '2015-02-10'));
  });

  it('clamps maxDays so a bad value can neither loop forever nor exceed one year', () => {
    expect(chunkDateRange('2026-01-01', '2026-01-03', 0)).toHaveLength(3);
    expect(chunkDateRange('2026-01-01', '2026-01-03', -5)).toHaveLength(3);
    expect(chunkDateRange('2026-01-01', '2026-01-03', Number.NaN)).toEqual([{ from: '2026-01-01', toExclusive: '2026-01-04' }]);
    const wide = chunkDateRange('2016-01-01', '2026-01-01', 5000);
    expect(wide.length).toBeGreaterThanOrEqual(10);
    for (const c of wide) expect(diffDays(c.toExclusive, c.from)).toBeLessThanOrEqual(MAX_CHUNK_DAYS);
  });

  it('handles single days and rejects inverted ranges', () => {
    expect(chunkDateRange('2026-10-11', '2026-10-11')).toEqual([{ from: '2026-10-11', toExclusive: '2026-10-12' }]);
    expect(chunkDateRange('2026-10-12', '2026-10-11')).toEqual([]);
    expect(chunkDateRange('bad', '2026-10-11')).toEqual([]);
  });
});

describe('event times', () => {
  it('maps an EventKit all-day event to date-only with an exclusive end', () => {
    // Rome midnight 2026-03-05 → 23:59:59 of the same day (EventKit convention)
    const t = eventTimes(ev({ allDay: true, startDate: '2026-03-04T23:00:00.000Z', endDate: '2026-03-05T22:59:59.000Z' }), TZ)!;
    expect(t.allDay).toBe(true);
    expect(t.start).toEqual({ date: '2026-03-05', time: null, timeZone: null, instant: null });
    expect(t.end).toEqual({ date: '2026-03-06', time: null, timeZone: null, instant: null });
  });

  it('keeps a multi-day all-day span (across a DST change) and tolerates next-midnight ends', () => {
    const a = eventTimes(ev({ allDay: true, startDate: '2026-03-27T23:00:00.000Z', endDate: '2026-03-30T21:59:59.000Z' }), TZ)!;
    expect([a.start.date, a.end.date]).toEqual(['2026-03-28', '2026-03-31']);
    const b = eventTimes(ev({ allDay: true, startDate: '2026-07-09T22:00:00.000Z', endDate: '2026-07-10T22:00:00.000Z' }), TZ)!;
    expect([b.start.date, b.end.date]).toEqual(['2026-07-10', '2026-07-11']);
    const zero = eventTimes(ev({ allDay: true, startDate: '2026-07-09T22:00:00.000Z', endDate: '2026-07-09T22:00:00.000Z' }), TZ)!;
    expect([zero.start.date, zero.end.date]).toEqual(['2026-07-10', '2026-07-11']);
  });

  it('maps timed events to wall time in the device zone when the native zone is an abbreviation', () => {
    const t = eventTimes(ev({ timeZone: 'GMT+1', startDate: '2026-07-10T05:30:00.000Z', endDate: '2026-07-10T07:00:00.000Z' }), TZ)!;
    expect(t.start).toEqual({ date: '2026-07-10', time: '07:30', timeZone: TZ, instant: '2026-07-10T05:30:00.000Z' });
    expect(t.end).toEqual({ date: '2026-07-10', time: '09:00', timeZone: TZ, instant: '2026-07-10T07:00:00.000Z' });
  });

  it('uses the event zone when it is a real IANA id', () => {
    const t = eventTimes(ev({ timeZone: 'Asia/Makassar', startDate: '2026-07-09T23:00:00.000Z', endDate: '2026-07-10T01:00:00.000Z' }), TZ)!;
    expect(t.start).toMatchObject({ date: '2026-07-10', time: '07:00', timeZone: 'Asia/Makassar' });
    expect(t.end).toMatchObject({ date: '2026-07-10', time: '09:00' });
  });

  it('returns null for unreadable dates', () => {
    expect(eventTimes(ev({ startDate: 'nope' }), TZ)).toBeNull();
  });
});

describe('occurrence identity', () => {
  const weekly = { frequency: 'weekly' };

  it('derives eventId/recurringEventId/occurrenceKey from the series id and original start', () => {
    const a = toExternalEvent(ev({ recurrenceRule: weekly, startDate: '2026-03-05T07:30:00.000Z', endDate: '2026-03-05T09:00:00.000Z', originalStartDate: '2026-03-05T07:30:00.000Z' }), { accountId: 'S', deviceTz: TZ })!;
    const b = toExternalEvent(ev({ recurrenceRule: weekly, startDate: '2026-03-12T07:30:00.000Z', endDate: '2026-03-12T09:00:00.000Z', originalStartDate: '2026-03-12T07:30:00.000Z' }), { accountId: 'S', deviceTz: TZ })!;
    expect(a.recurringEventId).toBe('E1');
    expect(b.recurringEventId).toBe('E1');
    expect(a.occurrenceKey).toBe('2026-03-05T07:30:00.000Z');
    expect(b.occurrenceKey).toBe('2026-03-12T07:30:00.000Z');
    expect(a.eventId).not.toBe(b.eventId);
    expect(parseEventId(a.eventId)).toEqual({ seriesId: 'E1', occurrenceKey: a.occurrenceKey });
  });

  it('keeps the original start as identity for a moved (detached) occurrence', () => {
    const moved = ev({ isDetached: true, recurrenceRule: null, startDate: '2026-03-14T16:00:00.000Z', endDate: '2026-03-14T17:00:00.000Z', originalStartDate: '2026-03-12T07:30:00.000Z' });
    expect(occurrenceKeyOf(moved, TZ)).toBe('2026-03-12T07:30:00.000Z');
  });

  it('uses the original date for all-day occurrences and nothing for single events', () => {
    expect(occurrenceKeyOf(ev({ allDay: true, recurrenceRule: weekly, startDate: '2026-03-04T23:00:00.000Z', endDate: '2026-03-05T22:59:59.000Z' }), TZ)).toBe('2026-03-05');
    const single = toExternalEvent(ev({}), { accountId: 'S', deviceTz: TZ })!;
    expect(single).toMatchObject({ eventId: 'E1', recurringEventId: null, occurrenceKey: null });
  });

  it('parses ids defensively', () => {
    expect(parseEventId('ABC-123')).toEqual({ seriesId: 'ABC-123', occurrenceKey: null });
    expect(parseEventId(composeEventId('ABC', '2026-03-05'))).toEqual({ seriesId: 'ABC', occurrenceKey: '2026-03-05' });
    expect(parseEventId('user@example.com')).toEqual({ seriesId: 'user@example.com', occurrenceKey: null });
  });
});

describe('toExternalEvent', () => {
  it('maps fields, status and metadata, and never exposes the metadata trailer as notes', () => {
    const x = toExternalEvent(
      ev({ status: 'cancelled', notes: `Note\n\n${metaToUrl(META)}`, url: 'https://example.com', location: 'La Fuente', lastModifiedDate: '2026-10-01T10:00:00.000Z' }),
      { accountId: 'SRC', deviceTz: TZ },
    )!;
    expect(x).toMatchObject({ provider: 'apple', accountId: 'SRC', calendarId: 'C1', status: 'cancelled', notes: 'Note', location: 'La Fuente', colorId: null, appMeta: META, updated: '2026-10-01T10:00:00.000Z' });
  });

  it('maps both spellings of cancelled and defaults to confirmed', () => {
    expect(mapStatus('canceled')).toBe('cancelled');
    expect(mapStatus('cancelled')).toBe('cancelled');
    expect(mapStatus('tentative')).toBe('tentative');
    expect(mapStatus('none')).toBe('confirmed');
    expect(mapStatus(undefined)).toBe('confirmed');
  });
});

describe('toExternalCalendar', () => {
  it('maps the EventKit source as the account and respects allowsModifications', () => {
    const c = toExternalCalendar(
      { id: 'C1', title: 'Surf', source: { id: 'SRC-1', type: 'caldav', name: 'a@b.com' }, type: 'caldav', color: '#FF2968', allowsModifications: true },
      { canRead: true, defaultCalendarId: 'C1' },
    );
    expect(c).toEqual({
      provider: 'apple',
      accountId: 'SRC-1',
      calendarId: 'C1',
      accountLabel: 'a@b.com',
      title: 'Surf',
      color: '#FF2968',
      access: 'writer',
      canRead: true,
      canWrite: true,
      isPrimary: true,
      sourceType: 'caldav',
      sourceName: 'a@b.com',
    });
    const sub = toExternalCalendar(
      { id: 'C2', title: 'Festività', source: { id: 'SRC-2', type: 'subscribed', name: 'Calendari iscritti' }, allowsModifications: true },
      { canRead: true, defaultCalendarId: 'C1' },
    );
    expect(sub).toMatchObject({ canWrite: false, access: 'reader', isPrimary: false });
    const local = toExternalCalendar({ id: 'C3', title: 'Calendario', source: { type: 'local', name: 'Default' }, allowsModifications: true }, { canRead: false, defaultCalendarId: null });
    expect(local).toMatchObject({ accountId: 'Default', accountLabel: 'Sul mio iPhone', canRead: false });
  });
});

describe('draftToDetails', () => {
  const timed: EventDraft = {
    title: 'Surf',
    notes: 'Onde',
    location: null,
    allDay: false,
    start: { date: '2026-07-10', time: '07:30', timeZone: TZ },
    end: { date: '2026-07-10', time: '09:00', timeZone: TZ },
    colorId: null,
    appMeta: META,
  };

  it('creates timed events with zone, no alarms, metadata in the URL', () => {
    const d = draftToDetails(timed, { deviceTz: 'UTC', mode: 'create' });
    expect(d.alarms).toEqual([]);
    expect(d.startDate.toISOString()).toBe('2026-07-10T05:30:00.000Z');
    expect(d.endDate.toISOString()).toBe('2026-07-10T07:00:00.000Z');
    expect(d.timeZone).toBe(TZ);
    expect(metaFromUrl(d.url)).toEqual(META);
    expect(d.notes).toBe('Onde');
    expect('location' in d).toBe(false);
    expect(Object.keys(d)).not.toEqual(expect.arrayContaining(['attendees']));
    expect(Object.keys(d)).not.toEqual(expect.arrayContaining(['recurrenceRule']));
  });

  it('writes all-day events as device-zone midnight → last second of the last day', () => {
    const d = draftToDetails(
      { ...timed, allDay: true, start: { date: '2026-03-28', time: null, timeZone: null }, end: { date: '2026-03-30', time: null, timeZone: null } },
      { deviceTz: TZ, mode: 'create' },
    );
    expect(d.allDay).toBe(true);
    expect(d.startDate.toISOString()).toBe('2026-03-27T23:00:00.000Z');
    expect(d.endDate.toISOString()).toBe('2026-03-29T21:59:59.000Z'); // CEST after the switch
    expect('timeZone' in d).toBe(false);
    // and the read side maps it back to the same exclusive range
    const back = eventTimes(ev({ allDay: true, startDate: d.startDate.toISOString(), endDate: d.endDate.toISOString() }), TZ)!;
    expect([back.start.date, back.end.date]).toEqual(['2026-03-28', '2026-03-30']);
  });

  it('update mode sends explicit nulls so stale values are cleared', () => {
    const d = draftToDetails({ ...timed, notes: null, allDay: true, start: { date: '2026-07-10', time: null, timeZone: null }, end: { date: '2026-07-11', time: null, timeZone: null } }, { deviceTz: TZ, mode: 'update', existingUrl: null });
    expect(d).toMatchObject({ notes: null, location: null, timeZone: null, alarms: [] });
  });

  it('keeps a foreign URL and stores metadata as a trailing notes line instead', () => {
    const d = draftToDetails(timed, { deviceTz: TZ, mode: 'update', existingUrl: 'https://maps.apple.com/?q=La+Fuente' });
    expect('url' in d).toBe(false);
    expect(splitNotesMeta(d.notes)).toEqual({ notes: 'Onde', meta: META });
    const ours = draftToDetails(timed, { deviceTz: TZ, mode: 'update', existingUrl: metaToUrl({ ...META, opId: 'old' }) });
    expect(metaFromUrl(ours.url)).toEqual(META);
    expect(ours.notes).toBe('Onde');
  });

  it('rejects drafts that would fabricate or invert time', () => {
    const bad: EventDraft[] = [
      { ...timed, end: { ...timed.end, time: '07:30' } },
      { ...timed, end: { ...timed.end, time: null } },
      { ...timed, start: { ...timed.start, timeZone: 'Mars/Base' } },
      { ...timed, allDay: true, start: { date: '2026-07-10', time: null, timeZone: null }, end: { date: '2026-07-10', time: null, timeZone: null } },
      { ...timed, start: { ...timed.start, date: '2026-02-30' } },
    ];
    for (const b of bad) {
      expect(() => draftToDetails(b, { deviceTz: TZ, mode: 'create' })).toThrow(ProviderError);
      try {
        draftToDetails(b, { deviceTz: TZ, mode: 'create' });
      } catch (e) {
        expect((e as ProviderError).code).toBe('invalid');
      }
    }
  });
});
