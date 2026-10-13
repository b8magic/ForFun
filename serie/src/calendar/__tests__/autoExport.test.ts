import initSqlJs from 'sql.js';
import { ProviderError, type CalendarProvider, type Connection, type EventDraft, type EventTime, type ExternalCalendar, type ExternalEvent, type ListEventsQuery } from '../types';
import type { ProviderKind, Session } from '@/domain/types';
import { createRepositories, type Repositories } from '@/data/repositories';
import { createSqlJsDriver } from '@/data/sqljs';
import { migrate } from '@/data/migrations';
import { buildTiming, type TimingInput } from '@/domain/timing';
import { zonedToEpoch } from '@/domain/zoned';
import { summarize } from '@/domain/stats';
import { t } from '@/i18n/it';
import { testRepos } from '@/test/sqljs';
import { exportOpId } from '../opId';
import {
  AUTO_EXPORT_SETTINGS_KEY,
  AUTO_EXPORT_STRINGS,
  BACKOFF_SCHEDULE_MS,
  JOB_STATUS_LABELS,
  OFFLINE_RECHECK_MS,
  RUNNING_STALE_MS,
  backoffDelayMs,
  defaultConfig,
  disableAutoExport,
  eligibleDestinations,
  enqueueForSessions,
  isPairResolved,
  loadConfig,
  normalizeConfig,
  parsePayload,
  representationApproval,
  resolveReviewJob,
  runJobs,
  saveConfig,
  summarizeJobs,
  validateConfig,
  withBothResolved,
  type AutoExportConfig,
  type ReviewAction,
} from '../autoExport';

// ─── fixtures ────────────────────────────────────────────────────────────────

const EMAIL = 'surfer@gmail.com';
const TZ = 'Europe/Rome';
const DATE = '2026-10-05';
const NOW = new Date('2026-10-10T09:00:00.000Z');
const plus = (d: Date, ms: number) => new Date(d.getTime() + ms);
const MIN = 60_000;
const HOUR = 60 * MIN;

function cal(p: Partial<ExternalCalendar> & Pick<ExternalCalendar, 'provider' | 'calendarId' | 'title'>): ExternalCalendar {
  return { accountId: EMAIL, accountLabel: EMAIL, color: null, access: 'owner', canRead: true, canWrite: true, isPrimary: false, sourceType: null, sourceName: null, ...p };
}

const G_PRIMARY = cal({ provider: 'google', calendarId: EMAIL, title: 'Mario Rossi', isPrimary: true });
const G_SPORT = cal({ provider: 'google', calendarId: 'sport@group.calendar.google.com', title: 'Sport' });
const G_HOLIDAYS = cal({ provider: 'google', calendarId: 'it.italian#holiday@group.v.calendar.google.com', title: 'Festività', access: 'reader', canWrite: false });
const A_ICLOUD = cal({ provider: 'apple', accountId: 'src-icloud', accountLabel: 'iCloud', calendarId: 'ek-home', title: 'Casa', sourceType: 'caldav', sourceName: 'iCloud' });
const A_GSPORT = cal({ provider: 'apple', accountId: 'src-google', accountLabel: EMAIL, calendarId: 'ek-sport', title: 'Sport', sourceType: 'caldav', sourceName: EMAIL });
const A_GMAIL = cal({ provider: 'apple', accountId: 'src-gmail', accountLabel: 'Gmail', calendarId: 'ek-gmail', title: 'Sport', sourceType: 'caldav', sourceName: 'Gmail' });
const A_GMAIL2 = cal({ provider: 'apple', accountId: 'src-gmail', accountLabel: 'Gmail', calendarId: 'ek-gmail-2', title: 'Allenamenti', sourceType: 'caldav', sourceName: 'Gmail' });
const A_LOCAL = cal({ provider: 'apple', accountId: 'src-local', accountLabel: 'Sul mio iPhone', calendarId: 'ek-local', title: 'Surf', sourceType: 'local', sourceName: 'Default' });
const GOOGLE_CALS = [G_PRIMARY, G_SPORT, G_HOLIDAYS];
const APPLE_CALS = [A_ICLOUD, A_GSPORT, A_GMAIL, A_GMAIL2, A_LOCAL];
const ALL_CALS = [...GOOGLE_CALS, ...APPLE_CALS];

const ref = (c: ExternalCalendar) => ({ provider: c.provider, accountId: c.accountId, calendarId: c.calendarId });

type Fail = ProviderError | Error | { afterWrite: ProviderError | Error };
type Method = 'getConnection' | 'listCalendars' | 'listEvents' | 'findByOpId' | 'createEvent';

/** In-memory provider with scripted failures. */
class FakeProvider implements CalendarProvider {
  readonly capabilities: { eventLabels: boolean };
  events: ExternalEvent[] = [];
  fail: Partial<Record<Method, Fail[]>> = {};
  calls: Record<Method, number> = { getConnection: 0, listCalendars: 0, listEvents: 0, findByOpId: 0, createEvent: 0 };
  connection: Connection;
  /** Runs inside listEvents, i.e. while a job is being checked (simulates the user acting mid-run). */
  beforeList: (() => Promise<void>) | null = null;
  private seq = 0;

  constructor(
    readonly kind: ProviderKind,
    public calendars: ExternalCalendar[],
  ) {
    this.capabilities = { eventLabels: kind === 'google' };
    this.connection =
      kind === 'google'
        ? { provider: 'google', status: 'connected', accountId: EMAIL, accountLabel: EMAIL, canRead: true, canWrite: true, detail: null }
        : { provider: 'apple', status: 'connected', accountId: null, accountLabel: null, canRead: true, canWrite: true, detail: null };
  }

  private take(m: Method): Fail | undefined {
    this.calls[m]++;
    return this.fail[m]?.shift();
  }
  private throwIf(m: Method) {
    const f = this.take(m);
    if (f && !('afterWrite' in f)) throw f;
  }

  async getConnection() {
    this.throwIf('getConnection');
    return this.connection;
  }
  async connect() {
    return this.connection;
  }
  async disconnect() {}
  async listCalendars() {
    this.throwIf('listCalendars');
    return this.calendars;
  }
  async listLabels() {
    return [];
  }
  async listEvents(q: ListEventsQuery) {
    if (this.beforeList) await this.beforeList();
    this.throwIf('listEvents');
    return this.events.filter(
      (e) => q.calendarIds.includes(e.calendarId) && e.start.date <= q.to && (e.allDay ? e.end.date > q.from : e.start.date >= q.from) && (q.includeCancelled || e.status !== 'cancelled'),
    );
  }
  async getEvent(calendarId: string, eventId: string) {
    return this.events.find((e) => e.calendarId === calendarId && e.eventId === eventId) ?? null;
  }
  async findByOpId(calendarId: string, opId: string, around: { from: string; to: string }) {
    this.throwIf('findByOpId');
    return this.events.find((e) => e.calendarId === calendarId && e.appMeta?.opId === opId && e.start.date >= around.from && e.start.date <= around.to) ?? null;
  }
  async createEvent(calendarId: string, draft: EventDraft) {
    const f = this.take('createEvent');
    if (f && !('afterWrite' in f)) throw f;
    const c = this.calendars.find((x) => x.calendarId === calendarId)!;
    const ev = eventFrom(c, `${this.kind}-ev-${++this.seq}`, draft);
    this.events.push(ev);
    if (f) throw f.afterWrite;
    return ev;
  }
  async updateEvent(): Promise<ExternalEvent> {
    throw new Error('auto export never updates events');
  }
  /** Events Serie wrote (created through createEvent). */
  get written() {
    return this.events.filter((e) => e.eventId.startsWith(`${this.kind}-ev-`));
  }
}

function point(p: EventDraft['start']): EventTime {
  return { date: p.date, time: p.time, timeZone: p.timeZone, instant: p.time && p.timeZone ? new Date(zonedToEpoch(p.date, p.time, p.timeZone).epochMs).toISOString() : null };
}

function eventFrom(c: ExternalCalendar, eventId: string, d: EventDraft): ExternalEvent {
  return { ...ref(c), eventId, recurringEventId: null, occurrenceKey: null, title: d.title, notes: d.notes, location: d.location, allDay: d.allDay, start: point(d.start), end: point(d.end), status: 'confirmed', colorId: d.colorId, appMeta: d.appMeta, updated: null };
}

function foreignEvent(c: ExternalCalendar, eventId: string, title: string, date: string, start: string, end: string): ExternalEvent {
  return eventFrom(c, eventId, {
    title,
    notes: null,
    location: null,
    allDay: false,
    start: { date, time: start, timeZone: TZ },
    end: { date, time: end, timeZone: TZ },
    colorId: null,
    appMeta: null as never,
  });
}

async function setup() {
  const repos = await testRepos();
  const surf = await repos.categories.create({ name: 'Surf', color: '#2E7D9A', pattern: 'swell' });
  const run = await repos.categories.create({ name: 'Corsa', color: '#C0392B', pattern: 'stride' });
  const google = new FakeProvider('google', [...GOOGLE_CALS]);
  const apple = new FakeProvider('apple', [...APPLE_CALS]);
  return { repos, surf, run, google, apple, providers: { google, apple }, categories: [surf, run] };
}

let reqSeq = 0;
async function save(repos: Repositories, categoryId: string, timing?: TimingInput, extra: { date?: string; origin?: 'manual' | 'import'; notes?: string } = {}): Promise<Session> {
  const date = extra.date ?? DATE;
  const tm = timing ? buildTiming(date, timing) : null;
  if (tm && !tm.ok) throw new Error(`bad timing ${tm.error}`);
  const r = await repos.sessions.saveBatch({
    categoryId,
    dates: [date],
    requestId: `req-${++reqSeq}`,
    shared: { ...(tm?.ok ? { timing: tm.timing } : {}), ...(extra.notes ? { notes: extra.notes } : {}) },
    origin: extra.origin,
  });
  return r.sessions[0];
}

const INTERVAL: TimingInput = { state: 'interval', start: '07:30', end: '09:00', endDayOffset: 0, timeZone: TZ };
const START_ONLY: TimingInput = { state: 'start_only', start: '07:30', timeZone: TZ };

function enabled(p: Partial<AutoExportConfig> = {}): AutoExportConfig {
  return { ...defaultConfig(), enabled: true, destinations: { google: { calendarId: G_SPORT.calendarId, accountId: EMAIL, labelId: '7' } }, ...p };
}

async function importProvenance(repos: Repositories, sessionId: string, source: ExternalCalendar, originalTitle = 'Surf con Marta') {
  await repos.provenance.insert(repos.db, {
    sessionId,
    provider: source.provider,
    accountId: source.accountId,
    calendarId: source.calendarId,
    externalEventId: 'src-ev-1',
    recurringEventId: null,
    occurrenceKey: null,
    originalTitle,
    sourceAllDay: false,
    sourceStart: '2026-10-05T05:30:00.000Z',
    sourceEnd: '2026-10-05T07:00:00.000Z',
    importBatchId: 'batch-1',
    importedAt: '2026-10-09T10:00:00.000Z',
  });
}

const jobOf = async (repos: Repositories, opId: string) => (await repos.exportJobs.list()).filter((j) => j.opId === opId).pop()!;

// ─── configuration ───────────────────────────────────────────────────────────

describe('configuration', () => {
  it('is off by default: manual only, start-only needs opt-in, no forwarding', async () => {
    const { repos } = await setup();
    const c = await loadConfig(repos);
    expect(c).toEqual(defaultConfig());
    expect(c).toMatchObject({ enabled: false, scope: 'all', forwardImported: false, bothResolution: null, bothResolvedPairs: [] });
    expect(c.representation.startOnly).toEqual({ mode: 'review' });
  });

  it('persists under the "autoExport" settings key and sanitises what it reads', async () => {
    const { repos, surf } = await setup();
    const cfg = enabled({ scope: { categoryIds: [surf.id] }, title: { prefix: '🌊 ', suffix: ' · log' }, representation: { ...defaultConfig().representation, startOnly: { mode: 'span', minutes: 90 } } });
    await saveConfig(repos, cfg);
    expect(await repos.settings.get(AUTO_EXPORT_SETTINGS_KEY, null)).toEqual(cfg);
    expect(await loadConfig(repos)).toEqual(cfg);

    const bad = normalizeConfig({ enabled: 'yes', representation: { startOnly: { mode: 'span', minutes: 0 }, interval: 'whatever' }, destinations: { google: { calendarId: '' } }, bothResolution: 'sure' });
    expect(bad.enabled).toBe(false);
    expect(bad.representation.startOnly).toEqual({ mode: 'review' });
    expect(bad.representation.interval).toBe('interval');
    expect(bad.destinations).toEqual({});
    expect(bad.bothResolution).toBeNull();
    expect(normalizeConfig(null)).toEqual(defaultConfig());
  });

  it('representation rules: start-only is approved only with a valid opt-in span', () => {
    const rules = defaultConfig().representation;
    expect(representationApproval('date_only', rules)).toEqual({ approved: true, startOnlySpanMin: null });
    expect(representationApproval('interval', rules).approved).toBe(true);
    expect(representationApproval('duration_only', rules).approved).toBe(true);
    expect(representationApproval('start_duration', rules).approved).toBe(true);
    const so = representationApproval('start_only', rules);
    expect(so.approved).toBe(false);
    if (!so.approved) expect(so.review).toEqual({ code: 'start_only_not_approved', message: t.reprStartOnly });
    expect(representationApproval('start_only', { ...rules, startOnly: { mode: 'span', minutes: 75 } })).toEqual({ approved: true, startOnlySpanMin: 75 });
    expect(representationApproval('start_only', { ...rules, startOnly: { mode: 'span', minutes: 5000 } }).approved).toBe(false);
    expect(representationApproval('start_only', rules, 45)).toEqual({ approved: true, startOnlySpanMin: 45 });
    expect(representationApproval('date_only', { ...rules, dateOnly: 'review' }).approved).toBe(false);
  });
});

describe('validateConfig', () => {
  it('accepts a writable Google destination', () => {
    expect(validateConfig(enabled(), ALL_CALS)).toEqual({ runnable: true, bothRunnable: true, issues: [] });
  });

  it('reports missing, read-only and mismatched destinations, empty scope and invalid spans', () => {
    const v = validateConfig(
      enabled({
        scope: { categoryIds: ['c3'] },
        destinations: { google: { calendarId: G_HOLIDAYS.calendarId, accountId: EMAIL, labelId: null }, apple: { calendarId: 'gone', accountId: 'x' } },
        categoryOverrides: { c1: { destinations: {} }, c2: { destinations: { google: { calendarId: G_SPORT.calendarId, accountId: 'other@gmail.com', labelId: null } } } },
        representation: { ...defaultConfig().representation, startOnly: { mode: 'span', minutes: 0 } },
      }),
      ALL_CALS,
    );
    // Only 'c3' is in scope and it has no override → only the default set is checked.
    expect(v.runnable).toBe(false);
    expect(v.issues.map((i) => i.code).sort()).toEqual(['calendar_not_found', 'calendar_not_writable', 'start_only_span_invalid']);
    expect(v.issues.find((i) => i.code === 'calendar_not_found')?.provider).toBe('apple');

    // An empty selection of activities is itself the problem (no destination set is in use).
    expect(validateConfig(enabled({ scope: { categoryIds: [] } }), ALL_CALS).issues.map((i) => i.code)).toEqual(['scope_empty']);
    expect(v.issues.find((i) => i.code === 'calendar_not_writable')?.message).toBe(AUTO_EXPORT_STRINGS.issues.calendar_not_writable);

    const all = validateConfig(
      enabled({ categoryOverrides: { c1: { destinations: {} }, c2: { destinations: { google: { calendarId: G_SPORT.calendarId, accountId: 'other@gmail.com', labelId: null } } } } }),
      ALL_CALS,
    );
    expect(all.issues.map((i) => [i.code, i.categoryId])).toEqual([
      ['no_destination', 'c1'],
      ['account_mismatch', 'c2'],
    ]);
  });

  it('cannot verify a provider whose calendars are not listed (warning only)', () => {
    const v = validateConfig(enabled({ destinations: { apple: { calendarId: A_ICLOUD.calendarId, accountId: A_ICLOUD.accountId } } }), GOOGLE_CALS);
    expect(v.runnable).toBe(true);
    expect(v.issues).toEqual([expect.objectContaining({ code: 'calendar_unverified', severity: 'warning', provider: 'apple' })]);
  });

  it('blocks "Both" for equivalent destinations and for unresolved ambiguity', () => {
    const both = (apple: ExternalCalendar) => enabled({ destinations: { google: { calendarId: G_SPORT.calendarId, accountId: EMAIL, labelId: null }, apple: { calendarId: apple.calendarId, accountId: apple.accountId } } });

    const eq = validateConfig(both(A_GSPORT), ALL_CALS);
    expect(eq).toMatchObject({ runnable: false, bothRunnable: false });
    expect(eq.issues[0]).toMatchObject({ code: 'both_equivalent', message: t.equivalentWarning });
    expect(eq.issues[0].gate?.equivalence.details.apple.accountLabel).toBe(EMAIL);

    const unk = validateConfig(both(A_GMAIL), ALL_CALS);
    expect(unk.issues[0]).toMatchObject({ code: 'both_unresolved', message: t.equivalenceUnknown });
    expect(unk.issues[0].gate?.equivalence.details.apple).toMatchObject({ accountLabel: 'Gmail', calendarTitle: 'Sport' });

    const resolved = withBothResolved(both(A_GMAIL), ref(G_SPORT), ref(A_GMAIL));
    expect(validateConfig(resolved, ALL_CALS)).toMatchObject({ runnable: true, bothRunnable: true });
    // The confirmation is specific to the pair: another ambiguous Apple calendar needs its own.
    const moved = { ...resolved, destinations: { ...resolved.destinations, apple: { calendarId: A_GMAIL2.calendarId, accountId: A_GMAIL2.accountId } } };
    expect(validateConfig(moved, ALL_CALS).bothRunnable).toBe(false);

    expect(validateConfig(both(A_ICLOUD), ALL_CALS)).toMatchObject({ runnable: true, bothRunnable: true });
  });
});

// ─── planning & enqueue ──────────────────────────────────────────────────────

describe('enqueue', () => {
  it('queues nothing while disabled (default)', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const r = await enqueueForSessions(repos, [s], categories, await loadConfig(repos));
    expect(r).toMatchObject({ jobs: [], created: 0 });
    expect(r.skipped).toEqual([{ sessionId: s.id, provider: null, code: 'disabled', message: AUTO_EXPORT_STRINGS.exclusion.disabled }]);
    expect(await repos.exportJobs.list()).toEqual([]);
    expect((await runJobs({ repos, providers, now: NOW })).processed).toBe(0);
    expect(google.calls.createEvent).toBe(0);
  });

  it('enables only the selected activities and exports with the configured title, label and content', async () => {
    const { repos, categories, surf, run, providers, google } = await setup();
    const cfg = enabled({ scope: { categoryIds: [surf.id] }, title: { prefix: '🌊 ', suffix: ' · log' }, includeNotes: true });
    const s = await save(repos, surf.id, INTERVAL, { notes: 'Libeccio, 1 m' });
    const r2 = await save(repos, run.id, INTERVAL);
    const res = await enqueueForSessions(repos, [s, r2], categories, cfg);
    expect(res.created).toBe(1);
    expect(res.jobs).toHaveLength(1);
    expect(res.jobs[0]).toMatchObject({ sessionId: s.id, provider: 'google', calendarId: G_SPORT.calendarId, accountId: EMAIL, kind: 'auto', status: 'pending', opId: exportOpId(s.id, ref(G_SPORT)) });
    expect(res.skipped).toEqual([expect.objectContaining({ sessionId: r2.id, code: 'out_of_scope' })]);

    const out = await runJobs({ repos, providers, now: NOW });
    expect(out.outcomes).toEqual([expect.objectContaining({ status: 'succeeded', sessionId: s.id, message: null })]);
    expect(google.written).toHaveLength(1);
    const ev = google.written[0];
    expect(ev).toMatchObject({ title: '🌊 Surf · log', colorId: '7', allDay: false, notes: 'Libeccio, 1 m' });
    expect(ev.start).toMatchObject({ date: DATE, time: '07:30', timeZone: TZ });
    expect(ev.end).toMatchObject({ date: DATE, time: '09:00' });
    expect(ev.appMeta).toMatchObject({ sessionId: s.id, opId: res.jobs[0].opId, timingState: 'interval', durationSec: 5400, schedulingPlaceholder: false });
    const link = await repos.exportLinks.byOp(res.jobs[0].opId);
    expect(link).toMatchObject({ sessionId: s.id, status: 'created', externalEventId: ev.eventId, provider: 'google', calendarId: G_SPORT.calendarId });
    expect(link?.snapshot).toMatchObject({ title: '🌊 Surf · log', categoryName: 'Surf', durationSec: 5400, schedulingPlaceholder: false });
    const job = await jobOf(repos, res.jobs[0].opId);
    expect(job).toMatchObject({ status: 'succeeded', attempts: 1, lastError: null, nextAttemptAt: null });
    expect(JOB_STATUS_LABELS[job.status]).toBe(t.jobSucceeded); // "accepted by the calendar", not cloud sync
  });

  it('uses per-activity destination overrides', async () => {
    const { repos, categories, surf, run } = await setup();
    const cfg = enabled({ categoryOverrides: { [run.id]: { destinations: { apple: { calendarId: A_ICLOUD.calendarId, accountId: A_ICLOUD.accountId } } } } });
    const a = await save(repos, surf.id);
    const b = await save(repos, run.id);
    const res = await enqueueForSessions(repos, [a, b], categories, cfg);
    expect(res.jobs.map((j) => [j.sessionId, j.provider, j.calendarId])).toEqual([
      [a.id, 'google', G_SPORT.calendarId],
      [b.id, 'apple', A_ICLOUD.calendarId],
    ]);
  });

  it('is idempotent per operation: no second job while open, nor after success or cancellation', async () => {
    const { repos, categories, surf, providers } = await setup();
    const cfg = enabled();
    const s = await save(repos, surf.id, INTERVAL);
    const first = await enqueueForSessions(repos, [s], categories, cfg);
    const again = await enqueueForSessions(repos, [s], categories, cfg);
    expect(again.created).toBe(0);
    expect(again.jobs.map((j) => j.id)).toEqual(first.jobs.map((j) => j.id));
    expect(await repos.exportJobs.list()).toHaveLength(1);

    await runJobs({ repos, providers, now: NOW });
    const after = await enqueueForSessions(repos, [s], categories, cfg);
    expect(after.created).toBe(0);
    expect(after.skipped).toEqual([expect.objectContaining({ code: 'already_exported' })]);
    expect(await repos.exportJobs.list()).toHaveLength(1);

    const s2 = await save(repos, surf.id, INTERVAL);
    const q = await enqueueForSessions(repos, [s2], categories, cfg);
    await resolveReviewJob(repos, q.jobs[0].id, { kind: 'skip' });
    const again2 = await enqueueForSessions(repos, [s2], categories, cfg);
    expect(again2.skipped).toEqual([expect.objectContaining({ code: 'already_queued' })]);
  });

  it('persists the Undo deadline and keeps it unchanged when the same operation is queued again', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const cfg = enabled();
    const s = await save(repos, surf.id, INTERVAL);
    const notBefore = plus(NOW, 14_000).toISOString();
    const first = await enqueueForSessions(repos, [s], categories, cfg, { notBefore });
    expect(first.jobs[0]).toMatchObject({ status: 'pending', attempts: 0, nextAttemptAt: notBefore, opId: exportOpId(s.id, ref(G_SPORT)) });

    for (const options of [{}, { notBefore: NOW.toISOString() }, { notBefore: plus(NOW, 30_000).toISOString() }]) {
      const again = await enqueueForSessions(repos, [s], categories, cfg, options);
      expect(again.created).toBe(0);
      expect(again.jobs).toEqual(first.jobs);
    }
    expect(await repos.exportJobs.list()).toHaveLength(1);

    for (const elapsed of [0, 6000, 12000, 13999]) {
      const now = plus(NOW, elapsed);
      expect(await repos.exportJobs.due(now.toISOString())).toEqual([]);
      expect((await runJobs({ repos, providers, now })).processed).toBe(0);
    }
    expect(google.calls.createEvent).toBe(0);
    const due = await repos.exportJobs.due(notBefore);
    expect(due.map((job) => job.id)).toEqual([first.jobs[0].id]);
    expect((await runJobs({ repos, providers, now: plus(NOW, 14_000) })).outcomes[0].status).toBe('succeeded');
    expect(google.calls.createEvent).toBe(1);
  });

  it.each(['retry', 'approve_span'] as const)('preserves the deadline after %s and a database restart, without exporting a deleted session', async (kind) => {
    const SQL = await initSqlJs();
    let bytes: Uint8Array | null = null;
    let id = 0;
    const deps = { newId: () => `restart-${++id}`, now: () => NOW.toISOString() };
    const db = createSqlJsDriver(SQL, null, { load: async () => bytes, save: async (snapshot) => { bytes = snapshot; } });
    await migrate(db);
    const repos = createRepositories(db, deps);
    const surf = await repos.categories.create({ name: 'Surf', color: '#2E7D9A', pattern: 'swell' });
    const kept = await save(repos, surf.id, kind === 'approve_span' ? START_ONLY : INTERVAL);
    const undone = await save(repos, surf.id, INTERVAL);
    const cfg = await saveConfig(repos, enabled());
    const notBefore = plus(NOW, 14_000).toISOString();
    const queued = await enqueueForSessions(repos, [kept, undone], [surf], cfg, { notBefore });
    const resumed = await resolveReviewJob(repos, queued.jobs[0].id, kind === 'retry' ? { kind } : { kind, minutes: 60 }, { now: () => plus(NOW, 3000) });
    expect(resumed.nextAttemptAt).toBe(notBefore);
    expect(parsePayload(resumed.payload)?.notBefore).toBe(notBefore);
    await repos.sessions.remove([undone.id]);
    await db.close();
    expect(bytes).not.toBeNull();

    const reopened = createRepositories(createSqlJsDriver(SQL, bytes), deps);
    const google = new FakeProvider('google', [...GOOGLE_CALS]);
    try {
      expect(await reopened.sessions.get(undone.id)).toBeNull();
      expect(await reopened.exportJobs.list()).toEqual([resumed]);
      expect(await reopened.exportJobs.due(plus(NOW, 12_000).toISOString())).toEqual([]);
      expect((await runJobs({ repos: reopened, providers: { google }, now: plus(NOW, 12_000) })).processed).toBe(0);
      expect(google.calls.createEvent).toBe(0);
      expect((await runJobs({ repos: reopened, providers: { google }, now: plus(NOW, 14_000) })).outcomes).toEqual([
        expect.objectContaining({ sessionId: kept.id, opId: queued.jobs[0].opId, status: 'succeeded' }),
      ]);
      expect(google.written).toHaveLength(1);
      expect(google.written[0].appMeta?.sessionId).toBe(kept.id);
    } finally {
      await reopened.db.close();
    }
  });

  it.each<ReviewAction>([
    { kind: 'retry' },
    { kind: 'retry', config: enabled({ title: { prefix: 'Nuovo · ', suffix: '' } }) },
    { kind: 'approve_span', minutes: 60 },
    { kind: 'create_separate' },
  ])('keeps the original Undo deadline when review action $kind requests an immediate run', async (action) => {
    const { repos, categories, surf, providers, google } = await setup();
    const session = await save(repos, surf.id, action.kind === 'approve_span' ? START_ONLY : INTERVAL);
    const notBefore = plus(NOW, 14_000).toISOString();
    const { jobs } = await enqueueForSessions(repos, [session], categories, enabled(), { notBefore });
    if (action.kind === 'create_separate') {
      await repos.exportJobs.update(jobs[0].id, { status: 'needs_review', payload: { ...parsePayload(jobs[0].payload), review: { code: 'possible_duplicate', eventIds: [] } } });
    }
    const resumed = await resolveReviewJob(repos, jobs[0].id, action, { now: () => plus(NOW, 3000) });
    expect(resumed).toMatchObject({ id: jobs[0].id, status: 'pending', nextAttemptAt: notBefore });
    expect(parsePayload(resumed.payload)?.notBefore).toBe(notBefore);
    for (const elapsed of [3000, 6000, 12000, 13999]) {
      const now = plus(NOW, elapsed);
      expect(await repos.exportJobs.due(now.toISOString())).toEqual([]);
      expect((await runJobs({ repos, providers, now })).processed).toBe(0);
    }
    expect(google.calls.createEvent).toBe(0);
    expect((await runJobs({ repos, providers, now: plus(NOW, 14_000) })).outcomes[0].status).toBe('succeeded');
    expect(google.calls.createEvent).toBe(1);
  });

  it.each(['cleared retry schedule', 'offline reconnect', 'reclaimed running job'] as const)('enforces the persisted Undo deadline independently of %s', async (mode) => {
    const { repos, categories, surf, providers, google } = await setup();
    const session = await save(repos, surf.id, INTERVAL);
    const notBefore = plus(NOW, 14_000).toISOString();
    const { jobs } = await enqueueForSessions(repos, [session], categories, enabled(), { notBefore });
    await repos.exportJobs.update(jobs[0].id, {
      status: mode === 'reclaimed running job' ? 'running' : 'pending',
      nextAttemptAt: mode === 'offline reconnect' ? plus(NOW, MIN).toISOString() : null,
      payload: { ...parsePayload(jobs[0].payload), deferred: mode === 'offline reconnect' ? 'offline' : null },
    });
    for (const elapsed of [3000, 12000, 13999]) {
      expect((await runJobs({ repos, providers, now: plus(NOW, elapsed), isOnline: true })).processed).toBe(0);
    }
    expect(google.calls.createEvent).toBe(0);
    expect((await runJobs({ repos, providers, now: plus(NOW, 14_000), isOnline: true })).outcomes[0].status).toBe('succeeded');
    expect(google.calls.createEvent).toBe(1);
  });

  it('excludes imported sessions unless forwarding is on, and never targets their source calendar', async () => {
    const { repos, categories, surf } = await setup();
    const imported = await save(repos, surf.id, INTERVAL, { origin: 'import' });
    await importProvenance(repos, imported.id, G_SPORT);
    const both = { google: { calendarId: G_SPORT.calendarId, accountId: EMAIL, labelId: null }, apple: { calendarId: A_ICLOUD.calendarId, accountId: A_ICLOUD.accountId } };

    const off = await enqueueForSessions(repos, [imported], categories, enabled({ destinations: both }));
    expect(off.jobs).toEqual([]);
    expect(off.skipped).toEqual([expect.objectContaining({ code: 'imported_not_forwarded' })]);

    const on = await enqueueForSessions(repos, [imported], categories, enabled({ destinations: both, forwardImported: true }));
    expect(on.jobs.map((j) => j.provider)).toEqual(['apple']);
    expect(on.skipped).toEqual([expect.objectContaining({ code: 'source_calendar', provider: 'google' })]);

    // Imported without provenance: its source cannot be ruled out.
    const orphan = await save(repos, surf.id, INTERVAL, { origin: 'import' });
    const r = await enqueueForSessions(repos, [orphan], categories, enabled({ destinations: both, forwardImported: true }));
    expect(r.skipped).toEqual([expect.objectContaining({ code: 'imported_source_unknown' })]);
  });

  it('never forwards into the source calendar seen through the other route', async () => {
    const { repos, categories, surf, providers, apple } = await setup();
    const imported = await save(repos, surf.id, INTERVAL, { origin: 'import' });
    await importProvenance(repos, imported.id, G_SPORT);
    const cfg = enabled({ forwardImported: true, destinations: { apple: { calendarId: A_GSPORT.calendarId, accountId: A_GSPORT.accountId } } });

    const plan = eligibleDestinations(imported, { id: surf.id, name: 'Surf' }, cfg, await repos.provenance.listBySession(imported.id), { calendars: ALL_CALS });
    expect(plan.eligible).toEqual([]);
    expect(plan.excluded).toEqual([expect.objectContaining({ code: 'source_calendar_equivalent', provider: 'apple' })]);

    // Queued without calendar details: the run checks with live calendars and cancels.
    const q = await enqueueForSessions(repos, [imported], categories, cfg);
    expect(q.jobs).toHaveLength(1);
    const out = await runJobs({ repos, providers, now: NOW });
    expect(out.outcomes[0]).toMatchObject({ status: 'cancelled', message: AUTO_EXPORT_STRINGS.cancelled.sourceCalendar });
    expect(apple.calls.createEvent).toBe(0);
  });
});

// ─── representation ──────────────────────────────────────────────────────────

describe('representation approval', () => {
  it('start-only without opt-in goes straight to "Da rivedere" and the session stays saved', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const s = await save(repos, surf.id, START_ONLY);
    const res = await enqueueForSessions(repos, [s], categories, enabled());
    expect(res.needsReview).toBe(1);
    expect(res.jobs[0]).toMatchObject({ status: 'needs_review', reviewReason: t.reprStartOnly });
    expect(parsePayload(res.jobs[0].payload)?.review?.code).toBe('start_only_not_approved');
    await runJobs({ repos, providers, now: NOW });
    expect(google.calls.createEvent).toBe(0);
    expect((await repos.sessions.get(s.id))?.timing).toMatchObject({ state: 'start_only', start: '07:30', durationSec: null });
  });

  it('a representation rule set to review also waits for review', async () => {
    const { repos, categories, surf } = await setup();
    const s = await save(repos, surf.id);
    const res = await enqueueForSessions(repos, [s], categories, enabled({ representation: { ...defaultConfig().representation, dateOnly: 'review' } }));
    expect(res.jobs[0]).toMatchObject({ status: 'needs_review', reviewReason: AUTO_EXPORT_STRINGS.review.representation_not_approved });
  });

  it('start-only with an opted-in span: export-only placeholder, local duration and stats unaffected', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const s = await save(repos, surf.id, START_ONLY);
    const cfg = enabled({ representation: { ...defaultConfig().representation, startOnly: { mode: 'span', minutes: 90 } } });
    const res = await enqueueForSessions(repos, [s], categories, cfg);
    expect(res.jobs[0].status).toBe('pending');
    await runJobs({ repos, providers, now: NOW });

    const ev = google.written[0];
    expect(ev.start).toMatchObject({ date: DATE, time: '07:30', timeZone: TZ });
    expect(ev.end).toMatchObject({ date: DATE, time: '09:00' });
    expect(ev.appMeta).toMatchObject({ timingState: 'start_only', durationSec: null, durationSource: null, schedulingPlaceholder: true });
    const link = await repos.exportLinks.byOp(res.jobs[0].opId);
    expect(link?.snapshot).toMatchObject({ schedulingPlaceholder: true, durationSec: null, timingState: 'start_only' });

    const stored = await repos.sessions.listAll();
    expect(stored[0].timing).toMatchObject({ state: 'start_only', durationSec: null, durationSource: null });
    expect(summarize(stored)).toEqual({ sessions: 1, activeDays: 1, duration: { knownSec: 0, knownCount: 0, totalCount: 1 } });
  });

  it('approving a span from the review exports that item (export-only)', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const s = await save(repos, surf.id, START_ONLY);
    const res = await enqueueForSessions(repos, [s], categories, enabled());
    await expect(resolveReviewJob(repos, res.jobs[0].id, { kind: 'approve_span', minutes: 0 })).rejects.toMatchObject({ code: 'invalid_span' });
    const reopened = await resolveReviewJob(repos, res.jobs[0].id, { kind: 'approve_span', minutes: 60 });
    expect(reopened).toMatchObject({ status: 'pending', reviewReason: null });
    await runJobs({ repos, providers, now: NOW });
    expect(google.written[0].end.time).toBe('08:30');
    expect(google.written[0].appMeta).toMatchObject({ schedulingPlaceholder: true, durationSec: null });
    expect((await repos.sessions.get(s.id))?.timing.durationSec).toBeNull();
  });
});

// ─── running jobs ────────────────────────────────────────────────────────────

describe('runJobs — connectivity and retries', () => {
  it('offline: the job stays pending (no provider call), then succeeds once online', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const { jobs } = await enqueueForSessions(repos, [s], categories, enabled());

    const off = await runJobs({ repos, providers, now: NOW, isOnline: false });
    expect(off).toMatchObject({ online: false, processed: 1 });
    const pending = await jobOf(repos, jobs[0].opId);
    expect(pending).toMatchObject({ status: 'pending', attempts: 0, lastError: AUTO_EXPORT_STRINGS.error.offline, nextAttemptAt: plus(NOW, OFFLINE_RECHECK_MS).toISOString() });
    expect(google.calls.getConnection + google.calls.listCalendars + google.calls.createEvent).toBe(0);
    expect(await repos.sessions.get(s.id)).not.toBeNull();

    // Back online (same instant, e.g. a connectivity event): processed without waiting for the re-check.
    const on = await runJobs({ repos, providers, now: NOW, isOnline: async () => true });
    expect(on.outcomes[0].status).toBe('succeeded');
    expect(google.written).toHaveLength(1);
  });

  it('rate limiting backs off 1 m, 5 m, 30 m, 2 h, then 12 h, respecting Retry-After', async () => {
    expect(BACKOFF_SCHEDULE_MS).toEqual([MIN, 5 * MIN, 30 * MIN, 2 * HOUR, 12 * HOUR]);
    expect([1, 2, 3, 4, 5, 6, 20].map((n) => backoffDelayMs(n))).toEqual([MIN, 5 * MIN, 30 * MIN, 2 * HOUR, 12 * HOUR, 12 * HOUR, 12 * HOUR]);
    expect(backoffDelayMs(1, 10 * MIN)).toBe(10 * MIN);
    expect(backoffDelayMs(3, 1000)).toBe(30 * MIN);

    const { repos, categories, surf, providers, google } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const { jobs } = await enqueueForSessions(repos, [s], categories, enabled());
    google.fail.createEvent = [
      new ProviderError('rate_limited', '429', 10 * MIN),
      ...Array.from({ length: 5 }, () => new ProviderError('rate_limited', '429')),
    ];
    let now = NOW;
    const delays: number[] = [];
    for (let i = 0; i < 6; i++) {
      await runJobs({ repos, providers, now });
      const j = await jobOf(repos, jobs[0].opId);
      expect(j).toMatchObject({ status: 'failed', attempts: i + 1, lastError: AUTO_EXPORT_STRINGS.error.rateLimited });
      const next = new Date(j.nextAttemptAt!);
      delays.push(next.getTime() - now.getTime());
      // Not due before the scheduled time.
      expect((await runJobs({ repos, providers, now: plus(next, -1000) })).processed).toBe(0);
      now = next;
    }
    expect(delays).toEqual([10 * MIN, 5 * MIN, 30 * MIN, 2 * HOUR, 12 * HOUR, 12 * HOUR]);
    await runJobs({ repos, providers, now });
    expect(await jobOf(repos, jobs[0].opId)).toMatchObject({ status: 'succeeded', attempts: 7 });
    expect(google.written).toHaveLength(1);
  });

  it('a rate limit defers the provider’s other jobs in the same run without counting an attempt', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const a = await save(repos, surf.id, INTERVAL);
    const b = await save(repos, surf.id, INTERVAL, { date: '2026-10-06' });
    const { jobs } = await enqueueForSessions(repos, [a, b], categories, enabled());
    google.fail.createEvent = [new ProviderError('rate_limited', '429', 3 * MIN)];
    await runJobs({ repos, providers, now: NOW });
    expect(await jobOf(repos, jobs[0].opId)).toMatchObject({ status: 'failed', attempts: 1 });
    expect(await jobOf(repos, jobs[1].opId)).toMatchObject({ status: 'pending', attempts: 0, nextAttemptAt: plus(NOW, 3 * MIN).toISOString() });
    expect(google.calls.createEvent).toBe(1);
  });

  it('unauthorized / denied → failed with an explanation and backoff; write-only → needs review', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const { jobs } = await enqueueForSessions(repos, [s], categories, enabled());
    const op = jobs[0].opId;

    google.fail.listCalendars = [new ProviderError('unauthorized', 'token expired')];
    await runJobs({ repos, providers, now: NOW });
    expect(await jobOf(repos, op)).toMatchObject({ status: 'failed', attempts: 1, lastError: AUTO_EXPORT_STRINGS.error.unauthorized, nextAttemptAt: plus(NOW, MIN).toISOString() });

    google.connection = { ...google.connection, status: 'denied', canRead: false, canWrite: false, detail: t.permissionDenied };
    let now = plus(NOW, MIN);
    await runJobs({ repos, providers, now });
    expect(await jobOf(repos, op)).toMatchObject({ status: 'failed', attempts: 2, lastError: t.permissionDenied, nextAttemptAt: plus(now, 5 * MIN).toISOString() });

    google.connection = { ...google.connection, status: 'connected', accountId: 'other@gmail.com', accountLabel: 'other@gmail.com', canRead: true, canWrite: true, detail: null };
    now = plus(now, 5 * MIN);
    await runJobs({ repos, providers, now });
    expect(await jobOf(repos, op)).toMatchObject({ status: 'failed', lastError: AUTO_EXPORT_STRINGS.error.accountMismatch('other@gmail.com', EMAIL) });

    google.connection = { ...google.connection, status: 'write_only', accountId: EMAIL, canRead: false, canWrite: true, detail: t.writeOnly };
    now = plus(now, 30 * MIN);
    await runJobs({ repos, providers, now });
    expect(await jobOf(repos, op)).toMatchObject({ status: 'needs_review', reviewReason: t.writeOnly });
    expect(google.calls.createEvent).toBe(0);
  });

  it('a missing destination calendar needs review; a missing provider fails honestly', async () => {
    const { repos, categories, surf, google, apple } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const cfg = enabled({ destinations: { google: { calendarId: 'deleted-cal', accountId: EMAIL, labelId: null }, apple: { calendarId: A_ICLOUD.calendarId, accountId: A_ICLOUD.accountId } } });
    const { jobs } = await enqueueForSessions(repos, [s], categories, cfg);
    await runJobs({ repos, providers: { google }, now: NOW });
    expect(await jobOf(repos, jobs[0].opId)).toMatchObject({ status: 'needs_review', reviewReason: AUTO_EXPORT_STRINGS.review.calendar_not_found });
    expect(await jobOf(repos, jobs[1].opId)).toMatchObject({ status: 'failed', lastError: AUTO_EXPORT_STRINGS.error.noProvider });
    expect(apple.calls.createEvent).toBe(0);
  });
});

describe('runJobs — idempotency and duplicates', () => {
  it('an uncertain write is reconciled by op id before any retry (no duplicate)', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const { jobs } = await enqueueForSessions(repos, [s], categories, enabled());
    google.fail.createEvent = [{ afterWrite: new ProviderError('uncertain', 'timeout') }];

    await runJobs({ repos, providers, now: NOW });
    expect(await jobOf(repos, jobs[0].opId)).toMatchObject({ status: 'uncertain', attempts: 1, lastError: t.jobUncertain, nextAttemptAt: plus(NOW, MIN).toISOString() });
    expect(google.events).toHaveLength(1);
    expect(await repos.exportLinks.byOp(jobs[0].opId)).toBeNull();

    await runJobs({ repos, providers, now: plus(NOW, 2 * MIN) });
    expect(google.calls.findByOpId).toBe(1);
    expect(google.calls.createEvent).toBe(1);
    expect(google.events).toHaveLength(1);
    expect(await jobOf(repos, jobs[0].opId)).toMatchObject({ status: 'succeeded', attempts: 2 });
    expect(await repos.exportLinks.byOp(jobs[0].opId)).toMatchObject({ status: 'created', externalEventId: google.events[0].eventId });
  });

  it('an uncertain write that did not happen is created exactly once after reconciliation', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const { jobs } = await enqueueForSessions(repos, [s], categories, enabled());
    google.fail.createEvent = [new Error('socket hang up')]; // unexpected error mid-request → uncertain
    await runJobs({ repos, providers, now: NOW });
    expect((await jobOf(repos, jobs[0].opId)).status).toBe('uncertain');
    expect(google.events).toHaveLength(0);
    await runJobs({ repos, providers, now: plus(NOW, 2 * MIN) });
    expect(google.calls.findByOpId).toBe(1);
    expect(google.written).toHaveLength(1);
    expect((await jobOf(repos, jobs[0].opId)).status).toBe('succeeded');
  });

  it('a reconciliation that cannot run keeps the job uncertain (never retried as a new creation)', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const { jobs } = await enqueueForSessions(repos, [s], categories, enabled());
    google.fail.createEvent = [new ProviderError('unknown', 'boom')];
    await runJobs({ repos, providers, now: NOW });
    google.fail.findByOpId = [new ProviderError('rate_limited', '429')];
    await runJobs({ repos, providers, now: plus(NOW, 2 * MIN) });
    expect(await jobOf(repos, jobs[0].opId)).toMatchObject({ status: 'uncertain', attempts: 2 });
    expect(google.calls.createEvent).toBe(1);
  });

  it('a job interrupted while running is treated as uncertain and reconciled, not recreated', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const { jobs } = await enqueueForSessions(repos, [s], categories, enabled());
    const opId = jobs[0].opId;
    // The app was killed after the provider accepted the event, before Serie recorded it.
    const written = foreignEvent(G_SPORT, 'g-written', 'Surf', DATE, '07:30', '09:00');
    google.events.push({ ...written, appMeta: { v: 1, sessionId: s.id, opId, timingState: 'interval', durationSec: 5400, durationSource: 'interval', schedulingPlaceholder: false } });
    await repos.exportJobs.update(jobs[0].id, { status: 'running', payload: { ...(jobs[0].payload as object), attemptedDate: DATE } });

    await runJobs({ repos, providers, now: NOW });
    expect(google.calls.createEvent).toBe(0);
    expect(await jobOf(repos, opId)).toMatchObject({ status: 'succeeded' });
    expect(await repos.exportLinks.byOp(opId)).toMatchObject({ externalEventId: 'g-written', status: 'created' });
  });

  it('a stored link for the operation means already exported, even offline', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const { jobs } = await enqueueForSessions(repos, [s], categories, enabled());
    await repos.exportLinks.upsert({
      sessionId: s.id, provider: 'google', accountId: EMAIL, calendarId: G_SPORT.calendarId, externalEventId: 'manual-1', occurrenceKey: null,
      status: 'created', opId: jobs[0].opId, exportedAt: NOW.toISOString(),
      snapshot: { title: 'Surf', notes: null, location: null, allDay: false, start: '', end: '', timeZone: TZ, timingState: 'interval', durationSec: 5400, durationSource: 'interval', schedulingPlaceholder: false, categoryName: 'Surf' },
    });
    await runJobs({ repos, providers, now: NOW, isOnline: false });
    expect(await jobOf(repos, jobs[0].opId)).toMatchObject({ status: 'succeeded', attempts: 0 });
    expect(google.calls.createEvent).toBe(0);
  });

  it('Serie’s own event already in the destination is linked, not recreated', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const { jobs } = await enqueueForSessions(repos, [s], categories, enabled());
    const own = foreignEvent(G_SPORT, 'g-own', 'Surf', DATE, '07:30', '09:00');
    google.events.push({ ...own, appMeta: { v: 1, sessionId: s.id, opId: jobs[0].opId, timingState: 'interval', durationSec: 5400, durationSource: 'interval', schedulingPlaceholder: false } });
    await runJobs({ repos, providers, now: NOW });
    expect(google.calls.createEvent).toBe(0);
    expect(await repos.exportLinks.byOp(jobs[0].opId)).toMatchObject({ externalEventId: 'g-own', status: 'created' });
    expect((await jobOf(repos, jobs[0].opId)).status).toBe('succeeded');
  });

  it('a possible duplicate in the destination → needs review; skip or create separately are explicit', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const a = await save(repos, surf.id, INTERVAL);
    const b = await save(repos, surf.id, INTERVAL, { date: '2026-10-07' });
    google.events.push(foreignEvent(G_SPORT, 'manual-a', 'Surf mattina', DATE, '07:40', '09:00'));
    google.events.push(foreignEvent(G_SPORT, 'manual-b', 'surf', '2026-10-07', '07:30', '09:00'));
    const { jobs } = await enqueueForSessions(repos, [a, b], categories, enabled());

    await runJobs({ repos, providers, now: NOW });
    expect(google.calls.createEvent).toBe(0);
    const ja = await jobOf(repos, jobs[0].opId);
    expect(ja).toMatchObject({ status: 'needs_review', reviewReason: t.exportStatusPossibleDuplicate });
    expect(parsePayload(ja.payload)?.review).toEqual({ code: 'possible_duplicate', eventIds: ['manual-a'] });

    await expect(resolveReviewJob(repos, ja.id, { kind: 'approve_span', minutes: 0 })).rejects.toBeTruthy();
    await resolveReviewJob(repos, ja.id, { kind: 'create_separate' });
    await resolveReviewJob(repos, jobs[1].id, { kind: 'skip' });
    await runJobs({ repos, providers, now: plus(NOW, MIN) });
    expect(google.written).toHaveLength(1);
    expect(google.written[0].appMeta?.sessionId).toBe(a.id);
    expect(await jobOf(repos, jobs[1].opId)).toMatchObject({ status: 'cancelled', reviewReason: AUTO_EXPORT_STRINGS.cancelled.userSkipped });
    // The manual events were never touched.
    expect(google.events.filter((e) => e.eventId.startsWith('manual-')).map((e) => e.title)).toEqual(['Surf mattina', 'surf']);
  });

  it('linking an existing event from the review stores a link without changing the event', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const existing = foreignEvent(G_SPORT, 'manual-a', 'Surf', DATE, '07:30', '09:00');
    google.events.push(existing);
    const { jobs } = await enqueueForSessions(repos, [s], categories, enabled());
    await runJobs({ repos, providers, now: NOW });
    await expect(resolveReviewJob(repos, jobs[0].id, { kind: 'link', event: { ...existing, calendarId: 'elsewhere' } })).rejects.toMatchObject({ code: 'invalid_link_target' });
    const done = await resolveReviewJob(repos, jobs[0].id, { kind: 'link', event: existing });
    expect(done.status).toBe('succeeded');
    expect(await repos.exportLinks.byOp(jobs[0].opId)).toMatchObject({ status: 'linked', externalEventId: 'manual-a' });
    expect(google.calls.createEvent).toBe(0);
    expect(google.events).toEqual([existing]);
  });
});

describe('runJobs — "Both"', () => {
  const bothCfg = (apple: ExternalCalendar, p: Partial<AutoExportConfig> = {}) =>
    enabled({ destinations: { google: { calendarId: G_SPORT.calendarId, accountId: EMAIL, labelId: null }, apple: { calendarId: apple.calendarId, accountId: apple.accountId } }, ...p });

  it('equivalent destinations are never both written: review, then the user picks one route', async () => {
    const { repos, categories, surf, providers, google, apple } = await setup();
    const s = await save(repos, surf.id, INTERVAL);

    // With calendar details at enqueue time → straight to review.
    const early = eligibleDestinations(s, surf, bothCfg(A_GSPORT), [], { calendars: ALL_CALS });
    expect(early.eligible.map((d) => d.review?.code)).toEqual(['both_equivalent', 'both_equivalent']);

    // Queued without details → the run checks with live calendars.
    const { jobs } = await enqueueForSessions(repos, [s], categories, bothCfg(A_GSPORT));
    expect(jobs.map((j) => j.status)).toEqual(['pending', 'pending']);
    await runJobs({ repos, providers, now: NOW });
    for (const j of jobs) expect(await jobOf(repos, j.opId)).toMatchObject({ status: 'needs_review', reviewReason: t.equivalentWarning });
    expect(google.calls.createEvent + apple.calls.createEvent).toBe(0);

    const [gJob, aJob] = jobs;
    await resolveReviewJob(repos, aJob.id, { kind: 'skip' });
    await resolveReviewJob(repos, gJob.id, { kind: 'retry' });
    await runJobs({ repos, providers, now: plus(NOW, MIN) });
    expect(google.written).toHaveLength(1);
    expect(apple.written).toHaveLength(0);
  });

  it('unknown equivalence needs an explicit resolution for that pair', async () => {
    const { repos, categories, surf, providers, google, apple } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const cfg = bothCfg(A_GMAIL);
    await saveConfig(repos, cfg);
    const { jobs } = await enqueueForSessions(repos, [s], categories, cfg);
    await runJobs({ repos, providers, now: NOW });
    for (const j of jobs) expect(await jobOf(repos, j.opId)).toMatchObject({ status: 'needs_review', reviewReason: t.equivalenceUnknown });

    const resolved = await saveConfig(repos, withBothResolved(cfg, ref(G_SPORT), ref(A_GMAIL)));
    expect(isPairResolved(resolved, ref(G_SPORT), ref(A_GMAIL))).toBe(true);
    for (const j of jobs) await resolveReviewJob(repos, j.id, { kind: 'retry' });
    await runJobs({ repos, providers, now: plus(NOW, MIN) });
    expect(google.written).toHaveLength(1);
    expect(apple.written).toHaveLength(1);
    expect(apple.written[0].colorId).toBeNull(); // EventKit has no labels
  });

  it('a route written while the other was unreachable still blocks the second write when equivalent', async () => {
    const { repos, categories, surf, providers, google, apple } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const { jobs } = await enqueueForSessions(repos, [s], categories, bothCfg(A_GSPORT));
    apple.connection = { ...apple.connection, status: 'denied', canRead: false, canWrite: false, detail: t.permissionDenied };
    await runJobs({ repos, providers, now: NOW });
    // Only one route could write: no double write is possible yet, so Google is not held back.
    expect(await jobOf(repos, jobs[0].opId)).toMatchObject({ provider: 'google', status: 'succeeded' });
    expect(google.written).toHaveLength(1);

    // Apple comes back while Google is unreachable: the stored Google descriptor still reveals the equivalence.
    apple.connection = { ...apple.connection, status: 'connected', canRead: true, canWrite: true, detail: null };
    google.connection = { ...google.connection, status: 'disconnected', detail: null };
    await runJobs({ repos, providers, now: plus(NOW, MIN) });
    expect(await jobOf(repos, jobs[1].opId)).toMatchObject({ provider: 'apple', status: 'needs_review', reviewReason: t.equivalentWarning });
    expect(apple.calls.createEvent).toBe(0);
  });

  it('after Google wrote, an Apple route that cannot describe the Google side while offline waits (no attempt counted)', async () => {
    const { repos, categories, surf, providers, google, apple } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const { jobs } = await enqueueForSessions(repos, [s], categories, bothCfg(A_GMAIL));
    apple.connection = { ...apple.connection, status: 'denied', canRead: false, canWrite: false, detail: t.permissionDenied };
    await runJobs({ repos, providers, now: NOW });
    expect(await jobOf(repos, jobs[0].opId)).toMatchObject({ provider: 'google', status: 'succeeded' });
    // The stored Google descriptor is dropped to simulate a job queued by an older build.
    const g = await jobOf(repos, jobs[0].opId);
    await repos.exportJobs.update(g.id, { payload: { ...(g.payload as object), calendar: null } });

    apple.connection = { ...apple.connection, status: 'connected', canRead: true, canWrite: true, detail: null };
    await runJobs({ repos, providers, now: plus(NOW, 10 * MIN), isOnline: false });
    // Attempt 1 was the denied run; waiting for the network does not count another one.
    expect(await jobOf(repos, jobs[1].opId)).toMatchObject({ provider: 'apple', status: 'pending', attempts: 1, lastError: AUTO_EXPORT_STRINGS.error.offline });
    expect(apple.calls.createEvent).toBe(0);
    expect(google.calls.getConnection).toBe(1); // only the first, online run
  });

  it('distinct destinations are written independently; one failing does not affect the other', async () => {
    const { repos, categories, surf, providers, google, apple } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const { jobs } = await enqueueForSessions(repos, [s], categories, bothCfg(A_ICLOUD));
    expect(new Set(jobs.map((j) => j.opId)).size).toBe(2);
    apple.connection = { ...apple.connection, status: 'denied', canRead: false, canWrite: false, detail: t.permissionDenied };
    await runJobs({ repos, providers, now: NOW });
    expect(await jobOf(repos, jobs[0].opId)).toMatchObject({ provider: 'google', status: 'succeeded' });
    expect(await jobOf(repos, jobs[1].opId)).toMatchObject({ provider: 'apple', status: 'failed', lastError: t.permissionDenied });
    expect(google.written).toHaveLength(1);

    apple.connection = { ...apple.connection, status: 'connected', canRead: true, canWrite: true, detail: null };
    await runJobs({ repos, providers, now: plus(NOW, MIN) });
    expect(apple.written).toHaveLength(1);
    expect(google.written).toHaveLength(1);
  });
});

// ─── disabling & summary ─────────────────────────────────────────────────────

describe('disableAutoExport', () => {
  it('stops new jobs; optionally cancels open auto jobs; never touches events or manual jobs', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    await saveConfig(repos, enabled());
    const done = await save(repos, surf.id, INTERVAL);
    await enqueueForSessions(repos, [done], categories, await loadConfig(repos));
    await runJobs({ repos, providers, now: NOW });
    expect(google.written).toHaveLength(1);

    const waiting = await save(repos, surf.id, INTERVAL, { date: '2026-10-06' });
    const review = await save(repos, surf.id, START_ONLY, { date: '2026-10-07' });
    await enqueueForSessions(repos, [waiting, review], categories, await loadConfig(repos));
    await repos.exportJobs.enqueue({ opId: 'manual-op', sessionId: waiting.id, provider: 'apple', accountId: 'a', calendarId: 'c', kind: 'manual' });

    const keep = await disableAutoExport(repos, { cancelPending: false });
    expect(keep).toMatchObject({ cancelled: 0, config: expect.objectContaining({ enabled: false }) });
    expect((await loadConfig(repos)).enabled).toBe(false);
    expect(summarizeJobs(await repos.exportJobs.list()).open).toBe(3);

    const later = await save(repos, surf.id, INTERVAL, { date: '2026-10-08' });
    const none = await enqueueForSessions(repos, [later], categories, await loadConfig(repos));
    expect(none.jobs).toEqual([]);

    const cancel = await disableAutoExport(repos, { cancelPending: true });
    expect(cancel.cancelled).toBe(2);
    const all = await repos.exportJobs.list();
    expect(all.filter((j) => j.kind === 'auto').map((j) => j.status).sort()).toEqual(['cancelled', 'cancelled', 'succeeded']);
    expect(all.find((j) => j.kind === 'manual')?.status).toBe('pending');
    expect(google.written).toHaveLength(1);
    expect(await repos.exportLinks.bySession(done.id)).toHaveLength(1);

    await runJobs({ repos, providers, now: plus(NOW, HOUR) });
    expect(google.calls.createEvent).toBe(1);
  });
});

describe('summarizeJobs', () => {
  it('counts statuses and builds the Italian badge', () => {
    const j = (status: Parameters<typeof summarizeJobs>[0][number]['status'], provider: ProviderKind = 'google') => ({ status, provider });
    const empty = summarizeJobs([]);
    expect(empty.badge).toEqual({ tone: 'none', count: 0, label: null });

    const pendingOnly = summarizeJobs([j('pending'), j('failed', 'apple'), j('succeeded')]);
    expect(pendingOnly).toMatchObject({ total: 3, open: 2, waiting: 1, retrying: 1, needsReview: 0 });
    expect(pendingOnly.badge).toEqual({ tone: 'pending', count: 2, label: '2 esportazioni in sospeso' });

    const s = summarizeJobs([j('pending'), j('needs_review'), j('needs_review', 'apple'), j('uncertain'), j('cancelled'), j('succeeded', 'apple'), j('running')]);
    expect(s.counts).toEqual({ pending: 1, running: 1, succeeded: 1, failed: 0, uncertain: 1, needs_review: 2, cancelled: 1 });
    expect(s).toMatchObject({ open: 5, needsReview: 2, retrying: 1, waiting: 2 });
    expect(s.byProvider).toEqual({ google: { open: 4, needsReview: 1, succeeded: 0 }, apple: { open: 1, needsReview: 1, succeeded: 1 } });
    expect(s.badge).toEqual({ tone: 'review', count: 2, label: '2 da rivedere' });
  });
});

// ─── adversarial review regressions ──────────────────────────────────────────

describe('regressions — concurrent decisions, reconciliation, offline, provenance', () => {
  it('a job cancelled while the run is checking the destination is never written and stays cancelled', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    await saveConfig(repos, enabled());
    const s = await save(repos, surf.id, INTERVAL);
    const { jobs } = await enqueueForSessions(repos, [s], categories, enabled());
    // "Annulla quelle in sospeso" while the provider is being read.
    google.beforeList = async () => {
      await disableAutoExport(repos, { cancelPending: true });
    };
    const out = await runJobs({ repos, providers, now: NOW });
    expect(out.outcomes[0]).toMatchObject({ status: 'cancelled', message: AUTO_EXPORT_STRINGS.error.superseded });
    expect(google.calls.createEvent).toBe(0);
    expect(await jobOf(repos, jobs[0].opId)).toMatchObject({ status: 'cancelled', attempts: 0 });

    // Same race ending in a failed read: the user's decision is not overwritten with 'failed'.
    const s2 = await save(repos, surf.id, INTERVAL, { date: '2026-10-06' });
    const q = await enqueueForSessions(repos, [s2], categories, enabled());
    google.beforeList = async () => {
      await resolveReviewJob(repos, q.jobs[0].id, { kind: 'skip' });
    };
    google.fail.listEvents = [new ProviderError('rate_limited', '429')];
    await runJobs({ repos, providers, now: plus(NOW, MIN) });
    expect(await jobOf(repos, q.jobs[0].opId)).toMatchObject({ status: 'cancelled', attempts: 0, reviewReason: AUTO_EXPORT_STRINGS.cancelled.userSkipped });
    expect(google.calls.createEvent).toBe(0);
  });

  it('a save undone while its job is being checked is never exported', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const { jobs } = await enqueueForSessions(repos, [s], categories, enabled());
    google.beforeList = async () => {
      await repos.sessions.remove([s.id]); // "Annulla" — the job row goes with the session
    };
    const out = await runJobs({ repos, providers, now: NOW });
    expect(out.outcomes).toEqual([expect.objectContaining({ jobId: jobs[0].id, status: 'cancelled' })]);
    expect(google.calls.createEvent).toBe(0);
    expect(await repos.exportJobs.list()).toEqual([]);
  });

  it('a fresh "running" job (being written by a manual export) is left alone; a stale one is reclaimed and reconciled', async () => {
    let clock = NOW;
    const repos = await testRepos({ now: () => clock.toISOString() });
    const surf = await repos.categories.create({ name: 'Surf', color: '#2E7D9A', pattern: 'swell' });
    const google = new FakeProvider('google', [...GOOGLE_CALS]);
    const s = await save(repos, surf.id, INTERVAL);
    const { jobs } = await enqueueForSessions(repos, [s], [surf], enabled());
    await repos.exportJobs.update(jobs[0].id, { status: 'running' }); // exportEngine took the job over and is writing

    await runJobs({ repos, providers: { google }, now: plus(NOW, MIN), config: enabled() });
    expect(await jobOf(repos, jobs[0].opId)).toMatchObject({ status: 'running' });
    expect(google.calls.findByOpId + google.calls.listEvents + google.calls.createEvent).toBe(0);

    // Still 'running' long after (the app was killed mid-write): reclaimed as uncertain, looked up first.
    clock = plus(NOW, RUNNING_STALE_MS + MIN);
    await runJobs({ repos, providers: { google }, now: clock, config: enabled() });
    expect(google.calls.findByOpId).toBe(1);
    expect(google.written).toHaveLength(1);
    expect(await jobOf(repos, jobs[0].opId)).toMatchObject({ status: 'succeeded' });
  });

  it('an uncertain write keeps its reconciliation duty through "Da rivedere" (no duplicate after a date change)', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const { jobs } = await enqueueForSessions(repos, [s], categories, enabled());
    google.fail.createEvent = [{ afterWrite: new ProviderError('uncertain', 'timeout') }];
    await runJobs({ repos, providers, now: NOW });
    expect(google.events).toHaveLength(1);

    // The next run cannot read the calendar → review; the duty must survive it.
    google.connection = { ...google.connection, status: 'write_only', canRead: false, detail: t.writeOnly };
    await runJobs({ repos, providers, now: plus(NOW, 2 * MIN) });
    const reviewed = await jobOf(repos, jobs[0].opId);
    expect(reviewed).toMatchObject({ status: 'needs_review', reviewReason: t.writeOnly });
    expect(parsePayload(reviewed.payload)?.reconcile).toBe(true);

    // The session is moved to another date before the user retries.
    await repos.sessions.update(s.id, { date: '2026-10-20' });
    google.connection = { ...google.connection, status: 'connected', canRead: true, detail: null };
    expect(await resolveReviewJob(repos, jobs[0].id, { kind: 'retry' })).toMatchObject({ status: 'uncertain' });
    await runJobs({ repos, providers, now: plus(NOW, 3 * MIN) });
    expect(google.calls.findByOpId).toBe(1);
    expect(google.calls.createEvent).toBe(1);
    expect(google.events).toHaveLength(1);
    expect(await jobOf(repos, jobs[0].opId)).toMatchObject({ status: 'succeeded' });
    expect(await repos.exportLinks.byOp(jobs[0].opId)).toMatchObject({ externalEventId: google.events[0].eventId });
  });

  it('a forwarded imported session is also matched by its original title', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    const imported = await save(repos, surf.id, INTERVAL, { origin: 'import' });
    await importProvenance(repos, imported.id, A_ICLOUD, 'Lezione con Marta');
    google.events.push(foreignEvent(G_SPORT, 'manual-l', 'Lezione con Marta', DATE, '07:30', '09:00'));
    const cfg = enabled({ forwardImported: true });
    const { jobs } = await enqueueForSessions(repos, [imported], categories, cfg);
    await runJobs({ repos, providers, now: NOW, config: cfg });
    const j = await jobOf(repos, jobs[0].opId);
    expect(j).toMatchObject({ status: 'needs_review', reviewReason: t.exportStatusPossibleDuplicate });
    expect(parsePayload(j.payload)?.review).toEqual({ code: 'possible_duplicate', eventIds: ['manual-l'] });
    expect(google.calls.createEvent).toBe(0);
  });

  it('offline: on-device (Apple) jobs still run; Google jobs wait without any network call', async () => {
    const { repos, categories, surf, providers, google, apple } = await setup();
    const s = await save(repos, surf.id, INTERVAL);
    const cfg = enabled({ destinations: { google: { calendarId: G_SPORT.calendarId, accountId: EMAIL, labelId: null }, apple: { calendarId: A_ICLOUD.calendarId, accountId: A_ICLOUD.accountId } } });
    const { jobs } = await enqueueForSessions(repos, [s], categories, cfg);
    const out = await runJobs({ repos, providers, now: NOW, isOnline: false, config: cfg });
    expect(out.online).toBe(false);
    expect(await jobOf(repos, jobs[0].opId)).toMatchObject({ provider: 'google', status: 'pending', lastError: AUTO_EXPORT_STRINGS.error.offline });
    expect(await jobOf(repos, jobs[1].opId)).toMatchObject({ provider: 'apple', status: 'succeeded' });
    expect(google.calls.getConnection + google.calls.listCalendars + google.calls.createEvent).toBe(0);
    expect(apple.written).toHaveLength(1);
  });

  it('a forwarded import whose source side is momentarily unreachable waits instead of going to review', async () => {
    const { repos, categories, surf, providers, apple } = await setup();
    const imported = await save(repos, surf.id, INTERVAL, { origin: 'import' });
    await importProvenance(repos, imported.id, G_SPORT);
    const cfg = enabled({ forwardImported: true, destinations: { apple: { calendarId: A_GSPORT.calendarId, accountId: A_GSPORT.accountId } } });
    const { jobs } = await enqueueForSessions(repos, [imported], categories, cfg);
    await runJobs({ repos, providers, now: NOW, isOnline: false, config: cfg });
    expect(await jobOf(repos, jobs[0].opId)).toMatchObject({ status: 'pending', lastError: AUTO_EXPORT_STRINGS.error.offline });
    expect(apple.calls.createEvent).toBe(0);

    // Online again: the Google side is listed, reveals the same calendar → never written there.
    await runJobs({ repos, providers, now: NOW, config: cfg });
    expect(await jobOf(repos, jobs[0].opId)).toMatchObject({ status: 'cancelled', reviewReason: AUTO_EXPORT_STRINGS.cancelled.sourceCalendar });
    expect(apple.calls.createEvent).toBe(0);
  });

  it('never a duplicate by date alone: two same-day sessions both export; a same-day event at another time is not a match', async () => {
    const { repos, categories, surf, providers, google } = await setup();
    google.events.push(foreignEvent(G_SPORT, 'manual-pm', 'Surf', DATE, '16:00', '17:30'));
    const morning = await save(repos, surf.id, INTERVAL); // 07:30–09:00: start clearly differs from 16:00
    const a = await save(repos, surf.id, undefined, { date: '2026-10-06' }); // date only
    const b = await save(repos, surf.id, undefined, { date: '2026-10-06' }); // a second date-only session that day: legitimate
    const { jobs } = await enqueueForSessions(repos, [morning, a, b], categories, enabled());
    await runJobs({ repos, providers, now: NOW });
    for (const j of jobs) expect(await jobOf(repos, j.opId)).toMatchObject({ status: 'succeeded' });
    expect(google.written.map((e) => e.appMeta?.sessionId).sort()).toEqual([morning.id, a.id, b.id].sort());
    expect(google.events.find((e) => e.eventId === 'manual-pm')?.title).toBe('Surf');

    // All-day vs timed on the same day is never treated as certain either way: it waits for review.
    const c = await save(repos, surf.id); // date only, same day as the 16:00 "Surf"
    const q = await enqueueForSessions(repos, [c], categories, enabled());
    await runJobs({ repos, providers, now: plus(NOW, MIN) });
    expect(await jobOf(repos, q.jobs[0].opId)).toMatchObject({ status: 'needs_review', reviewReason: t.exportStatusPossibleDuplicate });
  });

  it('validateConfig warns when a destination cannot be read (duplicates cannot be checked)', () => {
    const writeOnly = { ...A_ICLOUD, canRead: false };
    const v = validateConfig(enabled({ destinations: { apple: { calendarId: A_ICLOUD.calendarId, accountId: A_ICLOUD.accountId } } }), [...GOOGLE_CALS, writeOnly]);
    expect(v.runnable).toBe(true);
    expect(v.issues).toEqual([expect.objectContaining({ code: 'calendar_not_readable', severity: 'warning', provider: 'apple', message: AUTO_EXPORT_STRINGS.issues.calendar_not_readable })]);
  });
});
