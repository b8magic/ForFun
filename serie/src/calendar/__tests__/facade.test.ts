/**
 * The UI facade (`@/calendar`): loads nothing native on import, delegates to
 * the engines over real (sql.js) repositories, and reports provider problems
 * honestly.
 */
import { testRepos } from '@/test/sqljs';
import { buildTiming } from '@/domain/timing';
import type { Category, Session } from '@/domain/types';
import type { Repositories } from '@/data/repositories';
import { ProviderError, type CalendarProvider, type ExternalCalendar, type ExternalEvent } from '../types';
import { A_CAL, A_CONN, A_REF, EMAIL, FakeProvider, G_CAL, G_CONN, G_REF, TZ } from './fakeCalendar';
import * as cal from '../index';

// jest hoists these above the imports. A factory runs only when its module is first required, so
// `mockLoaded` records which lazy dependency the facade has loaded so far.
const mockLoaded: string[] = [];
const mockProviders: Record<string, CalendarProvider> = {};
const mockRuntime = { enqueueAfterCommit: jest.fn(async () => undefined), runAutoExportNow: jest.fn(async () => undefined), startAutoExportRuntime: jest.fn(() => () => undefined) };

jest.mock('../registry', () => {
  mockLoaded.push('registry');
  return { getProviders: async () => mockProviders };
});
jest.mock('../autoRuntime', () => {
  mockLoaded.push('autoRuntime');
  return mockRuntime;
});
jest.mock('@/data/database', () => {
  mockLoaded.push('database');
  return { getRepositories: async () => null };
});

const OPTIONS: cal.ExportOptions = { prefix: '', suffix: '', includeNotes: true, includeLocation: true, startOnlySpanMin: null, overrides: {} };

async function world() {
  const repos = await testRepos();
  const surf = await repos.categories.create({ name: 'Surf', color: '#2E7D9A', pattern: 'swell' });
  const google = new FakeProvider('google', [G_CAL], G_CONN);
  const apple = new FakeProvider('apple', [A_CAL], A_CONN);
  const deps: cal.CalendarDeps = { repos, providers: { google, apple } };
  return { repos, surf, google, apple, deps };
}

let req = 0;
async function save(repos: Repositories, surf: Category, date: string, origin: 'manual' | 'import' = 'manual'): Promise<Session> {
  const tm = buildTiming(date, { state: 'interval', start: '07:30', end: '09:00', endDayOffset: 0, timeZone: TZ });
  if (!tm.ok) throw new Error('timing');
  return (await repos.sessions.saveBatch({ categoryId: surf.id, dates: [date], requestId: `f-${++req}`, shared: { timing: tm.timing }, origin })).sessions[0];
}

function sourceEvent(c: ExternalCalendar, eventId: string, title: string, date: string, start = '07:00', end = '08:30'): ExternalEvent {
  const instant = (t: string) => new Date(`${date}T${t}:00+02:00`).toISOString();
  return {
    provider: c.provider,
    accountId: c.accountId,
    calendarId: c.calendarId,
    eventId,
    recurringEventId: null,
    occurrenceKey: null,
    title,
    notes: null,
    location: null,
    allDay: false,
    start: { date, time: start, timeZone: TZ, instant: instant(start) },
    end: { date, time: end, timeZone: TZ, instant: instant(end) },
    status: 'confirmed',
    colorId: null,
    appMeta: null,
    updated: null,
  };
}

describe('loading', () => {
  it('importing the facade loads no registry, database or runtime (no native module, no prompt)', () => {
    expect(mockLoaded).toEqual([]);
    expect(cal.PROVIDER_KINDS).toEqual(['google', 'apple']);
  });

  it('getProviders goes through the lazy registry', async () => {
    mockProviders.google = new FakeProvider('google', [G_CAL], G_CONN);
    expect((await cal.getProviders()).google).toBe(mockProviders.google);
    expect(mockLoaded).toContain('registry');
  });

  it('auto-export runtime calls are delegated to the app runtime', async () => {
    const s = { id: 's1' } as Session;
    await cal.enqueueAfterSave([s]);
    expect(mockRuntime.enqueueAfterCommit).toHaveBeenCalledWith([s]);
    await cal.runAutoExportNow();
    expect(mockRuntime.runAutoExportNow).toHaveBeenCalled();
    const stop = await cal.startAutoExportRuntime();
    expect(typeof stop).toBe('function');
    mockRuntime.enqueueAfterCommit.mockRejectedValueOnce(new Error('db locked'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(cal.enqueueAfterSave([s])).resolves.toBeUndefined(); // never thrown into a save
    warn.mockRestore();
  });
});

describe('connections', () => {
  it('reports every provider, and a failing or missing one as unavailable (never connected)', async () => {
    const { google } = await world();
    const broken = new FakeProvider('apple', [A_CAL], A_CONN);
    broken.getConnection = async () => {
      throw new ProviderError('unavailable', 'Calendari di iPhone non disponibili in Expo Go.');
    };
    const conns = await cal.getConnections({ providers: { google, apple: broken } });
    expect(conns.google).toEqual(G_CONN);
    expect(conns.apple).toMatchObject({ status: 'unavailable', canRead: false, canWrite: false, detail: 'Calendari di iPhone non disponibili in Expo Go.' });
    const onlyGoogle = await cal.getConnections({ providers: { google } });
    expect(onlyGoogle.apple).toMatchObject({ status: 'unavailable', detail: cal.EXPORT_STRINGS.noProvider });
    await expect(cal.getProvider('apple', { providers: { google } })).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('read/write capability helpers never treat write-only as readable', () => {
    const writeOnly = { ...A_CONN, status: 'write_only' as const, canRead: false };
    expect(cal.canReadEvents(G_CONN)).toBe(true);
    expect(cal.canReadEvents(writeOnly)).toBe(false);
    expect(cal.canWriteEvents(writeOnly)).toBe(true);
    expect(cal.canWriteEvents({ ...G_CONN, status: 'disconnected' })).toBe(false);
    expect(cal.canReadEvents(null)).toBe(false);
  });

  it('lists calendars only for usable connections, with per-provider errors and label support', async () => {
    const { deps, apple } = await world();
    apple.conn = { ...A_CONN, status: 'write_only', canRead: false };
    const forRead = await cal.listCalendarsFor('read', deps);
    expect(forRead.calendars.map((c) => c.calendarId)).toEqual([G_CAL.calendarId]);
    expect(forRead.labelsSupported).toEqual({ google: true, apple: false });
    const forWrite = await cal.listCalendarsFor('write', deps);
    expect(forWrite.calendars.map((c) => c.calendarId)).toEqual([G_CAL.calendarId, A_CAL.calendarId]);
    apple.listCalendars = async () => {
      throw new ProviderError('forbidden', 'Accesso ai calendari negato.');
    };
    expect((await cal.listCalendarsFor('write', deps)).errors).toEqual({ apple: 'Accesso ai calendari negato.' });
  });

  it('connect / disconnect go to the chosen provider only', async () => {
    const { deps, google, apple } = await world();
    const connect = jest.spyOn(google, 'connect');
    expect(await cal.connectProvider('google', 'readwrite', deps)).toEqual(G_CONN);
    expect(connect).toHaveBeenCalledWith('readwrite');
    const disc = jest.spyOn(apple, 'disconnect');
    await cal.disconnectProvider('apple', deps);
    expect(disc).toHaveBeenCalled();
  });
});

describe('import: filters → review → commit', () => {
  it('builds the review from the provider and commits the selection once', async () => {
    const { deps, google, repos, surf } = await world();
    google.events = [sourceEvent(G_CAL, 'e1', 'Surf all’alba', '2026-08-02'), sourceEvent(G_CAL, 'e2', 'Cena', '2026-08-03'), { ...sourceEvent(G_CAL, 'e3', 'Surf', '2026-08-04'), status: 'cancelled' }];
    const request: cal.ImportReviewRequest = {
      provider: 'google',
      category: surf,
      filters: { calendarIds: [G_CAL.calendarId], titleContains: 'surf', labelIds: null, from: '2026-08-01', to: '2026-08-31' },
      calendars: [G_CAL],
      deviceTimeZone: TZ,
    };
    const items = await cal.loadImportReview(request, deps);
    expect(items.map((i) => [i.event.eventId, i.status])).toEqual([
      ['e1', 'new'],
      ['e3', 'cancelled'],
    ]);
    const selection = cal.defaultSelection(items);
    expect(cal.selectionCounts(items, selection)).toMatchObject({ selected: 1 });
    let n = 0;
    const commit = { category: surf, items, selection, batchId: 'batch-1', now: '2026-10-11T10:00:00.000Z', newId: () => `imp-${++n}` };
    const first = await cal.commitImportSelection(commit, deps);
    expect(first.sessions).toHaveLength(1);
    expect(first.sessions[0]).toMatchObject({ categoryId: surf.id, date: '2026-08-02', origin: 'import' });
    expect((await cal.commitImportSelection(commit, deps)).sessions).toHaveLength(0); // retried confirmation
    const again = await cal.loadImportReview(request, deps);
    expect(again.find((i) => i.event.eventId === 'e1')?.status).toBe('already_imported');
    expect(await repos.provenance.listBySession(first.sessions[0].id)).toEqual([expect.objectContaining({ externalEventId: 'e1', originalTitle: 'Surf all’alba' })]);
  });

  it('no source calendar selected: nothing is read', async () => {
    const { deps, google, surf } = await world();
    const items = await cal.loadImportReview({ provider: 'google', category: surf, filters: { calendarIds: [], titleContains: null, labelIds: null, from: '2026-08-01', to: '2026-08-31' } }, deps);
    expect(items).toEqual([]);
    expect(google.log).toEqual([]);
  });
});

describe('export: plan → execute', () => {
  const dest = (k: 'google' | 'apple'): cal.ExportDestinationInput => (k === 'google' ? { ref: G_REF, calendar: G_CAL, connection: G_CONN, labelId: '7' } : { ref: A_REF, calendar: A_CAL, connection: A_CONN, labelId: null });

  it('reviews, executes per destination and keeps choices across rebuilds', async () => {
    const { deps, repos, surf, google, apple } = await world();
    const s = await save(repos, surf, '2026-08-02');
    const req0: cal.ExportReviewRequest = { sessions: [s], category: surf, destinations: [dest('google'), dest('apple')], options: OPTIONS };
    const review = await cal.loadExportReview(req0, deps);
    expect(review.plan.destinations.map((d) => [d.ref.provider, d.rows[0].status, d.rows[0].selected])).toEqual([
      ['google', 'ready', true],
      ['apple', 'ready', true],
    ]);
    // Deselect Apple, change the prefix: the choice survives the rebuild.
    let plan = cal.setRowChoice(review.plan, review.plan.destinations[1].key, s.id, { selected: false });
    plan = cal.rebuildExportPlan(plan, { ...req0, options: { ...OPTIONS, prefix: '🌊 ' } }, review.data);
    expect(plan.destinations[0].rows[0].title.final).toBe('🌊 Surf');
    expect(plan.destinations[1].rows[0].selected).toBe(false);
    const res = await cal.executeExport(plan, {}, deps);
    expect(res.destinations.map((d) => d.counts)).toEqual([
      expect.objectContaining({ created: 1 }),
      expect.objectContaining({ created: 0, skipped: 1 }),
    ]);
    expect(google.events.map((e) => e.title)).toEqual(['🌊 Surf']);
    expect(apple.events).toEqual([]);
    const { summary } = await cal.listExportJobs(deps);
    expect(summary.counts.succeeded).toBe(1);
  });

  it('an imported session is recognised against its source event even outside the window (provenance is read)', async () => {
    const { deps, repos, surf, google } = await world();
    const s = await save(repos, surf, '2026-08-20', 'import');
    // Imported from this Google calendar from an event on 2 August; the session date was later changed.
    google.events = [sourceEvent(G_CAL, 'src-1', 'Surf con Marta', '2026-08-02')];
    await repos.provenance.insert(repos.db, {
      sessionId: s.id,
      provider: 'google',
      accountId: EMAIL,
      calendarId: G_CAL.calendarId,
      externalEventId: 'src-1',
      recurringEventId: null,
      occurrenceKey: null,
      originalTitle: 'Surf con Marta',
      sourceAllDay: false,
      sourceStart: '2026-08-02T05:00:00.000Z',
      sourceEnd: '2026-08-02T06:30:00.000Z',
      importBatchId: 'b1',
      importedAt: '2026-08-03T10:00:00.000Z',
    });
    const review = await cal.loadExportReview({ sessions: [s], category: surf, destinations: [dest('google')], options: OPTIONS }, deps);
    const row = review.plan.destinations[0].rows[0];
    expect(row).toMatchObject({ status: 'recognized', defaultAction: 'skip', selected: false });
    expect(row.duplicate).toMatchObject({ recognizedBy: 'import_source' });
    expect(row.duplicate.event?.eventId).toBe('src-1');
    expect(google.log).toContain('getEvent');
  });

  it('an unreadable destination is "not checked", never reported as checked', async () => {
    const { deps, repos, surf, google } = await world();
    const s = await save(repos, surf, '2026-08-02');
    google.listEvents = async () => {
      throw new ProviderError('offline', 'Sei offline.');
    };
    const review = await cal.loadExportReview({ sessions: [s], category: surf, destinations: [dest('google')], options: OPTIONS }, deps);
    expect(review.data.reads[cal.destinationKey(G_REF)]).toEqual({ events: null, error: 'Sei offline.' });
    expect(review.plan.destinations[0]).toMatchObject({ checked: false });
    expect(review.plan.destinations[0].rows[0]).toMatchObject({ status: 'not_checked', selected: false });
  });
});

describe('automatic export: configuration, jobs', () => {
  it('config get/set/check and turning it off', async () => {
    const { deps, surf } = await world();
    expect(await cal.getAutoExportConfig(deps)).toEqual(cal.defaultConfig());
    const cfg = { ...cal.defaultConfig(), enabled: true, scope: { categoryIds: [surf.id] }, destinations: { google: { calendarId: G_CAL.calendarId, accountId: EMAIL, labelId: null } } };
    expect(await cal.setAutoExportConfig(cfg, deps)).toEqual(cfg);
    expect(await cal.getAutoExportConfig(deps)).toEqual(cfg);
    expect(await cal.checkAutoExportConfig(cfg, deps)).toMatchObject({ runnable: true, issues: [] });
    const wrong = { ...cfg, destinations: { google: { calendarId: 'missing', accountId: EMAIL, labelId: null } } };
    expect((await cal.checkAutoExportConfig(wrong, deps)).issues.map((i) => i.code)).toEqual(['calendar_not_found']);
    const off = await cal.turnOffAutoExport({ cancelPending: true }, deps);
    expect(off.config.enabled).toBe(false);
    expect((await cal.getAutoExportConfig(deps)).enabled).toBe(false);
  });

  it('resolves a job waiting in "Da rivedere"', async () => {
    const { deps, repos, surf } = await world();
    const s = await save(repos, surf, '2026-08-02');
    const job = await repos.exportJobs.enqueue({
      opId: cal.exportOpId(s.id, G_REF),
      sessionId: s.id,
      provider: 'google',
      accountId: EMAIL,
      calendarId: G_CAL.calendarId,
      kind: 'auto',
      payload: { v: 1, source: 'auto_export', categoryId: surf.id, categoryName: 'Surf', review: { code: 'possible_duplicate', eventIds: [] } },
      status: 'needs_review',
      reviewReason: 'Possibile doppione',
    });
    const done = await cal.resolveExportJob(job.id, { kind: 'skip' }, deps);
    expect(done.status).toBe('cancelled');
    const { summary } = await cal.listExportJobs(deps);
    expect(summary.counts.cancelled).toBe(1);
    expect(summary.badge.tone).toBe('none');
  });
});
