import * as ExpoCal from 'expo-calendar';
import * as ExpoCalLegacy from 'expo-calendar/legacy';
import { Platform } from 'react-native';

import type { AppEventMeta, EventDraft } from '../../types';
import { ProviderError } from '../../types';
import { t } from '@/i18n/it';
import { addDays, diffDays } from '@/domain/dates';
import { epochToZoned } from '@/domain/zoned';
import { APPLE_DISCONNECTED_KEY, createAppleCalendarProvider, type AppleSettingsStore } from '../provider';
import { metaFromUrl, metaToUrl, splitNotesMeta } from '../meta';
import { FakeCalendar, FakeStore, installFake } from './fakeEventKit';

jest.mock('expo-calendar', () => ({
  EntityTypes: { EVENT: 'event', REMINDER: 'reminder' },
  getCalendarPermissions: jest.fn(),
  requestCalendarPermissions: jest.fn(),
  getCalendars: jest.fn(),
  getDefaultCalendarSync: jest.fn(),
  ExpoCalendar: { get: jest.fn() },
  ExpoCalendarEvent: { get: jest.fn() },
}));
jest.mock('expo-calendar/legacy', () => ({ getEventAsync: jest.fn() }));

const TZ = 'Europe/Rome';
const mod = ExpoCal as unknown as Record<string, jest.Mock> & { ExpoCalendar: { get: jest.Mock }; ExpoCalendarEvent: { get: jest.Mock } };
const legacy = ExpoCalLegacy as unknown as Record<string, jest.Mock>;

let store: FakeStore;
let surf: FakeCalendar;
let work: FakeCalendar;

const ios = () => createAppleCalendarProvider({ platformOS: () => 'ios', deviceTimeZone: () => TZ });

const META: AppEventMeta = {
  v: 1,
  sessionId: 'sess-1',
  opId: 'op-sess-1-apple',
  timingState: 'interval',
  durationSec: 5400,
  durationSource: 'interval',
  schedulingPlaceholder: false,
};

const timedDraft: EventDraft = {
  title: 'Surf',
  notes: 'Mare formato',
  location: 'La Fuente',
  allDay: false,
  start: { date: '2026-07-10', time: '07:30', timeZone: TZ },
  end: { date: '2026-07-10', time: '09:00', timeZone: TZ },
  colorId: null,
  appMeta: META,
};

beforeEach(() => {
  jest.clearAllMocks();
  store = new FakeStore();
  surf = new FakeCalendar('CAL-SURF', 'Surf', { id: 'SRC-ICLOUD', type: 'caldav', name: 'iCloud' }, true, 'caldav', '#1BADF8');
  work = new FakeCalendar('CAL-WORK', 'Lavoro', { id: 'SRC-GOOGLE', type: 'caldav', name: 'a@b.com' }, true, 'caldav', '#FF2968');
  const holidays = new FakeCalendar('CAL-HOL', 'Festività', { id: 'SRC-SUB', type: 'subscribed', name: 'Calendari iscritti' }, false, 'subscribed');
  store.calendars = [surf, work, holidays];
  store.defaultCalendarId = 'CAL-WORK';
  installFake(mod, store, legacy);
});

describe('connection & permissions', () => {
  it('full access → connected; getConnection never prompts', async () => {
    const c = await ios().getConnection();
    expect(c).toEqual({ provider: 'apple', status: 'connected', accountId: null, accountLabel: null, canRead: true, canWrite: true, detail: null });
    expect(mod.requestCalendarPermissions).not.toHaveBeenCalled();
    expect(mod.getCalendarPermissions).toHaveBeenCalledWith(false);
  });

  it('iOS 17 write-only → write_only, canRead=false, canWrite=true, explains missing import/duplicate checks', async () => {
    store.fullStatus = 'denied'; // the full-access requester reports .writeOnly as denied
    store.writeOnlyGranted = true;
    const p = ios();
    const c = await p.getConnection();
    expect(c).toMatchObject({ status: 'write_only', canRead: false, canWrite: true, detail: t.writeOnly });
    expect(mod.getCalendarPermissions).toHaveBeenCalledWith(true);
    await expect(p.listEvents({ calendarIds: ['VIRTUAL'], from: '2026-01-01', to: '2026-01-31' })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(p.findByOpId('VIRTUAL', 'op', { from: '2026-01-01', to: '2026-01-02' })).rejects.toMatchObject({ code: 'forbidden' });
    const cals = await p.listCalendars();
    expect(cals).toHaveLength(1);
    expect(cals[0]).toMatchObject({ calendarId: 'VIRTUAL', canRead: false });
  });

  it('denied → denied with the Settings hint; never asked → disconnected', async () => {
    store.fullStatus = 'denied';
    expect(await ios().getConnection()).toMatchObject({ status: 'denied', canRead: false, canWrite: false, detail: t.permissionDenied });
    store.fullStatus = 'undetermined';
    expect(await ios().getConnection()).toMatchObject({ status: 'disconnected', canRead: false, canWrite: false });
    await expect(ios().listCalendars()).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('connect() requests FULL access only (never write-only) and reports the result', async () => {
    store.fullStatus = 'undetermined';
    const c = await ios().connect('readwrite');
    expect(mod.requestCalendarPermissions).toHaveBeenCalledTimes(1);
    expect(mod.requestCalendarPermissions).toHaveBeenCalledWith(false);
    expect(c.status).toBe('connected');
  });

  it('missing Info.plist usage string → not_configured, honestly', async () => {
    store.missingPlist = true;
    expect(await ios().getConnection()).toMatchObject({ status: 'not_configured', canRead: false, canWrite: false });
    expect(await ios().connect('read')).toMatchObject({ status: 'not_configured' });
  });

  it('Expo Go (Calendar@next stub) → unavailable with an explanation, not a crash', async () => {
    const stub = new Error('Calendar@next functionality is not available in Expo Go');
    mod.getCalendarPermissions.mockRejectedValue(stub);
    mod.requestCalendarPermissions.mockRejectedValue(stub);
    const p = ios();
    expect(await p.getConnection()).toMatchObject({ status: 'unavailable', detail: expect.stringContaining('development build') });
    expect(await p.connect('read')).toMatchObject({ status: 'unavailable' });
    await expect(p.listCalendars()).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('Expo Go as it really is: root functions are undefined (stub class) → unavailable with the Expo Go note, never a raw TypeError', async () => {
    const m = jest.requireMock<Record<string, unknown>>('expo-calendar'); // the object the provider reads (not the wildcard copy)
    const saved = { g: m.getCalendarPermissions, r: m.requestCalendarPermissions };
    m.getCalendarPermissions = undefined;
    m.requestCalendarPermissions = undefined;
    try {
      const p = ios();
      expect(await p.getConnection()).toMatchObject({ status: 'unavailable', canRead: false, canWrite: false, detail: expect.stringContaining('Expo Go') });
      expect(await p.connect('readwrite')).toMatchObject({ status: 'unavailable', detail: expect.stringContaining('Expo Go') });
      await expect(p.listCalendars()).rejects.toMatchObject({ code: 'unavailable', message: expect.stringContaining('Expo Go') });
      await expect(p.createEvent('CAL-SURF', timedDraft)).rejects.toMatchObject({ code: 'unavailable' });
    } finally {
      m.getCalendarPermissions = saved.g;
      m.requestCalendarPermissions = saved.r;
    }
  });

  it('fails closed when the "disconnected in Serie" flag cannot be read', async () => {
    let broken = true;
    const settings: AppleSettingsStore = {
      get: async <T,>(_k: string, f: T) => {
        if (broken) throw new Error('db locked');
        return f;
      },
      set: async () => undefined,
    };
    const p = createAppleCalendarProvider({ platformOS: () => 'ios', deviceTimeZone: () => TZ, settings });
    expect((await p.getConnection()).status).toBe('disconnected');
    await expect(p.createEvent('CAL-SURF', timedDraft)).rejects.toMatchObject({ code: 'unauthorized' });
    expect(surf.createEvent).not.toHaveBeenCalled();
    broken = false; // not cached: a later successful read is honoured
    expect((await p.getConnection()).status).toBe('connected');
  });

  it('web → unavailable without touching expo-calendar', async () => {
    const restore = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      const p = createAppleCalendarProvider({ deviceTimeZone: () => TZ });
      expect(await p.getConnection()).toMatchObject({ status: 'unavailable', canRead: false, canWrite: false, detail: t.unavailablePlatform });
      expect(await p.connect('readwrite')).toMatchObject({ status: 'unavailable' });
      await expect(p.listCalendars()).rejects.toMatchObject({ code: 'unavailable' });
      await expect(p.createEvent('X', timedDraft)).rejects.toBeInstanceOf(ProviderError);
      expect(mod.getCalendarPermissions).not.toHaveBeenCalled();
      expect(mod.requestCalendarPermissions).not.toHaveBeenCalled();
    } finally {
      restore.restore();
    }
  });

  it('disconnect() is honoured (and persisted) until connect()', async () => {
    const kv = new Map<string, unknown>();
    const settings: AppleSettingsStore = {
      get: async <T,>(k: string, f: T) => (kv.has(k) ? (kv.get(k) as T) : f),
      set: async <T,>(k: string, v: T) => void kv.set(k, v),
    };
    const p = createAppleCalendarProvider({ platformOS: () => 'ios', deviceTimeZone: () => TZ, settings });
    await p.disconnect();
    expect(kv.get(APPLE_DISCONNECTED_KEY)).toBe(true);
    expect(await p.getConnection()).toMatchObject({ status: 'disconnected', canRead: false, canWrite: false });
    await expect(p.listCalendars()).rejects.toMatchObject({ code: 'unauthorized' });
    // a fresh instance (next launch) still sees the flag
    const again = createAppleCalendarProvider({ platformOS: () => 'ios', deviceTimeZone: () => TZ, settings });
    expect((await again.getConnection()).status).toBe('disconnected');
    expect((await again.connect('read')).status).toBe('connected');
    expect(kv.get(APPLE_DISCONNECTED_KEY)).toBe(false);
  });
});

describe('listCalendars / labels', () => {
  it('lists event calendars with source as account, writability and default flag', async () => {
    const p = ios();
    const cals = await p.listCalendars();
    expect(mod.getCalendars).toHaveBeenCalledWith('event');
    const byId = Object.fromEntries(cals.map((c) => [c.calendarId, c]));
    expect(byId['CAL-WORK']).toMatchObject({ provider: 'apple', accountId: 'SRC-GOOGLE', accountLabel: 'a@b.com', sourceType: 'caldav', sourceName: 'a@b.com', color: '#FF2968', canRead: true, canWrite: true, isPrimary: true });
    expect(byId['CAL-SURF']).toMatchObject({ accountId: 'SRC-ICLOUD', accountLabel: 'iCloud', isPrimary: false });
    expect(byId['CAL-HOL']).toMatchObject({ canWrite: false, access: 'reader' });
  });

  it('has no labels', async () => {
    const p = ios();
    expect(p.capabilities.eventLabels).toBe(false);
    expect(await p.listLabels()).toEqual([]);
  });
});

describe('listEvents', () => {
  it('chunks multi-year ranges into ≤1-year predicates and returns events from every year', async () => {
    for (let y = 2016; y <= 2026; y++) {
      surf.add({ id: `S${y}`, title: `Surf ${y}`, startDate: `${y}-06-15T06:00:00.000Z`, endDate: `${y}-06-15T07:30:00.000Z` });
    }
    // a New Year's Eve session crossing a chunk boundary must not be duplicated
    surf.add({ id: 'NYE', title: 'Surf notturno', startDate: '2020-12-31T22:00:00.000Z', endDate: '2021-01-01T01:00:00.000Z' });
    const progress: number[] = [];
    const out = await ios().listEvents({ calendarIds: ['CAL-SURF'], from: '2016-01-01', to: '2026-10-11', onProgress: (n) => progress.push(n) });

    expect(out.map((e) => e.eventId)).toEqual([...Array.from({ length: 5 }, (_, i) => `S${2016 + i}`), 'NYE', ...Array.from({ length: 6 }, (_, i) => `S${2021 + i}`)]);
    expect(surf.listCalls.length).toBeGreaterThanOrEqual(11);
    for (const c of surf.listCalls) expect(c.end.getTime() - c.start.getTime()).toBeLessThanOrEqual(366 * 86400000);
    for (let i = 1; i < surf.listCalls.length; i++) expect(surf.listCalls[i].start.getTime()).toBe(surf.listCalls[i - 1].end.getTime());
    expect(epochToZoned(surf.listCalls[0].start.getTime(), TZ)).toEqual({ date: '2016-01-01', time: '00:00' });
    expect(epochToZoned(surf.listCalls[surf.listCalls.length - 1].end.getTime(), TZ)).toEqual({ date: '2026-10-12', time: '00:00' });
    expect(progress[progress.length - 1]).toBe(12);
    expect(out.every((e) => e.provider === 'apple' && e.accountId === 'SRC-ICLOUD' && e.calendarId === 'CAL-SURF')).toBe(true);
  });

  it('queries only the selected calendars and fails loudly on a missing one', async () => {
    work.add({ id: 'W1', title: 'Riunione', startDate: '2026-03-05T08:00:00.000Z', endDate: '2026-03-05T09:00:00.000Z' });
    surf.add({ id: 'S1', title: 'Surf', startDate: '2026-03-05T06:00:00.000Z', endDate: '2026-03-05T07:00:00.000Z' });
    const p = ios();
    const out = await p.listEvents({ calendarIds: ['CAL-SURF'], from: '2026-03-01', to: '2026-03-31' });
    expect(out.map((e) => e.eventId)).toEqual(['S1']);
    expect(work.listEvents).not.toHaveBeenCalled();
    await expect(p.listEvents({ calendarIds: ['CAL-SURF', 'GONE'], from: '2026-03-01', to: '2026-03-31' })).rejects.toMatchObject({ code: 'not_found' });
    expect(await p.listEvents({ calendarIds: [], from: '2026-03-01', to: '2026-03-31' })).toEqual([]);
  });

  it('expands recurring occurrences with distinct identity and excludes cancelled ones unless asked', async () => {
    const weekly = { frequency: 'weekly' };
    for (const d of ['05', '12', '19', '26']) {
      surf.add({ id: 'SERIES', title: 'Surf club', recurrenceRule: weekly, startDate: `2026-03-${d}T07:00:00.000Z`, endDate: `2026-03-${d}T08:30:00.000Z`, originalStartDate: `2026-03-${d}T07:00:00.000Z`, status: d === '19' ? 'cancelled' : 'confirmed' });
    }
    const p = ios();
    const out = await p.listEvents({ calendarIds: ['CAL-SURF'], from: '2026-03-01', to: '2026-03-31' });
    expect(out).toHaveLength(3);
    expect(new Set(out.map((e) => e.eventId)).size).toBe(3);
    expect(out.every((e) => e.recurringEventId === 'SERIES')).toBe(true);
    expect(out.map((e) => e.occurrenceKey)).toEqual(['2026-03-05T07:00:00.000Z', '2026-03-12T07:00:00.000Z', '2026-03-26T07:00:00.000Z']);
    const all = await p.listEvents({ calendarIds: ['CAL-SURF'], from: '2026-03-01', to: '2026-03-31', includeCancelled: true });
    expect(all.find((e) => e.occurrenceKey === '2026-03-19T07:00:00.000Z')?.status).toBe('cancelled');
  });

  it('maps all-day events to date-only with exclusive end, and timed events to device wall time', async () => {
    surf.add({ id: 'TRIP', title: 'Surf trip', allDay: true, startDate: '2026-07-09T22:00:00.000Z', endDate: '2026-07-12T21:59:59.000Z' });
    surf.add({ id: 'DAWN', title: 'Dawn patrol', timeZone: 'GMT+2', startDate: '2026-07-14T04:15:00.000Z', endDate: '2026-07-14T06:00:00.000Z' });
    const [trip, dawn] = await ios().listEvents({ calendarIds: ['CAL-SURF'], from: '2026-07-01', to: '2026-07-31' });
    expect(trip).toMatchObject({ allDay: true, start: { date: '2026-07-10', time: null, instant: null }, end: { date: '2026-07-13', time: null } });
    expect(dawn).toMatchObject({ allDay: false, start: { date: '2026-07-14', time: '06:15', timeZone: TZ, instant: '2026-07-14T04:15:00.000Z' }, end: { time: '08:00' } });
  });

  it('honours an abort signal between chunks', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(ios().listEvents({ calendarIds: ['CAL-SURF'], from: '2020-01-01', to: '2026-01-01', signal: ac.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('createEvent / appMeta round trip', () => {
  it('creates without alarms or attendees and stores appMeta in the URL; reads it back and finds it by op id', async () => {
    const p = ios();
    const created = await p.createEvent('CAL-SURF', timedDraft);
    expect(surf.createEvent).toHaveBeenCalledTimes(1);
    const details = surf.createCalls[0];
    expect(details.alarms).toEqual([]);
    expect(details).not.toHaveProperty('attendees');
    expect(details).not.toHaveProperty('recurrenceRule');
    expect(details.timeZone).toBe(TZ);
    expect((details.startDate as Date).toISOString()).toBe('2026-07-10T05:30:00.000Z');
    expect(metaFromUrl(details.url as string)).toEqual(META);
    expect(details.notes).toBe('Mare formato');

    expect(created).toMatchObject({ provider: 'apple', accountId: 'SRC-ICLOUD', calendarId: 'CAL-SURF', title: 'Surf', notes: 'Mare formato', location: 'La Fuente', appMeta: META, start: { date: '2026-07-10', time: '07:30' }, end: { time: '09:00' } });

    const listed = await p.listEvents({ calendarIds: ['CAL-SURF'], from: '2026-07-10', to: '2026-07-10' });
    expect(listed).toHaveLength(1);
    expect(listed[0].appMeta).toEqual(META);
    const found = await p.findByOpId('CAL-SURF', META.opId, { from: '2026-07-10', to: '2026-07-10' });
    expect(found?.eventId).toBe(created.eventId);
    expect(await p.findByOpId('CAL-SURF', 'other-op', { from: '2026-07-10', to: '2026-07-10' })).toBeNull();
  });

  it('creates all-day date markers in the device zone', async () => {
    const draft: EventDraft = { ...timedDraft, allDay: true, start: { date: '2026-07-10', time: null, timeZone: null }, end: { date: '2026-07-11', time: null, timeZone: null } };
    const created = await ios().createEvent('CAL-SURF', draft);
    const d = surf.createCalls[0];
    expect(d.allDay).toBe(true);
    expect((d.startDate as Date).toISOString()).toBe('2026-07-09T22:00:00.000Z');
    expect((d.endDate as Date).toISOString()).toBe('2026-07-10T21:59:59.000Z');
    expect(d).not.toHaveProperty('timeZone');
    expect(created).toMatchObject({ allDay: true, start: { date: '2026-07-10' }, end: { date: '2026-07-11' } });
  });

  it('refuses read-only calendars and invalid drafts', async () => {
    const p = ios();
    await expect(p.createEvent('CAL-HOL', timedDraft)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(p.createEvent('CAL-SURF', { ...timedDraft, end: { ...timedDraft.end, time: '07:00' } })).rejects.toMatchObject({ code: 'invalid' });
    await expect(p.createEvent('NOPE', timedDraft)).rejects.toMatchObject({ code: 'not_found' });
    expect(surf.createEvent).not.toHaveBeenCalled();
  });

  it('write-only access can still create in the virtual calendar (no read-back checks possible)', async () => {
    store.fullStatus = 'denied';
    store.writeOnlyGranted = true;
    const p = ios();
    await expect(p.createEvent('VIRTUAL', timedDraft)).resolves.toMatchObject({ calendarId: 'VIRTUAL', appMeta: META });
    await expect(p.updateEvent('VIRTUAL', 'X', timedDraft)).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('write-only: a real calendar chosen earlier is reported as hidden by write-only access, not as deleted', async () => {
    store.fullStatus = 'denied';
    store.writeOnlyGranted = true;
    const err = await ios().createEvent('CAL-SURF', timedDraft).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err).toMatchObject({ code: 'forbidden', message: expect.stringContaining('solo in scrittura') });
    expect(surf.createEvent).not.toHaveBeenCalled();
  });
});

describe('getEvent / updateEvent', () => {
  it('updates only the targeted occurrence of a recurring series (by original start)', async () => {
    const weekly = { frequency: 'weekly' };
    const occ = ['05', '12', '19'].map((d) =>
      surf.add({ id: 'SERIES', title: 'Surf club', recurrenceRule: weekly, startDate: `2026-03-${d}T07:00:00.000Z`, endDate: `2026-03-${d}T08:30:00.000Z`, originalStartDate: `2026-03-${d}T07:00:00.000Z` }),
    );
    // another event in the same calendar starting at the same instant as the target
    const sameStart = surf.add({ id: 'OTHER', title: 'Altro', startDate: '2026-03-12T07:00:00.000Z', endDate: '2026-03-12T08:00:00.000Z' });
    const p = ios();
    const listed = await p.listEvents({ calendarIds: ['CAL-SURF'], from: '2026-03-01', to: '2026-03-31' });
    const target = listed.find((e) => e.occurrenceKey === '2026-03-12T07:00:00.000Z')!;

    const draft: EventDraft = { ...timedDraft, start: { date: '2026-03-12', time: '09:00', timeZone: TZ }, end: { date: '2026-03-12', time: '10:30', timeZone: TZ } };
    const updated = await p.updateEvent('CAL-SURF', target.eventId, draft, target.occurrenceKey);

    expect(occ[1].update).toHaveBeenCalledTimes(1);
    expect(occ[0].update).not.toHaveBeenCalled();
    expect(occ[2].update).not.toHaveBeenCalled();
    expect(sameStart.update).not.toHaveBeenCalled();
    expect(occ[1].updateCalls[0].alarms).toEqual([]);
    // identity survives the edit (original start unchanged, occurrence now detached)
    expect(updated).toMatchObject({ recurringEventId: 'SERIES', occurrenceKey: target.occurrenceKey, eventId: target.eventId, start: { time: '09:00' }, appMeta: META });

    // the moved occurrence is still found by its key
    const again = await p.getEvent('CAL-SURF', target.eventId, target.occurrenceKey);
    expect(again?.start.time).toBe('09:00');
  });

  it('refuses to rewrite a whole series when no occurrence key is given', async () => {
    surf.add({ id: 'SERIES', title: 'Surf club', recurrenceRule: { frequency: 'weekly' }, startDate: '2026-03-05T07:00:00.000Z', endDate: '2026-03-05T08:30:00.000Z' });
    await expect(ios().updateEvent('CAL-SURF', 'SERIES', timedDraft)).rejects.toMatchObject({ code: 'invalid' });
  });

  it('preserves a user URL on update and moves appMeta to a trailing notes line', async () => {
    const mine = surf.add({ id: 'MINE', title: 'surf con Luca', url: 'https://maps.apple.com/?q=La+Fuente', notes: 'portare la 6\'2', startDate: '2026-07-10T05:00:00.000Z', endDate: '2026-07-10T06:00:00.000Z' });
    const p = ios();
    const out = await p.updateEvent('CAL-SURF', 'MINE', timedDraft);
    const d = mine.updateCalls[0];
    expect(d).not.toHaveProperty('url');
    expect(mine.url).toBe('https://maps.apple.com/?q=La+Fuente');
    expect(splitNotesMeta(d.notes as string)).toEqual({ notes: 'Mare formato', meta: META });
    expect(out.appMeta).toEqual(META);
    expect(out.notes).toBe('Mare formato');
    expect(await p.findByOpId('CAL-SURF', META.opId, { from: '2026-07-10', to: '2026-07-10' })).toMatchObject({ eventId: 'MINE' });
  });

  it('overwrites our own previous metadata in the URL and clears removed fields', async () => {
    const ours = surf.add({ id: 'OURS', title: 'Surf', url: metaToUrl({ ...META, opId: 'old' }), location: 'Vecchio posto', startDate: '2026-07-10T05:30:00.000Z', endDate: '2026-07-10T07:00:00.000Z' });
    await ios().updateEvent('CAL-SURF', 'OURS', { ...timedDraft, location: null, notes: null });
    expect(metaFromUrl(ours.url)).toEqual(META);
    expect(ours.location).toBeNull();
    expect(ours.notes).toBeNull();
  });

  it('getEvent falls back to a dated scan when neither id lookup resolves the event', async () => {
    surf.add({ id: 'ITEM-1', title: 'Surf', startDate: '2026-05-02T06:00:00.000Z', endDate: '2026-05-02T07:00:00.000Z' });
    store.getByIdWorks = false;
    store.legacyWorks = false;
    const p = ios();
    await p.listEvents({ calendarIds: ['CAL-SURF'], from: '2026-05-01', to: '2026-05-31' }); // remembers where ITEM-1 lives
    expect((await p.getEvent('CAL-SURF', 'ITEM-1'))?.eventId).toBe('ITEM-1');
    // without any hint the event cannot be found → null, never a guess
    expect(await ios().getEvent('CAL-SURF', 'ITEM-1')).toBeNull();
    // updates use the draft dates as a hint
    await expect(ios().updateEvent('CAL-SURF', 'ITEM-1', { ...timedDraft, start: { ...timedDraft.start, date: '2026-05-02' }, end: { ...timedDraft.end, date: '2026-05-02' } })).resolves.toMatchObject({ eventId: 'ITEM-1' });
  });

  it('finds a linked single event the user moved far away, after a restart (no hints), by calendarItemIdentifier', async () => {
    // Exported on 2026-07-10, then moved by the user to 2027-02-20; ExpoCalendarEvent.get misses (device behaviour).
    const moved = surf.add({ id: 'EXPORTED-1', title: 'Surf', url: metaToUrl(META), startDate: '2027-02-20T08:00:00.000Z', endDate: '2027-02-20T09:30:00.000Z' });
    const fresh = ios(); // new instance: no in-memory hints
    const got = await fresh.getEvent('CAL-SURF', 'EXPORTED-1');
    expect(got).toMatchObject({ eventId: 'EXPORTED-1', calendarId: 'CAL-SURF', appMeta: META, start: { date: '2027-02-20', time: '09:00' } });
    expect(legacy.getEventAsync).toHaveBeenCalledWith('EXPORTED-1');
    // the scan around the legacy start date yields the root-API object that is then updated
    const draft: EventDraft = { ...timedDraft, start: { date: '2026-07-10', time: '07:30', timeZone: TZ }, end: { date: '2026-07-10', time: '09:00', timeZone: TZ } };
    await expect(ios().updateEvent('CAL-SURF', 'EXPORTED-1', draft)).resolves.toMatchObject({ eventId: 'EXPORTED-1', start: { date: '2026-07-10', time: '07:30' } });
    expect(moved.update).toHaveBeenCalledTimes(1);
  });

  it('uses ExpoCalendarEvent.get when it does resolve the id (no legacy call needed)', async () => {
    surf.add({ id: 'ITEM-2', title: 'Surf', startDate: '2027-02-20T08:00:00.000Z', endDate: '2027-02-20T09:30:00.000Z' });
    store.getByIdWorks = true;
    expect((await ios().getEvent('CAL-SURF', 'ITEM-2'))?.eventId).toBe('ITEM-2');
    expect(legacy.getEventAsync).not.toHaveBeenCalled();
  });

  it('getEvent returns null for a deleted calendar or an event moved to another calendar', async () => {
    work.add({ id: 'MOVED', title: 'Surf', startDate: '2026-05-02T06:00:00.000Z', endDate: '2026-05-02T07:00:00.000Z' });
    const p = ios();
    expect(await p.getEvent('GONE', 'MOVED')).toBeNull();
    expect(await p.getEvent('CAL-SURF', 'MOVED')).toBeNull();
    await expect(p.updateEvent('CAL-SURF', 'MOVED', timedDraft)).rejects.toMatchObject({ code: 'not_found', message: 'L’evento è stato spostato in un altro calendario.' });
  });
});

describe('ranges sanity', () => {
  it('findByOpId pads the window by a day on each side', async () => {
    const p = ios();
    await p.findByOpId('CAL-SURF', 'op', { from: '2026-07-10', to: '2026-07-12' });
    const c = surf.listCalls[0];
    expect(epochToZoned(c.start.getTime(), TZ).date).toBe(addDays('2026-07-10', -1));
    expect(diffDays(epochToZoned(c.end.getTime(), TZ).date, '2026-07-12')).toBe(2);
  });
});

describe('regressions', () => {
  it('rejects inverted ranges instead of answering "no events" / "not found"', async () => {
    const p = ios();
    await expect(p.listEvents({ calendarIds: ['CAL-SURF'], from: '2026-03-31', to: '2026-03-01' })).rejects.toMatchObject({ code: 'invalid' });
    await expect(p.findByOpId('CAL-SURF', META.opId, { from: '2026-07-12', to: '2026-07-10' })).rejects.toMatchObject({ code: 'invalid' });
    expect(surf.listEvents).not.toHaveBeenCalled();
  });

  it('an update clears alarms the user had added to the linked event', async () => {
    const mine = surf.add({ id: 'ALARMED', title: 'Surf', startDate: '2026-07-10T05:30:00.000Z', endDate: '2026-07-10T07:00:00.000Z' });
    mine.alarms = [{ relativeOffset: -15 }];
    await ios().updateEvent('CAL-SURF', 'ALARMED', timedDraft);
    expect(mine.updateCalls[0].alarms).toEqual([]);
    expect(mine.alarms).toEqual([]);
  });

  it('round-trips Unicode titles, notes and location unchanged (only the metadata trailer is hidden)', async () => {
    const draft: EventDraft = { ...timedDraft, title: '  Surf 🌊 «Città» — più  ', notes: 'Onde 1,5 m\nvento: tramontana 🌬️', location: 'Capo Mannu, Sardegna' };
    const p = ios();
    const created = await p.createEvent('CAL-SURF', draft);
    expect(surf.createCalls[0].title).toBe(draft.title);
    const [listed] = await p.listEvents({ calendarIds: ['CAL-SURF'], from: '2026-07-10', to: '2026-07-10' });
    expect(listed).toMatchObject({ eventId: created.eventId, title: draft.title, notes: draft.notes, location: draft.location, appMeta: META });
  });

  it('accepts an occurrence id whose key is not in the canonical millisecond form', async () => {
    const occ = surf.add({ id: 'SERIES', title: 'Surf club', recurrenceRule: { frequency: 'weekly' }, startDate: '2026-03-12T07:00:00.000Z', endDate: '2026-03-12T08:30:00.000Z' });
    const got = await ios().getEvent('CAL-SURF', 'SERIES@2026-03-12T07:00:00Z');
    expect(got).toMatchObject({ recurringEventId: 'SERIES', occurrenceKey: '2026-03-12T07:00:00.000Z' });
    await ios().updateEvent('CAL-SURF', 'SERIES@2026-03-12T07:00:00Z', { ...timedDraft, start: { date: '2026-03-12', time: '09:00', timeZone: TZ }, end: { date: '2026-03-12', time: '10:00', timeZone: TZ } });
    expect(occ.update).toHaveBeenCalledTimes(1);
  });
});
