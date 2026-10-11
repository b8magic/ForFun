/** Scripted in-memory provider shared by the cross-module and facade tests (not a test file itself). */
import { ProviderError, type CalendarProvider, type CalendarRef, type Connection, type EventDraft, type ExternalCalendar, type ExternalEvent, type ListEventsQuery } from '../types';
import type { LocalDate, ProviderKind } from '@/domain/types';
import { addDays, compareDates } from '@/domain/dates';
import { zonedToEpoch } from '@/domain/zoned';

export const TZ = 'Europe/Rome';
export const EMAIL = 'surfer@gmail.com';
export const G_REF: CalendarRef = { provider: 'google', accountId: EMAIL, calendarId: 'sport@group.calendar.google.com' };
export const A_REF: CalendarRef = { provider: 'apple', accountId: 'src-icloud', calendarId: 'ek-home' };

export const instantOf = (p: EventDraft['start']) => (p.time && p.timeZone ? new Date(zonedToEpoch(p.date, p.time, p.timeZone).epochMs).toISOString() : null);

export type CreateStep = 'ok' | { throw: ProviderError | Error; persist: boolean };

export class FakeProvider implements CalendarProvider {
  readonly capabilities: { eventLabels: boolean };
  events: ExternalEvent[] = [];
  log: string[] = [];
  createSteps: CreateStep[] = [];
  findFailures = 0;
  /** Thrown by every findByOpId while set (e.g. Google's 'conflict' for unreadable metadata). */
  findError: ProviderError | null = null;
  /** While set, createEvent waits for it (to observe what else runs meanwhile). */
  createGate: Promise<void> | null = null;
  private seq = 0;

  constructor(
    readonly kind: ProviderKind,
    public calendars: ExternalCalendar[],
    public conn: Connection,
  ) {
    this.capabilities = { eventLabels: kind === 'google' };
  }
  private clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  async getConnection() {
    this.log.push('getConnection');
    return this.conn;
  }
  async connect() {
    return this.conn;
  }
  async disconnect() {}
  async listCalendars() {
    this.log.push('listCalendars');
    return this.clone(this.calendars);
  }
  async listLabels() {
    return [];
  }
  async listEvents(q: ListEventsQuery) {
    this.log.push('listEvents');
    return this.clone(
      this.events.filter((e) => {
        const last = e.allDay ? addDays(e.end.date, -1) : e.end.date;
        return q.calendarIds.includes(e.calendarId) && compareDates(e.start.date, q.to) <= 0 && compareDates(last, q.from) >= 0 && (q.includeCancelled || e.status !== 'cancelled');
      }),
    );
  }
  async getEvent(calendarId: string, eventId: string) {
    this.log.push('getEvent');
    const e = this.events.find((x) => x.calendarId === calendarId && x.eventId === eventId);
    return e ? this.clone(e) : null;
  }
  async findByOpId(calendarId: string, opId: string, around: { from: LocalDate; to: LocalDate }) {
    this.log.push('findByOpId');
    if (this.findError) throw this.findError;
    if (this.findFailures > 0) {
      this.findFailures--;
      throw new ProviderError('offline', 'Offline');
    }
    const e = this.events.find((x) => x.calendarId === calendarId && x.appMeta?.opId === opId && x.status !== 'cancelled' && compareDates(x.start.date, around.from) >= 0 && compareDates(x.start.date, around.to) <= 0);
    return e ? this.clone(e) : null;
  }
  async createEvent(calendarId: string, draft: EventDraft) {
    this.log.push('createEvent');
    if (this.createGate) await this.createGate;
    const step = this.createSteps.shift() ?? 'ok';
    const point = (p: EventDraft['start']) => ({ date: p.date, time: p.time, timeZone: p.timeZone, instant: draft.allDay ? null : instantOf(p) });
    const ev: ExternalEvent = {
      provider: this.kind,
      accountId: this.calendars[0].accountId,
      calendarId,
      eventId: `${this.kind}-ev-${++this.seq}`,
      recurringEventId: null,
      occurrenceKey: null,
      title: draft.title,
      notes: draft.notes,
      location: draft.location,
      allDay: draft.allDay,
      start: point(draft.start),
      end: point(draft.end),
      status: 'confirmed',
      colorId: this.capabilities.eventLabels ? draft.colorId : null,
      appMeta: this.clone(draft.appMeta),
      updated: null,
    };
    if (step === 'ok' || step.persist) this.events.push(ev);
    if (step !== 'ok') throw step.throw;
    return this.clone(ev);
  }
  async updateEvent(): Promise<ExternalEvent> {
    throw new Error('not used here');
  }
  count(m: string) {
    return this.log.filter((x) => x === m).length;
  }
}

export const G_CAL: ExternalCalendar = { ...G_REF, accountLabel: EMAIL, title: 'Sport', color: null, access: 'owner', canRead: true, canWrite: true, isPrimary: false, sourceType: null, sourceName: null };
export const A_CAL: ExternalCalendar = { ...A_REF, accountLabel: 'iCloud', title: 'Casa', color: null, access: 'owner', canRead: true, canWrite: true, isPrimary: false, sourceType: 'caldav', sourceName: 'iCloud' };
export const G_CONN: Connection = { provider: 'google', status: 'connected', accountId: EMAIL, accountLabel: EMAIL, canRead: true, canWrite: true, detail: null };
export const A_CONN: Connection = { provider: 'apple', status: 'connected', accountId: null, accountLabel: null, canRead: true, canWrite: true, detail: null };
