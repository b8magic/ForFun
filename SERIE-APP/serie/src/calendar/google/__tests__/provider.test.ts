import { GoogleCalendarApi, type GCalEvent } from '@/calendar/google/api';
import { GOOGLE_SCOPES, GoogleAuth, MemoryTokenStore, resolveGoogleClient } from '@/calendar/google/auth';
import {
  GoogleCalendarProvider,
  draftToGoogleBody,
  mergeForUpdate,
  metaToPrivate,
  normalizeGoogleEvent,
  privateToMeta,
  type NormalizeContext,
} from '@/calendar/google/provider';
import { ProviderError, type AppEventMeta, type EventDraft } from '@/calendar/types';
import { installFetch } from './fetchMock';

const realFetch = globalThis.fetch;
afterEach(() => {
  (globalThis as { fetch: unknown }).fetch = realFetch;
});

const CLIENT = '1234-abc.apps.googleusercontent.com';
const ACCOUNT = 'surfer@example.com';
const ctx: NormalizeContext = { accountId: ACCOUNT, calendarId: 'primary', calendarTimeZone: 'Europe/Rome' };

function mkProvider(scopes: string[] = ['openid', 'email', GOOGLE_SCOPES.read, GOOGLE_SCOPES.write]) {
  const store = new MemoryTokenStore(
    JSON.stringify({ v: 1, clientId: CLIENT, accountId: ACCOUNT, accessToken: 'tok', expiresAt: Date.now() + 3600_000, refreshToken: 'r', scopes }),
  );
  const auth = new GoogleAuth({ client: resolveGoogleClient('ios', { iosClientId: CLIENT, webClientId: undefined }), store, authorizer: null });
  const api = new GoogleCalendarApi({ getAccessToken: (o) => auth.getAccessToken(o), sleep: async () => {}, random: () => 0 });
  return new GoogleCalendarProvider({ auth, api });
}

const meta: AppEventMeta = {
  v: 1,
  sessionId: 'sess-1',
  opId: 'op-42',
  timingState: 'interval',
  durationSec: 5400,
  durationSource: 'interval',
  schedulingPlaceholder: false,
};

const timedDraft: EventDraft = {
  title: '  Surf · La Fuente ',
  notes: 'Onde lunghe',
  location: 'La Fuente, https://maps.app.goo.gl/abc',
  allDay: false,
  start: { date: '2026-07-05', time: '07:30', timeZone: 'Europe/Rome' },
  end: { date: '2026-07-05', time: '09:00', timeZone: 'Europe/Rome' },
  colorId: '7',
  appMeta: meta,
};

async function rejection(p: Promise<unknown>): Promise<ProviderError> {
  try {
    await p;
  } catch (e) {
    return e as ProviderError;
  }
  throw new Error('expected a rejection');
}

describe('normalization: all-day', () => {
  it('keeps the exclusive end date of a single day', () => {
    const ev = normalizeGoogleEvent({ id: 'a', summary: 'Surf', start: { date: '2024-05-01' }, end: { date: '2024-05-02' } }, ctx)!;
    expect(ev.allDay).toBe(true);
    expect(ev.start).toEqual({ date: '2024-05-01', time: null, timeZone: null, instant: null });
    expect(ev.end).toEqual({ date: '2024-05-02', time: null, timeZone: null, instant: null });
  });

  it('normalizes a missing or non-advancing end to start + 1 day', () => {
    expect(normalizeGoogleEvent({ id: 'a', start: { date: '2024-02-28' } }, ctx)!.end.date).toBe('2024-02-29');
    expect(normalizeGoogleEvent({ id: 'a', start: { date: '2024-12-31' }, end: { date: '2024-12-31' } }, ctx)!.end.date).toBe('2025-01-01');
  });

  it('keeps the full span of a multi-day event (exclusive end)', () => {
    const ev = normalizeGoogleEvent({ id: 'trip', start: { date: '2024-08-01' }, end: { date: '2024-08-04' } }, ctx)!;
    expect([ev.start.date, ev.end.date]).toEqual(['2024-08-01', '2024-08-04']);
  });
});

describe('normalization: timed and DST', () => {
  it('spring-forward: wall times in the event zone, real elapsed time preserved', () => {
    const ev = normalizeGoogleEvent(
      { id: 't', start: { dateTime: '2024-03-31T01:30:00+01:00', timeZone: 'Europe/Rome' }, end: { dateTime: '2024-03-31T03:30:00+02:00', timeZone: 'Europe/Rome' } },
      ctx,
    )!;
    expect(ev.allDay).toBe(false);
    expect(ev.start).toEqual({ date: '2024-03-31', time: '01:30', timeZone: 'Europe/Rome', instant: '2024-03-31T00:30:00.000Z' });
    expect(ev.end).toEqual({ date: '2024-03-31', time: '03:30', timeZone: 'Europe/Rome', instant: '2024-03-31T01:30:00.000Z' });
  });

  it('fall-back: the two 02:30 in Rome map to distinct instants', () => {
    const first = normalizeGoogleEvent({ id: 'a', start: { dateTime: '2024-10-27T00:30:00Z', timeZone: 'Europe/Rome' } }, ctx)!;
    const second = normalizeGoogleEvent({ id: 'b', start: { dateTime: '2024-10-27T01:30:00Z', timeZone: 'Europe/Rome' } }, ctx)!;
    expect([first.start.date, first.start.time]).toEqual(['2024-10-27', '02:30']);
    expect([second.start.date, second.start.time]).toEqual(['2024-10-27', '02:30']);
    expect(Date.parse(second.start.instant!) - Date.parse(first.start.instant!)).toBe(3600_000);
  });

  it('uses the calendar zone when the event has none (local date can differ from UTC date)', () => {
    const ev = normalizeGoogleEvent({ id: 'la', start: { dateTime: '2024-07-01T06:00:00Z' }, end: { dateTime: '2024-07-01T07:30:00Z' } }, { ...ctx, calendarTimeZone: 'America/Los_Angeles' })!;
    expect(ev.start).toMatchObject({ date: '2024-06-30', time: '23:00', timeZone: 'America/Los_Angeles' });
    expect(ev.end).toMatchObject({ date: '2024-07-01', time: '00:30' });
  });

  it('without any zone keeps the wall time as written by Google', () => {
    const ev = normalizeGoogleEvent({ id: 'x', start: { dateTime: '2024-07-01T08:15:00+02:00' } }, { ...ctx, calendarTimeZone: null })!;
    expect(ev.start).toEqual({ date: '2024-07-01', time: '08:15', timeZone: null, instant: '2024-07-01T06:15:00.000Z' });
  });
});

describe('normalization: recurrence, status, labels, metadata', () => {
  const series = [
    {
      id: 'ser_20240106T090000Z',
      recurringEventId: 'ser',
      originalStartTime: { dateTime: '2024-01-06T10:00:00+01:00', timeZone: 'Europe/Rome' },
      start: { dateTime: '2024-01-06T10:00:00+01:00', timeZone: 'Europe/Rome' },
      end: { dateTime: '2024-01-06T11:00:00+01:00', timeZone: 'Europe/Rome' },
      summary: 'Surf club',
    },
    {
      // moved occurrence: new start, same identity
      id: 'ser_20240113T090000Z',
      recurringEventId: 'ser',
      originalStartTime: { dateTime: '2024-01-13T10:00:00+01:00', timeZone: 'Europe/Rome' },
      start: { dateTime: '2024-01-14T08:00:00+01:00', timeZone: 'Europe/Rome' },
      end: { dateTime: '2024-01-14T09:00:00+01:00', timeZone: 'Europe/Rome' },
      summary: 'Surf club',
    },
  ];

  it('recurring occurrences share recurringEventId and keep distinct occurrence keys', () => {
    const [a, b] = series.map((e) => normalizeGoogleEvent(e, ctx)!);
    expect(a.recurringEventId).toBe('ser');
    expect(b.recurringEventId).toBe('ser');
    expect(a.occurrenceKey).toBe('2024-01-06T09:00:00.000Z');
    expect(b.occurrenceKey).toBe('2024-01-13T09:00:00.000Z');
    expect(a.eventId).not.toBe(b.eventId);
    expect(b.start.date).toBe('2024-01-14');
  });

  it('all-day occurrence keys are dates; single events have none', () => {
    expect(normalizeGoogleEvent({ id: 'r_20240106', recurringEventId: 'r', originalStartTime: { date: '2024-01-06' }, start: { date: '2024-01-06' } }, ctx)!.occurrenceKey).toBe('2024-01-06');
    expect(normalizeGoogleEvent({ id: 'single', start: { date: '2024-01-06' } }, ctx)!.occurrenceKey).toBeNull();
  });

  it('a cancelled occurrence with only originalStartTime is still identifiable', () => {
    const ev = normalizeGoogleEvent({ id: 'ser_x', status: 'cancelled', recurringEventId: 'ser', originalStartTime: { dateTime: '2024-01-20T09:00:00Z' } }, ctx)!;
    expect(ev.status).toBe('cancelled');
    expect(ev.occurrenceKey).toBe('2024-01-20T09:00:00.000Z');
    expect(ev.start.date).toBe('2024-01-20');
  });

  it('maps colorId, notes, location, updated and app metadata', () => {
    const ev = normalizeGoogleEvent(
      { id: 'm', summary: 'Surf', description: 'note', location: 'Spot', colorId: '9', updated: '2026-01-01T00:00:00.000Z', start: { date: '2026-01-01' }, extendedProperties: { private: metaToPrivate(meta) } },
      ctx,
    )!;
    expect(ev).toMatchObject({ title: 'Surf', notes: 'note', location: 'Spot', colorId: '9', updated: '2026-01-01T00:00:00.000Z', status: 'confirmed', provider: 'google', accountId: ACCOUNT });
    expect(ev.appMeta).toEqual(meta);
  });
});

describe('app metadata round trip', () => {
  it('meta → private properties → meta', () => {
    expect(privateToMeta(metaToPrivate(meta))).toEqual(meta);
    const unknown: AppEventMeta = { ...meta, timingState: 'start_only', durationSec: null, durationSource: null, schedulingPlaceholder: true };
    const p = metaToPrivate(unknown);
    expect(p).toEqual({ serie_v: '1', serie_session: 'sess-1', serie_op: 'op-42', serie_timing: 'start_only', serie_sched: '1' });
    expect(privateToMeta(p)).toEqual(unknown);
  });

  it('rejects malformed or inconsistent metadata', () => {
    const p = metaToPrivate(meta);
    expect(privateToMeta(null)).toBeNull();
    expect(privateToMeta({ ...p, serie_v: '2' })).toBeNull();
    expect(privateToMeta({ ...p, serie_timing: 'all_day' })).toBeNull();
    expect(privateToMeta({ ...p, serie_dur: '1.5' })).toBeNull();
    expect(privateToMeta({ ...p, serie_dur: '0' })).toBeNull();
    expect(privateToMeta({ ...p, serie_src: 'guess' })).toBeNull();
    const { serie_src: _src, ...noSource } = p;
    expect(privateToMeta(noSource)).toBeNull();
    const { serie_op: _op, ...noOp } = p;
    expect(privateToMeta(noOp)).toBeNull();
  });
});

describe('draft → Google body', () => {
  it('timed: offset-qualified dateTime + timeZone, no attendees, no reminders, private metadata', () => {
    const b = draftToGoogleBody(timedDraft);
    expect(b).toEqual({
      summary: '  Surf · La Fuente ',
      description: 'Onde lunghe',
      location: 'La Fuente, https://maps.app.goo.gl/abc',
      colorId: '7',
      start: { dateTime: '2026-07-05T07:30:00+02:00', timeZone: 'Europe/Rome' },
      end: { dateTime: '2026-07-05T09:00:00+02:00', timeZone: 'Europe/Rome' },
      reminders: { useDefault: false, overrides: [] },
      extendedProperties: { private: metaToPrivate(meta) },
    });
    expect(b).not.toHaveProperty('attendees');
  });

  it('timed across midnight uses the explicit end date', () => {
    const b = draftToGoogleBody({ ...timedDraft, start: { date: '2026-01-10', time: '23:00', timeZone: 'Europe/Rome' }, end: { date: '2026-01-11', time: '01:00', timeZone: 'Europe/Rome' } });
    expect(b.end).toEqual({ dateTime: '2026-01-11T01:00:00+01:00', timeZone: 'Europe/Rome' });
  });

  it('all-day date marker: date + exclusive end; empty notes/location/colour omitted', () => {
    const b = draftToGoogleBody({
      ...timedDraft,
      allDay: true,
      notes: null,
      location: '',
      colorId: null,
      start: { date: '2026-10-10', time: null, timeZone: null },
      end: { date: '2026-10-10', time: null, timeZone: null },
      appMeta: { ...meta, timingState: 'date_only', durationSec: null, durationSource: null },
    });
    expect(b.start).toEqual({ date: '2026-10-10' });
    expect(b.end).toEqual({ date: '2026-10-11' });
    expect(b).not.toHaveProperty('description');
    expect(b).not.toHaveProperty('location');
    expect(b).not.toHaveProperty('colorId');
  });

  it('rejects invalid colours and non-positive intervals', () => {
    expect(() => draftToGoogleBody({ ...timedDraft, colorId: '12' })).toThrow(ProviderError);
    expect(() => draftToGoogleBody({ ...timedDraft, end: { ...timedDraft.end, time: '07:00' } })).toThrow(ProviderError);
    expect(() => draftToGoogleBody({ ...timedDraft, start: { ...timedDraft.start, timeZone: null } })).toThrow(ProviderError);
  });

  it('update merge replaces only Serie fields and keeps foreign properties', () => {
    const merged = mergeForUpdate(
      {
        id: 'e1',
        etag: '"1"',
        summary: 'old',
        description: 'old notes',
        colorId: '3',
        attendees: [{ email: 'friend@example.com' }],
        extendedProperties: { private: { other_app: 'x', serie_dur: '60', serie_src: 'declared' }, shared: { s: '1' } },
      },
      draftToGoogleBody({ ...timedDraft, notes: null, colorId: null, appMeta: { ...meta, durationSec: null, durationSource: null, timingState: 'start_only', schedulingPlaceholder: true } }),
    );
    expect(merged.summary).toBe('  Surf · La Fuente ');
    expect(merged).not.toHaveProperty('description');
    expect(merged).not.toHaveProperty('colorId');
    expect(merged.attendees).toEqual([{ email: 'friend@example.com' }]);
    expect(merged.extendedProperties).toEqual({
      private: { other_app: 'x', serie_v: '1', serie_session: 'sess-1', serie_op: 'op-42', serie_timing: 'start_only', serie_sched: '1' },
      shared: { s: '1' },
    });
  });
});

describe('GoogleCalendarProvider', () => {
  it('declares event labels and the google kind', () => {
    const p = mkProvider();
    expect(p.kind).toBe('google');
    expect(p.capabilities.eventLabels).toBe(true);
  });

  it('listLabels: event palette with Italian names', async () => {
    const palette = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [String(i + 1), { background: `#0000${String(i + 1).padStart(2, '0')}`, foreground: '#1d1d1d' }]));
    installFetch(() => ({ body: { event: palette, calendar: { '1': { background: '#fff', foreground: '#000' } } } }));
    const labels = await mkProvider().listLabels();
    expect(labels.map((l) => l.name)).toEqual(['Lavanda', 'Salvia', 'Uva', 'Fenicottero', 'Banana', 'Mandarino', 'Pavone', 'Grafite', 'Mirtillo', 'Basilico', 'Pomodoro']);
    expect(labels[0]).toEqual({ id: '1', name: 'Lavanda', color: '#000001' });
  });

  it('listCalendars maps accessRole and granted scopes to canRead/canWrite', async () => {
    installFetch(() => ({
      body: {
        items: [
          { id: ACCOUNT, summary: ACCOUNT, accessRole: 'owner', primary: true, backgroundColor: '#9fe1e7', timeZone: 'Europe/Rome' },
          { id: 'club@group.calendar.google.com', summary: 'Club', summaryOverride: 'Surf club', accessRole: 'writer' },
          { id: 'it.italian#holiday@group.v.calendar.google.com', summary: 'Festività', accessRole: 'reader' },
          { id: 'busy@example.com', summary: 'Busy', accessRole: 'freeBusyReader' },
        ],
      },
    }));
    const cals = await mkProvider().listCalendars();
    expect(cals.map((c) => [c.title, c.access, c.canRead, c.canWrite, c.isPrimary])).toEqual([
      [ACCOUNT, 'owner', true, true, true],
      ['Surf club', 'writer', true, true, false],
      ['Festività', 'reader', true, false, false],
      ['Busy', 'freeBusyReader', false, false, false],
    ]);
    expect(cals[0]).toMatchObject({ provider: 'google', accountId: ACCOUNT, accountLabel: ACCOUNT, calendarId: ACCOUNT, color: '#9fe1e7', sourceType: null });

    const readOnly = await mkProvider(['openid', 'email', GOOGLE_SCOPES.read]).listCalendars();
    expect(readOnly[0]).toMatchObject({ canRead: true, canWrite: false });
  });

  it('listEvents: 3-year range hits every chunk and page, filters by local start date, reports progress', async () => {
    const { calls } = installFetch((c) => {
      const year = Number(c.params.get('timeMin')!.slice(0, 4));
      const second = c.params.get('pageToken') === 'p2';
      const items: GCalEvent[] = second
        ? [{ id: `${year}-b`, summary: 'Surf', start: { dateTime: `${year}-09-01T07:00:00Z` }, end: { dateTime: `${year}-09-01T08:00:00Z` } }]
        : [{ id: `${year}-a`, summary: 'Surf', start: { date: `${year}-05-01` }, end: { date: `${year}-05-02` } }];
      // An event before the requested start, returned because it overlaps the widened window.
      if (year === 2022 && !second) items.unshift({ id: 'early', summary: 'x', start: { date: '2022-03-14' }, end: { date: '2022-03-16' } });
      return { body: { timeZone: 'Europe/Lisbon', items, nextPageToken: second ? undefined : 'p2' } };
    });
    const progress: number[] = [];
    const evs = await mkProvider().listEvents({ calendarIds: ['primary', 'primary'], from: '2022-03-15', to: '2024-12-31', onProgress: (n) => progress.push(n) });

    expect(calls).toHaveLength(6);
    expect(new Set(calls.map((c) => c.params.get('timeMin')))).toEqual(new Set(['2022-03-15T00:00:00+14:00', '2023-01-01T00:00:00+14:00', '2024-01-01T00:00:00+14:00']));
    expect(evs.map((e) => e.eventId)).toEqual(['2022-a', '2022-b', '2023-a', '2023-b', '2024-a', '2024-b']);
    expect(evs.every((e) => e.accountId === ACCOUNT && e.calendarId === 'primary')).toBe(true);
    expect(evs[1].start).toMatchObject({ time: '08:00', timeZone: 'Europe/Lisbon' });
    expect(progress[progress.length - 1]).toBe(7);
  });

  it('listEvents excludes cancelled occurrences unless requested', async () => {
    const { calls } = installFetch((c) => {
      const items: object[] = [
        { id: 'ser_1', recurringEventId: 'ser', originalStartTime: { date: '2026-02-01' }, start: { date: '2026-02-01' }, end: { date: '2026-02-02' }, summary: 'Surf' },
        { id: 'solo', status: 'cancelled', start: { date: '2026-02-03' }, end: { date: '2026-02-04' }, summary: 'Surf' },
      ];
      if (c.params.get('showDeleted') === 'true') items.push({ id: 'ser_2', status: 'cancelled', recurringEventId: 'ser', originalStartTime: { date: '2026-02-08' } });
      return { body: { items } };
    });
    const p = mkProvider();
    const normal = await p.listEvents({ calendarIds: ['primary'], from: '2026-02-01', to: '2026-02-28' });
    expect(normal.map((e) => e.eventId)).toEqual(['ser_1']);
    expect(calls[0].params.has('showDeleted')).toBe(false);

    const all = await p.listEvents({ calendarIds: ['primary'], from: '2026-02-01', to: '2026-02-28', includeCancelled: true });
    expect(all.map((e) => [e.eventId, e.status, e.occurrenceKey])).toEqual([
      ['ser_1', 'confirmed', '2026-02-01'],
      ['solo', 'cancelled', null],
      ['ser_2', 'cancelled', '2026-02-08'],
    ]);
    expect(calls[1].params.get('showDeleted')).toBe('true');
  });

  it('read operations refuse a connection without read scope (no fake duplicate checks)', async () => {
    const { calls } = installFetch(() => ({ body: { items: [] } }));
    const p = mkProvider(['openid', 'email', GOOGLE_SCOPES.write]);
    expect((await p.getConnection()).status).toBe('write_only');
    expect((await rejection(p.listEvents({ calendarIds: ['primary'], from: '2026-01-01', to: '2026-01-31' }))).code).toBe('forbidden');
    // the calendar list is not read either: only the primary calendar is offered as a destination
    expect((await p.listCalendars()).map((c) => c.canRead)).toEqual([false]);
    expect(calls).toHaveLength(0);
  });

  it('createEvent: POST sendUpdates=none, no attendees, reminders off, metadata round trip', async () => {
    const { calls } = installFetch((c) => ({ body: { ...c.json, id: 'created1', status: 'confirmed', updated: '2026-07-05T10:00:00.000Z' } }));
    const ev = await mkProvider().createEvent('primary', timedDraft);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].path).toBe('/calendar/v3/calendars/primary/events');
    expect(calls[0].params.get('sendUpdates')).toBe('none');
    expect(calls[0].json).not.toHaveProperty('attendees');
    expect(calls[0].json.reminders).toEqual({ useDefault: false, overrides: [] });
    expect(calls[0].json.extendedProperties.private.serie_op).toBe('op-42');
    expect(ev).toMatchObject({ eventId: 'created1', title: '  Surf · La Fuente ', allDay: false, colorId: '7' });
    expect(ev.start).toMatchObject({ date: '2026-07-05', time: '07:30', timeZone: 'Europe/Rome' });
    expect(ev.appMeta).toEqual(meta);
  });

  it('createEvent: a 5xx surfaces as uncertain; read-only connection is refused before any request', async () => {
    installFetch(() => ({ status: 500 }));
    expect((await rejection(mkProvider().createEvent('primary', timedDraft))).code).toBe('uncertain');
    const { calls } = installFetch(() => ({ body: {} }));
    expect((await rejection(mkProvider(['openid', 'email', GOOGLE_SCOPES.read]).createEvent('primary', timedDraft))).code).toBe('forbidden');
    expect(calls).toHaveLength(0);
  });

  it('findByOpId filters on serie_op inside the window', async () => {
    const { calls } = installFetch(() => ({
      body: {
        items: [
          { id: 'other', start: { date: '2026-07-05' }, extendedProperties: { private: metaToPrivate({ ...meta, opId: 'op-1' }) } },
          { id: 'mine', start: { date: '2026-07-05' }, extendedProperties: { private: metaToPrivate(meta) } },
        ],
      },
    }));
    const ev = await mkProvider().findByOpId('primary', 'op-42', { from: '2026-07-04', to: '2026-07-06' });
    expect(ev?.eventId).toBe('mine');
    expect(calls[0].url).toContain('privateExtendedProperty=serie_op%3Dop-42');
    expect(calls[0].params.get('timeMin')).toBe('2026-07-04T00:00:00+14:00');
  });

  it('findByOpId returns null when nothing matches', async () => {
    installFetch(() => ({ body: { items: [] } }));
    expect(await mkProvider().findByOpId('primary', 'op-404', { from: '2026-07-04', to: '2026-07-06' })).toBeNull();
  });

  it('getEvent: 404 → null; series id + occurrence key → that occurrence', async () => {
    installFetch((c) => {
      if (c.path.endsWith('/calendarList/primary')) return { body: { id: 'primary', timeZone: 'Europe/Rome' } };
      if (c.path.endsWith('/events/missing')) return { status: 404 };
      if (c.path.endsWith('/events/ser/instances'))
        return {
          body: {
            items: [
              { id: 'ser_a', recurringEventId: 'ser', originalStartTime: { dateTime: '2024-01-06T09:00:00Z' }, start: { dateTime: '2024-01-06T09:00:00Z' } },
              { id: 'ser_b', recurringEventId: 'ser', originalStartTime: { dateTime: '2024-01-13T09:00:00Z' }, start: { dateTime: '2024-01-13T09:00:00Z' } },
            ],
          },
        };
      return { body: { id: 'ser', recurrence: ['RRULE:FREQ=WEEKLY'], start: { dateTime: '2024-01-06T10:00:00+01:00', timeZone: 'Europe/Rome' } } };
    });
    const p = mkProvider();
    expect(await p.getEvent('primary', 'missing')).toBeNull();
    const occ = await p.getEvent('primary', 'ser', '2024-01-13T09:00:00.000Z');
    expect(occ?.eventId).toBe('ser_b');
    expect(occ?.start).toMatchObject({ time: '10:00', timeZone: 'Europe/Rome' });
  });

  it('updateEvent: read, replace Serie fields, PUT with If-Match and sendUpdates=none', async () => {
    const existing = {
      id: 'e1',
      etag: '"etag-1"',
      summary: 'Old',
      colorId: '3',
      start: { date: '2026-07-05' },
      end: { date: '2026-07-06' },
      extendedProperties: { private: { other_app: 'keep', ...metaToPrivate(meta) } },
    };
    const { calls } = installFetch((c) => {
      if (c.path.endsWith('/calendarList/primary')) return { body: { id: 'primary', timeZone: 'Europe/Rome' } };
      if (c.method === 'GET') return { body: existing };
      return { body: { ...c.json, etag: '"etag-2"' } };
    });
    const ev = await mkProvider().updateEvent('primary', 'e1', { ...timedDraft, colorId: null });
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.path).toBe('/calendar/v3/calendars/primary/events/e1');
    expect(put.headers['If-Match']).toBe('"etag-1"');
    expect(put.params.get('sendUpdates')).toBe('none');
    expect(put.json).not.toHaveProperty('colorId');
    expect(put.json).not.toHaveProperty('attendees');
    expect(put.json.extendedProperties.private.other_app).toBe('keep');
    expect(put.json.start).toEqual({ dateTime: '2026-07-05T07:30:00+02:00', timeZone: 'Europe/Rome' });
    expect(ev).toMatchObject({ eventId: 'e1', allDay: false, colorId: null });
  });

  it('updateEvent on a vanished event → not_found', async () => {
    installFetch((c) => (c.path.includes('/events/') ? { status: 404 } : { body: { id: 'primary', timeZone: 'Europe/Rome' } }));
    expect((await rejection(mkProvider().updateEvent('primary', 'gone', timedDraft))).code).toBe('not_found');
  });

  it('not connected → unauthorized; not configured → unavailable', async () => {
    const auth = new GoogleAuth({ client: resolveGoogleClient('ios', { iosClientId: CLIENT, webClientId: undefined }), store: new MemoryTokenStore(), authorizer: null });
    const api = new GoogleCalendarApi({ getAccessToken: (o) => auth.getAccessToken(o) });
    expect((await rejection(new GoogleCalendarProvider({ auth, api }).listLabels())).code).toBe('unauthorized');

    const unconfigured = new GoogleAuth({ client: resolveGoogleClient('ios', { iosClientId: undefined, webClientId: undefined }), store: new MemoryTokenStore(), authorizer: null });
    const p2 = new GoogleCalendarProvider({ auth: unconfigured, api: new GoogleCalendarApi({ getAccessToken: (o) => unconfigured.getAccessToken(o) }) });
    expect((await p2.getConnection()).status).toBe('not_configured');
    expect((await rejection(p2.listCalendars())).code).toBe('unavailable');
  });
});

describe('GoogleCalendarProvider regressions', () => {
  const calList = (c: { path: string }) => (c.path.endsWith('/calendarList/primary') ? { body: { id: 'primary', timeZone: 'Europe/Rome' } } : null);

  it('updateEvent refuses an event deleted on Google (no PUT that "updates" an invisible event)', async () => {
    const { calls } = installFetch(
      (c) =>
        calList(c) ??
        (c.method === 'GET'
          ? { body: { id: 'e1', status: 'cancelled', etag: '"1"', start: { date: '2026-07-05' }, end: { date: '2026-07-06' }, extendedProperties: { private: metaToPrivate(meta) } } }
          : { body: { ...c.json } }),
    );
    const e = await rejection(mkProvider().updateEvent('primary', 'e1', timedDraft));
    expect(e.code).toBe('not_found');
    expect(calls.some((c) => c.method === 'PUT' || c.method === 'PATCH')).toBe(false);
  });

  it('updateEvent never rewrites a whole recurring series; an occurrence key targets one instance', async () => {
    const { calls } = installFetch((c) => {
      const cl = calList(c);
      if (cl) return cl;
      if (c.path.endsWith('/events/ser/instances'))
        return { body: { items: [{ id: 'ser_b', etag: '"i"', recurringEventId: 'ser', originalStartTime: { dateTime: '2024-01-13T09:00:00Z' }, start: { dateTime: '2024-01-13T09:00:00Z' }, end: { dateTime: '2024-01-13T10:00:00Z' } }] } };
      if (c.method === 'GET') return { body: { id: 'ser', etag: '"s"', recurrence: ['RRULE:FREQ=WEEKLY'], start: { dateTime: '2024-01-06T10:00:00+01:00', timeZone: 'Europe/Rome' }, end: { dateTime: '2024-01-06T11:00:00+01:00', timeZone: 'Europe/Rome' } } };
      return { body: { ...c.json } };
    });
    const p = mkProvider();
    expect((await rejection(p.updateEvent('primary', 'ser', timedDraft))).code).toBe('invalid');
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);

    const ev = await p.updateEvent('primary', 'ser', timedDraft, '2024-01-13T09:00:00.000Z');
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.path).toBe('/calendar/v3/calendars/primary/events/ser_b');
    expect(put.headers['If-Match']).toBe('"i"');
    expect(ev.recurringEventId).toBe('ser');
  });

  it('findByOpId: an event of this operation with unreadable metadata is a conflict, never "not found"', async () => {
    installFetch(() => ({
      body: { items: [{ id: 'mine', start: { date: '2026-07-05' }, extendedProperties: { private: { ...metaToPrivate(meta), serie_v: '2' } } }] },
    }));
    const e = await rejection(mkProvider().findByOpId('primary', 'op-42', { from: '2026-07-04', to: '2026-07-06' }));
    expect(e.code).toBe('conflict');
    expect(e.retryable).toBe(false);
  });

  it('findByOpId ignores a cancelled event of the operation (deleted → may be recreated)', async () => {
    installFetch(() => ({ body: { items: [{ id: 'gone', status: 'cancelled', start: { date: '2026-07-05' }, extendedProperties: { private: { serie_op: 'op-42' } } }] } }));
    expect(await mkProvider().findByOpId('primary', 'op-42', { from: '2026-07-04', to: '2026-07-06' })).toBeNull();
  });

  it('listEvents refuses a free/busy-only calendar instead of listing untitled busy blocks', async () => {
    installFetch(() => ({ body: { accessRole: 'freeBusyReader', items: [{ id: 'b1', start: { dateTime: '2026-02-01T09:00:00Z' }, end: { dateTime: '2026-02-01T10:00:00Z' } }] } }));
    const e = await rejection(mkProvider().listEvents({ calendarIds: ['busy@example.com'], from: '2026-02-01', to: '2026-02-28' }));
    expect(e.code).toBe('forbidden');
  });

  it('listLabels with write-only consent fails before calling colors.get (it does not accept calendar.events)', async () => {
    const { calls } = installFetch(() => ({ body: { event: {} } }));
    expect((await rejection(mkProvider(['openid', 'email', GOOGLE_SCOPES.write]).listLabels())).code).toBe('forbidden');
    expect(calls).toHaveLength(0);
  });

  it('write-only consent offers the primary calendar as the only destination, without reading the calendar list', async () => {
    const { calls } = installFetch(() => ({ body: { items: [] } }));
    const cals = await mkProvider(['openid', 'email', GOOGLE_SCOPES.write]).listCalendars();
    expect(calls).toHaveLength(0);
    expect(cals).toHaveLength(1);
    expect(cals[0]).toMatchObject({ provider: 'google', isPrimary: true, canWrite: true, canRead: false });
    expect(cals[0].calendarId).toBe(cals[0].accountId);
  });

  it('metadata with a duration beyond the safe integer range is rejected', () => {
    expect(privateToMeta({ ...metaToPrivate(meta), serie_dur: '99999999999999999999' })).toBeNull();
  });

  it('updating a linked manual event keeps its own reminders (Serie adds none and strips none)', () => {
    const own = { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] };
    const merged = mergeForUpdate({ id: 'm1', reminders: own, start: { date: '2026-07-05' } }, draftToGoogleBody(timedDraft));
    expect(merged.reminders).toEqual(own);
    const bare = mergeForUpdate({ id: 'm2', start: { date: '2026-07-05' } }, draftToGoogleBody(timedDraft));
    expect(bare.reminders).toEqual({ useDefault: false, overrides: [] });
  });

  it('listEvents is complete at zone extremes and year/DST boundaries against Google-style time filtering', async () => {
    // A fake events.list that filters like Google (end > timeMin, start < timeMax) and pages 2 items at a time.
    const zoned = (id: string, start: string, end: string, timeZone: string): GCalEvent => ({ id, summary: id, start: { dateTime: start, timeZone }, end: { dateTime: end, timeZone } });
    const allDay = (id: string, start: string, end: string): GCalEvent => ({ id, summary: id, start: { date: start }, end: { date: end } });
    const all: GCalEvent[] = [
      zoned('kiritimati-nye', '2022-12-31T23:30:00+14:00', '2023-01-01T00:30:00+14:00', 'Pacific/Kiritimati'), // local 2022-12-31
      // Outer edges: local date in range, UTC date outside it (no neighbouring chunk can pick these up).
      zoned('kiritimati-first-day', '2022-03-15T05:00:00+14:00', '2022-03-15T06:00:00+14:00', 'Pacific/Kiritimati'), // 2022-03-14T15:00Z
      zoned('gmt12-last-day', '2024-12-31T20:00:00-12:00', '2024-12-31T21:00:00-12:00', 'Etc/GMT+12'), // 2025-01-01T08:00Z
      zoned('gmt12-newyear', '2024-01-01T00:30:00-12:00', '2024-01-01T01:30:00-12:00', 'Etc/GMT+12'), // local 2024-01-01
      zoned('rome-spring', '2023-03-26T01:30:00+01:00', '2023-03-26T03:30:00+02:00', 'Europe/Rome'),
      zoned('rome-fall', '2023-10-29T02:30:00+01:00', '2023-10-29T03:30:00+01:00', 'Europe/Rome'),
      allDay('allday-yearend', '2023-12-31', '2024-01-02'),
      allDay('before-range', '2022-03-10', '2022-03-20'), // starts before `from`: anchored to its start date → excluded
      zoned('after-range', '2025-01-01T00:10:00+01:00', '2025-01-01T01:00:00+01:00', 'Europe/Rome'),
      ...Array.from({ length: 5 }, (_, i) => allDay(`bulk-${i}`, `2024-06-0${i + 1}`, `2024-06-0${i + 2}`)),
    ];
    const bounds = (e: GCalEvent) => ({
      s: Date.parse(e.start!.dateTime ?? `${e.start!.date}T00:00:00+01:00`),
      e: Date.parse(e.end!.dateTime ?? `${e.end!.date}T00:00:00+01:00`),
    });
    const { calls } = installFetch((c) => {
      const min = Date.parse(c.params.get('timeMin')!);
      const max = Date.parse(c.params.get('timeMax')!);
      const hits = all.filter((e) => bounds(e).e > min && bounds(e).s < max).sort((a, b) => bounds(a).s - bounds(b).s);
      const offset = Number(c.params.get('pageToken') ?? 0);
      const next = offset + 2 < hits.length ? String(offset + 2) : undefined;
      return { body: { timeZone: 'Europe/Rome', items: hits.slice(offset, offset + 2), nextPageToken: next } };
    });
    const evs = await mkProvider().listEvents({ calendarIds: ['primary'], from: '2022-03-15', to: '2024-12-31' });
    expect(evs.map((e) => e.eventId).sort()).toEqual(
      ['kiritimati-nye', 'kiritimati-first-day', 'gmt12-last-day', 'gmt12-newyear', 'rome-spring', 'rome-fall', 'allday-yearend', 'bulk-0', 'bulk-1', 'bulk-2', 'bulk-3', 'bulk-4'].sort(),
    );
    expect(new Set(evs.map((e) => e.eventId)).size).toBe(evs.length);
    expect(evs.find((e) => e.eventId === 'kiritimati-nye')!.start).toMatchObject({ date: '2022-12-31', time: '23:30' });
    expect(evs.find((e) => e.eventId === 'gmt12-newyear')!.start).toMatchObject({ date: '2024-01-01', time: '00:30' });
    expect(evs.find((e) => e.eventId === 'rome-fall')!.start).toMatchObject({ date: '2023-10-29', time: '02:30' });
    expect(new Set(calls.map((c) => c.params.get('timeMin')!.slice(0, 4)))).toEqual(new Set(['2022', '2023', '2024']));
    expect(calls.length).toBeGreaterThan(3); // several pages per chunk were followed
  });
});
