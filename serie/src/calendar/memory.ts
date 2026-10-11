/**
 * In-memory calendar provider for automated UI verification ONLY.
 *
 * Enabled exclusively when a build sets EXPO_PUBLIC_SERIE_E2E_CALENDAR=1
 * (see tools/build-web.sh --e2e). Production and development builds never
 * include these fixtures: the registry falls back to the real Google and
 * EventKit providers. Every fixture account is labelled "prova", so it can
 * never be mistaken for the user's own calendars.
 */
import type { CalendarProvider, Connection, EventDraft, ExternalCalendar, ExternalEvent, LabelOption, ListEventsQuery, ProviderKind } from './types';
import { ProviderError } from './types';
import { addDays, compareDates } from '@/domain/dates';
import { zonedToEpoch } from '@/domain/zoned';

const TZ = 'Europe/Rome';
const STORE_KEY = 'serie.e2e.calendar.v1';

interface MemoryState {
  events: ExternalEvent[];
  seq: number;
  connected: Record<ProviderKind, boolean>;
}

const LABELS: LabelOption[] = [
  { id: '7', name: 'Pavone', color: '#039BE5' },
  { id: '10', name: 'Basilico', color: '#0B8043' },
  { id: '6', name: 'Mandarino', color: '#F4511E' },
];

const GOOGLE_ACCOUNT = 'prova@e2e.local';
const CALENDARS: ExternalCalendar[] = [
  { provider: 'google', accountId: GOOGLE_ACCOUNT, calendarId: 'primary-e2e', accountLabel: GOOGLE_ACCOUNT, title: 'Prova principale', color: '#039BE5', access: 'owner', canRead: true, canWrite: true, isPrimary: true, sourceType: null, sourceName: null },
  { provider: 'google', accountId: GOOGLE_ACCOUNT, calendarId: 'sport-e2e', accountLabel: GOOGLE_ACCOUNT, title: 'Prova sport', color: '#0B8043', access: 'owner', canRead: true, canWrite: true, isPrimary: false, sourceType: null, sourceName: null },
  { provider: 'google', accountId: GOOGLE_ACCOUNT, calendarId: 'holidays-e2e', accountLabel: GOOGLE_ACCOUNT, title: 'Festività (prova)', color: '#999999', access: 'reader', canRead: true, canWrite: false, isPrimary: false, sourceType: null, sourceName: null },
  // The same Google calendar seen through the iPhone calendar store (CalDAV): an equivalent destination.
  { provider: 'apple', accountId: 'caldav-e2e', calendarId: 'ek-sport-e2e', accountLabel: `Google · ${GOOGLE_ACCOUNT}`, title: 'Prova sport', color: '#0B8043', access: 'owner', canRead: true, canWrite: true, isPrimary: false, sourceType: 'caldav', sourceName: GOOGLE_ACCOUNT },
  { provider: 'apple', accountId: 'icloud-e2e', calendarId: 'ek-icloud-e2e', accountLabel: 'iCloud (prova)', title: 'Casa (prova)', color: '#B9A8FF', access: 'owner', canRead: true, canWrite: true, isPrimary: true, sourceType: 'caldav', sourceName: 'iCloud' },
];

function timed(date: string, time: string, tz = TZ) {
  const r = zonedToEpoch(date, time, tz);
  return { date, time, timeZone: tz, instant: new Date(r.epochMs).toISOString() };
}
const allDay = (date: string) => ({ date, time: null, timeZone: null, instant: null });

function base(cal: ExternalCalendar, id: string, title: string): Omit<ExternalEvent, 'start' | 'end' | 'allDay'> {
  return { provider: cal.provider, accountId: cal.accountId, calendarId: cal.calendarId, eventId: id, recurringEventId: null, occurrenceKey: null, title, notes: null, location: null, status: 'confirmed', colorId: null, appMeta: null, updated: '2026-09-30T08:00:00.000Z' };
}

/** Deterministic fixtures relative to a fixed reference (2026), independent of "today". */
function seed(): ExternalEvent[] {
  const [primary, sport, , ekSport, ekHome] = CALENDARS;
  const out: ExternalEvent[] = [
    { ...base(sport, 'g1', 'Surf all’alba'), allDay: false, start: timed('2026-08-02', '06:30'), end: timed('2026-08-02', '08:00'), notes: 'Onda lunga da libeccio, 1 m.\nhttps://maps.app.goo.gl/e2eLivorno', location: 'Bagni Fiume, Livorno', colorId: '7' },
    { ...base(sport, 'g2', 'SURF lesson'), allDay: false, start: timed('2026-08-09', '17:00'), end: timed('2026-08-09', '18:30'), colorId: '10' },
    { ...base(sport, 'g3', 'Surf trip Portogallo'), allDay: true, start: allDay('2026-08-20'), end: allDay('2026-08-24'), notes: 'Peniche, Supertubos', colorId: '7' },
    { ...base(primary, 'g4', 'Cena con amici'), allDay: false, start: timed('2026-08-10', '20:00'), end: timed('2026-08-10', '23:00'), notes: 'dopo il surf' },
    { ...base(primary, 'g5', 'Surf'), allDay: false, start: timed('2026-08-15', '09:00'), end: timed('2026-08-15', '09:00') },
    { ...base(sport, 'g6', 'Surfskate al parco'), allDay: false, start: timed('2026-08-16', '18:00'), end: timed('2026-08-16', '19:00'), colorId: '6' },
    { ...base(ekHome, 'a1', 'Surf con Marta'), allDay: false, start: timed('2026-08-03', '07:00'), end: timed('2026-08-03', '09:15') },
    { ...base(ekSport, 'a2', 'Surf all’alba'), allDay: false, start: timed('2026-08-02', '06:30'), end: timed('2026-08-02', '08:00') },
  ];
  // weekly recurring "Corsa" with one cancelled occurrence
  for (let i = 0; i < 6; i++) {
    const d = addDays('2026-08-04', i * 7);
    out.push({ ...base(sport, 'r1', 'Corsa lungo mare'), eventId: `r1_${d.replace(/-/g, '')}`, recurringEventId: 'r1', occurrenceKey: `${d}T07:00`, allDay: false, start: timed(d, '07:00'), end: timed(d, '07:45'), status: i === 3 ? 'cancelled' : 'confirmed' });
  }
  return out;
}

function load(): MemoryState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE_KEY) : null;
    if (raw) return JSON.parse(raw) as MemoryState;
  } catch {
    // ignore: start fresh
  }
  return { events: seed(), seq: 1, connected: { google: false, apple: false } };
}

let state: MemoryState | null = null;
function st(): MemoryState {
  if (!state) state = load();
  return state;
}
function persist() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORE_KEY, JSON.stringify(st()));
  } catch {
    // ignore
  }
}

function overlaps(e: ExternalEvent, from: string, to: string) {
  const endIncl = e.allDay ? addDays(e.end.date, -1) : e.end.date;
  return compareDates(e.start.date, to) <= 0 && compareDates(endIncl < e.start.date ? e.start.date : endIncl, from) >= 0;
}

function fromDraft(cal: ExternalCalendar, id: string, d: EventDraft): ExternalEvent {
  const t = (p: EventDraft['start']) => (d.allDay || !p.time ? allDay(p.date) : timed(p.date, p.time, p.timeZone ?? TZ));
  return { ...base(cal, id, d.title), notes: d.notes, location: d.location, allDay: d.allDay, start: t(d.start), end: t(d.end), colorId: cal.provider === 'google' ? d.colorId : null, appMeta: d.appMeta, updated: new Date().toISOString() };
}

// Real providers answer later than a microtask (EventKit over the native bridge, Google over the
// network). Answering after a macrotask lets the web e2e reproduce races that only showed natively,
// like a calendar list that a re-rendering effect cancelled and never loaded again.
const LAG_MS = 40;
const lag = () => new Promise<void>((r) => setTimeout(r, LAG_MS));

export function createMemoryProvider(kind: ProviderKind): CalendarProvider {
  const cals = CALENDARS.filter((c) => c.provider === kind);
  const account = cals[0];
  const conn = (): Connection =>
    st().connected[kind]
      ? { provider: kind, status: 'connected', accountId: account.accountId, accountLabel: kind === 'google' ? GOOGLE_ACCOUNT : 'Calendari di prova', canRead: true, canWrite: true, detail: null }
      : { provider: kind, status: 'disconnected', accountId: null, accountLabel: null, canRead: false, canWrite: false, detail: 'Calendario di prova (build E2E): tocca Collega.' };
  const need = () => {
    if (!st().connected[kind]) throw new ProviderError('unauthorized', 'Non collegato.');
  };
  const cal = (id: string) => {
    const c = cals.find((x) => x.calendarId === id);
    if (!c) throw new ProviderError('not_found', 'Calendario non trovato.');
    return c;
  };
  return {
    kind,
    capabilities: { eventLabels: kind === 'google' },
    async getConnection() {
      await lag();
      return conn();
    },
    async connect() {
      await lag();
      st().connected[kind] = true;
      persist();
      return conn();
    },
    async disconnect() {
      await lag();
      st().connected[kind] = false;
      persist();
    },
    async listCalendars() {
      await lag();
      need();
      return cals.map((c) => ({ ...c }));
    },
    async listLabels() {
      await lag();
      need();
      return kind === 'google' ? LABELS : [];
    },
    async listEvents(q: ListEventsQuery) {
      await lag();
      need();
      const ids = new Set(q.calendarIds);
      const out = st().events.filter((e) => e.provider === kind && ids.has(e.calendarId) && overlaps(e, q.from, q.to) && (q.includeCancelled || e.status !== 'cancelled'));
      q.onProgress?.(out.length);
      return out.map((e) => ({ ...e }));
    },
    async getEvent(calendarId, eventId) {
      await lag();
      need();
      return st().events.find((e) => e.provider === kind && e.calendarId === calendarId && e.eventId === eventId) ?? null;
    },
    async findByOpId(calendarId, opId) {
      await lag();
      need();
      return st().events.find((e) => e.provider === kind && e.calendarId === calendarId && e.appMeta?.opId === opId) ?? null;
    },
    async createEvent(calendarId, draft) {
      await lag();
      need();
      const c = cal(calendarId);
      if (!c.canWrite) throw new ProviderError('forbidden', 'Calendario in sola lettura.');
      const e = fromDraft(c, `${kind[0]}x${st().seq++}`, draft);
      st().events.push(e);
      // the CalDAV mirror shows Google writes to the shared calendar too (as the real iPhone store would)
      if (kind === 'google' && calendarId === 'sport-e2e') st().events.push({ ...fromDraft(CALENDARS[3], `ax${st().seq++}`, draft), colorId: null });
      persist();
      return { ...e };
    },
    async updateEvent(calendarId, eventId, draft) {
      await lag();
      need();
      const c = cal(calendarId);
      const i = st().events.findIndex((e) => e.provider === kind && e.calendarId === calendarId && e.eventId === eventId);
      if (i < 0) throw new ProviderError('not_found', 'Evento non trovato.');
      st().events[i] = fromDraft(c, eventId, draft);
      persist();
      return { ...st().events[i] };
    },
  };
}

export const memoryCalendarEnabled = () => process.env.EXPO_PUBLIC_SERIE_E2E_CALENDAR === '1';
