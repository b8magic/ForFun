/**
 * In-memory stand-in for the expo-calendar surface the Apple provider uses.
 * Mirrors the native behaviour that matters to the provider:
 *  - dates come back as ISO strings, all-day ends as 23:59:59 of the last day
 *  - every occurrence of a recurring event shares the series `id`
 *  - `calendar.listEvents(start, end)` returns events overlapping the range
 *  - `timeZone` is a localized abbreviation, not an IANA id
 *  - `ExpoCalendarEvent.get(id)` uses `eventWithIdentifier:`, which does not
 *    resolve the `calendarItemIdentifier`s the API hands out: it misses by
 *    default (`getByIdWorks = false`)
 *  - legacy `getEventAsync(id)` uses `calendarItemWithIdentifier:`: it finds
 *    the item in any calendar and returns a plain serialized snapshot (the
 *    first occurrence for a recurring series)
 *  - with write-only access only the virtual default calendar resolves
 */
export interface FakeEventInit {
  id: string;
  calendarId: string;
  title?: string;
  notes?: string | null;
  location?: string | null;
  url?: string | null;
  timeZone?: string | null;
  startDate: string;
  endDate: string;
  originalStartDate?: string | null;
  isDetached?: boolean;
  allDay?: boolean;
  status?: string;
  recurrenceRule?: unknown;
}

const toIso = (v: unknown) => (v instanceof Date ? v.toISOString() : v);

export class FakeEvent {
  id: string;
  calendarId: string;
  title: string;
  notes: string | null;
  location: string | null;
  url: string | null;
  timeZone: string | null;
  startDate: string;
  endDate: string;
  originalStartDate: string | null;
  isDetached: boolean;
  allDay: boolean;
  status: string;
  recurrenceRule: unknown;
  alarms: unknown[] = [];
  lastModifiedDate = '2026-10-01T10:00:00.000Z';
  updateCalls: Record<string, unknown>[] = [];

  constructor(init: FakeEventInit) {
    this.id = init.id;
    this.calendarId = init.calendarId;
    this.title = init.title ?? '';
    this.notes = init.notes ?? null;
    this.location = init.location ?? null;
    this.url = init.url ?? null;
    this.timeZone = init.timeZone ?? null;
    this.startDate = init.startDate;
    this.endDate = init.endDate;
    this.originalStartDate = init.originalStartDate ?? init.startDate;
    this.isDetached = init.isDetached ?? false;
    this.allDay = init.allDay ?? false;
    this.status = init.status ?? 'none';
    this.recurrenceRule = init.recurrenceRule ?? null;
  }

  /** Plain object, as the legacy API serializes events. */
  snapshot(): Record<string, unknown> {
    const { update: _u, updateCalls: _c, ...rest } = this as unknown as Record<string, unknown>;
    return { ...rest };
  }

  update = jest.fn(async (details: Record<string, unknown>) => {
    this.updateCalls.push(details);
    for (const [k, v] of Object.entries(details)) {
      if (v === undefined) continue;
      (this as unknown as Record<string, unknown>)[k] = toIso(v);
    }
    if (this.recurrenceRule != null) this.isDetached = true;
    this.lastModifiedDate = '2026-10-11T09:00:00.000Z';
  });
}

let created = 0;

export class FakeCalendar {
  events: FakeEvent[] = [];
  createCalls: Record<string, unknown>[] = [];
  listCalls: { start: Date; end: Date }[] = [];

  constructor(
    public id: string,
    public title: string,
    public source: { id?: string; type: string; name: string },
    public allowsModifications = true,
    public type?: string,
    public color = '#1BADF8',
    public entityType = 'event',
  ) {}

  listEvents = jest.fn(async (start: Date, end: Date) => {
    this.listCalls.push({ start, end });
    const s = start.getTime();
    const e = end.getTime();
    return this.events
      .filter((ev) => Date.parse(ev.startDate) < e && Math.max(Date.parse(ev.endDate), Date.parse(ev.startDate) + 1) > s)
      .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));
  });

  createEvent = jest.fn(async (details: Record<string, unknown>) => {
    this.createCalls.push(details);
    created++;
    const ev = new FakeEvent({
      id: `NEW-${created}`,
      calendarId: this.id,
      title: details.title as string,
      notes: (details.notes as string) ?? null,
      location: (details.location as string) ?? null,
      url: (details.url as string) ?? null,
      // native returns an abbreviation, never the IANA id that was written
      timeZone: details.timeZone ? 'GMT+1' : null,
      startDate: toIso(details.startDate) as string,
      endDate: toIso(details.endDate) as string,
      allDay: details.allDay as boolean,
    });
    ev.alarms = (details.alarms as unknown[]) ?? [];
    this.events.push(ev);
    return ev;
  });

  add(init: Omit<FakeEventInit, 'calendarId'>): FakeEvent {
    const ev = new FakeEvent({ ...init, calendarId: this.id });
    this.events.push(ev);
    return ev;
  }
}

export class FakeStore {
  calendars: FakeCalendar[] = [];
  defaultCalendarId: string | null = null;
  fullStatus: 'granted' | 'denied' | 'undetermined' = 'granted';
  writeOnlyGranted = false;
  missingPlist = false;
  /** `eventWithIdentifier:` resolving `calendarItemIdentifier`s (it does not on a device). */
  getByIdWorks = false;
  /** Legacy `calendarItemWithIdentifier:` lookup available. */
  legacyWorks = true;

  calendar(id: string): FakeCalendar {
    const c = this.calendars.find((x) => x.id === id);
    if (!c) throw Object.assign(new Error(`Calendar with id ${id} could not be found`), { code: 'ERR_CALENDAR_ID_NOT_FOUND' });
    return c;
  }

  allEvents(): FakeEvent[] {
    return this.calendars.flatMap((c) => c.events);
  }
}

export function permission(status: 'granted' | 'denied' | 'undetermined') {
  return { status, granted: status === 'granted', canAskAgain: status === 'undetermined', expires: 'never' as const };
}

/** Wires the jest.mock('expo-calendar') and ('expo-calendar/legacy') functions to a FakeStore. */
export function installFake(mod: Record<string, unknown>, store: FakeStore, legacy?: Record<string, unknown>) {
  const m = mod as Record<string, jest.Mock> & { ExpoCalendar: { get: jest.Mock }; ExpoCalendarEvent: { get: jest.Mock } };
  const plistError = () => Object.assign(new Error("This app is missing NSCalendarsFullAccessUsageDescription, so calendar methods will fail. Add this key to your bundle's Info.plist"), { code: 'ERR_MISSING_CALENDAR_P_LIST_VALUE' });
  m.getCalendarPermissions.mockImplementation(async (writeOnly?: boolean) => {
    if (store.missingPlist) throw plistError();
    if (writeOnly) {
      if (store.fullStatus === 'granted' || store.writeOnlyGranted) return permission('granted');
      return permission(store.fullStatus === 'undetermined' ? 'undetermined' : 'denied');
    }
    return permission(store.fullStatus);
  });
  m.requestCalendarPermissions.mockImplementation(async (writeOnly?: boolean) => {
    if (store.missingPlist) throw plistError();
    if (!writeOnly && store.fullStatus === 'undetermined') store.fullStatus = 'granted';
    return permission(store.fullStatus);
  });
  m.getCalendars.mockImplementation(async () => {
    if (store.fullStatus !== 'granted' && store.writeOnlyGranted) {
      return [new FakeCalendar('VIRTUAL', 'Calendario', { id: 'virtual-src', type: 'local', name: 'Default' })];
    }
    return store.calendars;
  });
  m.getDefaultCalendarSync.mockImplementation(() => {
    if (!store.defaultCalendarId) throw new Error('Could not find the default calendar');
    return store.calendar(store.defaultCalendarId);
  });
  m.ExpoCalendar.get.mockImplementation(async (id: string) => {
    // write-only: "only the virtual calendar's ID can be resolved"
    if (store.fullStatus !== 'granted' && store.writeOnlyGranted && id !== 'VIRTUAL') {
      throw Object.assign(new Error(`Calendar with id ${id} could not be found`), { code: 'ERR_CALENDAR_ID_NOT_FOUND' });
    }
    if (id === 'VIRTUAL' && store.writeOnlyGranted && store.fullStatus !== 'granted') {
      return new FakeCalendar('VIRTUAL', 'Calendario', { id: 'virtual-src', type: 'local', name: 'Default' });
    }
    return store.calendar(id);
  });
  m.ExpoCalendarEvent.get.mockImplementation(async (id: string) => {
    const ev = store.getByIdWorks ? store.allEvents().find((e) => e.id === id) : undefined;
    if (!ev) throw Object.assign(new Error(`Event with id ${id} could not be found`), { code: 'ERR_EVENT_NOT_FOUND' });
    return ev;
  });
  if (legacy) {
    (legacy.getEventAsync as jest.Mock).mockImplementation(async (id: string) => {
      const first = store.legacyWorks
        ? store
            .allEvents()
            .filter((e) => e.id === id)
            .sort((a, b) => Date.parse(a.originalStartDate ?? a.startDate) - Date.parse(b.originalStartDate ?? b.startDate))[0]
        : undefined;
      if (!first) throw Object.assign(new Error(`Event with id ${id} could not be found`), { code: 'ERR_EVENT_NOT_FOUND' });
      return first.snapshot();
    });
  }
}
