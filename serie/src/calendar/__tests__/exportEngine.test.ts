import { testRepos } from '@/test/sqljs';
import { buildTiming, type TimingInput } from '@/domain/timing';
import { summarize } from '@/domain/stats';
import { zonedToEpoch } from '@/domain/zoned';
import { addDays, compareDates } from '@/domain/dates';
import type { Category, LocalDate, Place, ProviderKind, Session } from '@/domain/types';
import type { ProvenanceRecord, Repositories } from '@/data/repositories';
import {
  ProviderError,
  type CalendarProvider,
  type Connection,
  type EventDraft,
  type ExternalCalendar,
  type ExternalEvent,
  type ListEventsQuery,
} from '../types';
import {
  buildExportPlan,
  eventsOf,
  executePlan,
  exportWindow,
  loadAllDestinationEvents,
  mergeChoices,
  selectionCounts,
  setRowChoice,
  setSelection,
  type ExportDestinationInput,
  type ExportOptions,
  type ExportPlan,
  type ExportPlanRow,
} from '../exportEngine';
import { buildEventDraft, overrideToSessionPatch } from '../representation';
import { exportOpId } from '../opId';

const TZ = 'Europe/Rome';

// ─── fake provider ───────────────────────────────────────────────────────────

type CreateStep = 'ok' | { fail: ProviderError['code'] } | { uncertain: 'persisted' | 'lost' } | { crash: 'persisted' };

class FakeProvider implements CalendarProvider {
  readonly capabilities: { eventLabels: boolean };
  events: ExternalEvent[] = [];
  calls: string[] = [];
  drafts: EventDraft[] = [];
  createSteps: CreateStep[] = [];
  findFailures = 0;
  readFails = false;
  private n = 0;

  constructor(
    readonly kind: ProviderKind,
    public conn: Connection,
  ) {
    this.capabilities = { eventLabels: kind === 'google' };
  }

  private clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

  async getConnection() {
    this.calls.push('getConnection');
    return this.conn;
  }
  async connect() {
    return this.conn;
  }
  async disconnect() {}
  async listCalendars(): Promise<ExternalCalendar[]> {
    return [];
  }
  async listLabels() {
    return [];
  }
  async listEvents(q: ListEventsQuery) {
    this.calls.push('listEvents');
    if (!this.conn.canRead) throw new ProviderError('forbidden', 'Lettura non consentita');
    if (this.readFails) throw new ProviderError('offline', 'Sei offline');
    return this.clone(
      this.events.filter(
        (e) => q.calendarIds.includes(e.calendarId) && (q.includeCancelled || e.status !== 'cancelled') && compareDates(e.start.date, q.to) <= 0 && compareDates(e.end.date, q.from) >= 0,
      ),
    );
  }
  async getEvent(calendarId: string, eventId: string) {
    this.calls.push('getEvent');
    const e = this.events.find((x) => x.calendarId === calendarId && x.eventId === eventId);
    return e ? this.clone(e) : null;
  }
  async findByOpId(calendarId: string, opId: string, around: { from: LocalDate; to: LocalDate }) {
    this.calls.push('findByOpId');
    if (this.findFailures > 0) {
      this.findFailures--;
      throw new ProviderError('offline', 'Sei offline');
    }
    const e = this.events.find(
      (x) => x.calendarId === calendarId && x.appMeta?.opId === opId && x.status !== 'cancelled' && compareDates(x.start.date, around.to) <= 0 && compareDates(x.start.date, around.from) >= 0,
    );
    return e ? this.clone(e) : null;
  }
  private toEvent(calendarId: string, d: EventDraft, eventId: string): ExternalEvent {
    const time = (p: EventDraft['start']) => ({
      date: p.date,
      time: p.time,
      timeZone: p.timeZone,
      instant: d.allDay ? null : new Date(zonedToEpoch(p.date, p.time!, p.timeZone!).epochMs).toISOString(),
    });
    return {
      provider: this.kind,
      accountId: this.conn.accountId ?? 'local',
      calendarId,
      eventId,
      recurringEventId: null,
      occurrenceKey: null,
      title: d.title,
      notes: d.notes,
      location: d.location,
      allDay: d.allDay,
      start: time(d.start),
      end: time(d.end),
      status: 'confirmed',
      colorId: this.capabilities.eventLabels ? d.colorId : null,
      appMeta: this.clone(d.appMeta),
      updated: null,
    };
  }
  async createEvent(calendarId: string, draft: EventDraft) {
    this.calls.push('createEvent');
    this.drafts.push(this.clone(draft));
    const step = this.createSteps.shift() ?? 'ok';
    if (typeof step === 'object' && 'fail' in step) throw new ProviderError(step.fail, 'Errore simulato del calendario');
    const ev = this.toEvent(calendarId, draft, `${this.kind}-ev-${++this.n}`);
    if (typeof step === 'object' && 'uncertain' in step) {
      if (step.uncertain === 'persisted') this.events.push(ev);
      throw new ProviderError('uncertain', 'Risposta non leggibile');
    }
    if (typeof step === 'object' && 'crash' in step) {
      this.events.push(ev);
      throw new TypeError('Network request failed');
    }
    this.events.push(ev);
    return this.clone(ev);
  }
  async updateEvent(calendarId: string, eventId: string, draft: EventDraft) {
    this.calls.push('updateEvent');
    const i = this.events.findIndex((x) => x.calendarId === calendarId && x.eventId === eventId);
    if (i < 0) throw new ProviderError('not_found', 'Evento non trovato');
    this.events[i] = this.toEvent(calendarId, draft, eventId);
    return this.clone(this.events[i]);
  }
}

// ─── fixtures ────────────────────────────────────────────────────────────────

const G_ACCOUNT = 'marta@example.com';
const gRef = { provider: 'google' as const, accountId: G_ACCOUNT, calendarId: 'g-primary' };
const aRef = { provider: 'apple' as const, accountId: 'src-icloud', calendarId: 'a-cal' };

const cal = (ref: typeof gRef | typeof aRef, over: Partial<ExternalCalendar> = {}): ExternalCalendar => ({
  ...ref,
  accountLabel: ref.provider === 'google' ? G_ACCOUNT : 'iCloud',
  title: ref.provider === 'google' ? 'Personale' : 'Casa',
  color: null,
  access: 'owner',
  canRead: true,
  canWrite: true,
  isPrimary: true,
  sourceType: ref.provider === 'apple' ? 'caldav' : null,
  sourceName: null,
  ...over,
});

const gConn: Connection = { provider: 'google', status: 'connected', accountId: G_ACCOUNT, accountLabel: G_ACCOUNT, canRead: true, canWrite: true, detail: null };
const aConn: Connection = { provider: 'apple', status: 'connected', accountId: null, accountLabel: null, canRead: true, canWrite: true, detail: null };
const aWriteOnly: Connection = { ...aConn, status: 'write_only', canRead: false, detail: 'Accesso solo in scrittura' };

const baseOptions: ExportOptions = { prefix: '', suffix: '', includeNotes: true, includeLocation: true, startOnlySpanMin: null, overrides: {} };

interface Ctx {
  repos: Repositories;
  cat: Category;
  google: FakeProvider;
  apple: FakeProvider;
  save: (date: string, timing?: TimingInput, extra?: { notes?: string; place?: Place }) => Promise<Session>;
  plan: (sessions: Session[], dests: ExportDestinationInput[], options?: Partial<ExportOptions>) => Promise<ExportPlan>;
  run: (plan: ExportPlan) => ReturnType<typeof executePlan>;
}

async function setup(appleConn: Connection = aConn): Promise<Ctx> {
  const repos = await testRepos();
  const cat = await repos.categories.create({ name: 'Surf', color: '#1f6f8b', pattern: 'swell' });
  const google = new FakeProvider('google', gConn);
  const apple = new FakeProvider('apple', appleConn);
  const providers = { google, apple };
  let req = 0;
  return {
    repos,
    cat,
    google,
    apple,
    async save(date, timing, extra = {}) {
      const r = timing ? buildTiming(date, timing) : null;
      if (r && !r.ok) throw new Error(r.error);
      const out = await repos.sessions.saveBatch({ categoryId: cat.id, dates: [date], requestId: `req-${++req}`, shared: { timing: r?.timing, notes: extra.notes, place: extra.place } });
      return out.sessions[0];
    },
    async plan(sessions, dests, options = {}) {
      const links = await repos.exportLinks.all();
      const opts = { ...baseOptions, ...options };
      const reads = await loadAllDestinationEvents(providers, dests, sessions, links, { overrides: opts.overrides });
      return buildExportPlan({ sessions, category: cat, destinations: dests, options: opts, links, destinationEvents: eventsOf(reads) });
    },
    run: (plan) => executePlan({ plan, providers, repos }),
  };
}

const gDest = (over: Partial<ExportDestinationInput> = {}): ExportDestinationInput => ({ ref: gRef, calendar: cal(gRef), connection: gConn, labelId: '7', ...over });
const aDest = (conn: Connection = aConn, over: Partial<ExportDestinationInput> = {}): ExportDestinationInput => ({ ref: aRef, calendar: cal(aRef), connection: conn, labelId: '7', ...over });

const rowsOf = (plan: ExportPlan, key = 'google:marta@example.com:g-primary'): ExportPlanRow[] => plan.destinations.find((d) => d.key === key)!.rows;
const A_KEY = 'apple:src-icloud:a-cal';
const G_KEY = 'google:marta@example.com:g-primary';

const ALLOWED_PROVIDER_CALLS = new Set(['getConnection', 'listEvents', 'getEvent', 'findByOpId', 'createEvent', 'updateEvent']);
const DRAFT_KEYS = ['allDay', 'appMeta', 'colorId', 'end', 'location', 'notes', 'start', 'title'];

// ─── tests ───────────────────────────────────────────────────────────────────

describe('buildExportPlan', () => {
  it('builds independent per-destination rows: settings, labels, duplicate checks', async () => {
    const c = await setup(aWriteOnly);
    const s1 = await c.save('2026-07-04', { state: 'interval', start: '07:00', end: '08:30', endDayOffset: 0, timeZone: TZ });
    const s2 = await c.save('2026-07-05');
    c.google.events.push({
      ...gRef,
      eventId: 'manual-1',
      recurringEventId: null,
      occurrenceKey: null,
      title: 'Surf 🌊',
      notes: null,
      location: null,
      allDay: false,
      start: { date: '2026-07-04', time: '07:10', timeZone: TZ, instant: new Date(zonedToEpoch('2026-07-04', '07:10', TZ).epochMs).toISOString() },
      end: { date: '2026-07-04', time: '08:30', timeZone: TZ, instant: new Date(zonedToEpoch('2026-07-04', '08:30', TZ).epochMs).toISOString() },
      status: 'confirmed',
      colorId: null,
      appMeta: null,
      updated: null,
    });
    const plan = await c.plan([s2, s1], [gDest({ options: { suffix: ' · G' } }), aDest(aWriteOnly)], { prefix: '🌊 ' });
    const [g, a] = plan.destinations;

    expect(g).toMatchObject({ key: G_KEY, checked: true, writable: true, colorId: '7', labelNote: null });
    expect(a).toMatchObject({ key: A_KEY, checked: false, writable: true, colorId: null });
    expect(a.labelNote).toMatch(/non hanno etichette colore/);

    // Rows are ordered by date and carry per-destination titles.
    expect(g.rows.map((r) => r.session.id)).toEqual([s1.id, s2.id]);
    expect(g.rows.map((r) => r.title.final)).toEqual(['🌊 Surf · G', '🌊 Surf · G']);
    expect(a.rows.map((r) => r.title.final)).toEqual(['🌊 Surf', '🌊 Surf']);
    expect(g.rows[0].draft?.colorId).toBe('7');
    expect(a.rows[0].draft?.colorId).toBeNull();
    expect(g.rows[0].opId).not.toBe(a.rows[0].opId);

    // Google: possible duplicate (needs review), date marker ready. Apple: not checked (write-only).
    expect(g.rows.map((r) => [r.status, r.defaultAction, r.selected])).toEqual([
      ['possible_duplicate', 'skip', false],
      ['ready', 'create', true],
    ]);
    expect(g.rows[0].reason).toBe('Possibile doppione: stesso giorno e titolo simile');
    expect(g.rows[0].allowedActions).toEqual(['skip', 'link', 'create']);
    expect(g.rows[0].linkTargetEventId).toBe('manual-1');
    expect(a.rows.map((r) => [r.status, r.reason, r.selected])).toEqual([
      ['not_checked', 'Non verificato: accesso al calendario non disponibile', false],
      ['not_checked', 'Non verificato: accesso al calendario non disponibile', false],
    ]);
    expect(c.apple.calls).not.toContain('listEvents'); // write-only access is never used as if it could read
    expect(g.rows.map((r) => r.durationLabel)).toEqual(['1 h 30 min', 'Durata non specificata']);
    expect(selectionCounts(plan)).toEqual({ [G_KEY]: { selected: 1, total: 2 }, [A_KEY]: { selected: 0, total: 2 } });
  });

  it('rejects mixed activities and duplicate destinations', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04');
    const other = { ...s, id: 'x', categoryId: 'another' };
    expect(() => buildExportPlan({ sessions: [s, other], category: c.cat, destinations: [gDest()], options: baseOptions, links: [], destinationEvents: {} })).toThrow('category_mismatch');
    expect(() => buildExportPlan({ sessions: [s], category: c.cat, destinations: [gDest(), gDest()], options: baseOptions, links: [], destinationEvents: {} })).toThrow('duplicate_destination');
  });

  it('read-only destination: nothing is proposed for writing', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04');
    const plan = await c.plan([s], [gDest({ calendar: cal(gRef, { canWrite: false, access: 'reader' }) })]);
    expect(rowsOf(plan)[0]).toMatchObject({ status: 'not_writable', defaultAction: 'skip', selected: false, allowedActions: ['skip'] });
  });

  it('review edits are validated, immutable, scoped, and survive a rebuild', async () => {
    const c = await setup();
    const s1 = await c.save('2026-07-04');
    const s2 = await c.save('2026-07-05');
    const plan = await c.plan([s1, s2], [gDest(), aDest()]);
    expect(() => setRowChoice(plan, G_KEY, s1.id, { action: 'update' })).toThrow('action_not_allowed');
    const p1 = setRowChoice(plan, G_KEY, s1.id, { action: 'skip' });
    expect(rowsOf(plan)[0].selected).toBe(true); // original untouched
    expect(rowsOf(p1)[0]).toMatchObject({ action: 'skip', selected: false, touched: true });
    const none = setSelection(p1, A_KEY, false);
    expect(selectionCounts(none)).toEqual({ [G_KEY]: { selected: 1, total: 2 }, [A_KEY]: { selected: 0, total: 2 } });
    const all = setSelection(none, null, true);
    expect(selectionCounts(all)).toEqual({ [G_KEY]: { selected: 1, total: 2 }, [A_KEY]: { selected: 2, total: 2 } }); // skipped row stays out
    // Changing the prefix rebuilds previews without losing explicit choices.
    const rebuilt = mergeChoices(p1, await c.plan([s1, s2], [gDest(), aDest()], { prefix: 'Serie: ' }));
    expect(rowsOf(rebuilt).map((r) => [r.title.final, r.action, r.selected])).toEqual([
      ['Serie: Surf', 'skip', false],
      ['Serie: Surf', 'create', true],
    ]);
  });
});

describe('executePlan', () => {
  it('creates events per destination, stores links with true timing provenance, adds no attendees or reminders', async () => {
    const c = await setup();
    const s1 = await c.save('2026-07-04', { state: 'start_only', start: '07:00', timeZone: TZ });
    const s2 = await c.save('2026-07-05', { state: 'duration_only', declaredSec: 5400 }, { notes: 'Onde lunghe' });
    const statsBefore = summarize(await c.repos.sessions.listAll());
    const plan = await c.plan([s1, s2], [gDest(), aDest()], { startOnlySpanMin: 60 });
    const res = await c.run(plan);

    expect(res.destinations.map((d) => [d.key, d.counts])).toEqual([
      [G_KEY, { created: 2, linked: 0, updated: 0, skipped: 0, failed: 0, pending: 0 }],
      [A_KEY, { created: 2, linked: 0, updated: 0, skipped: 0, failed: 0, pending: 0 }],
    ]);
    expect(res.totals.created).toBe(4);

    const link = await c.repos.exportLinks.byOp(exportOpId(s1.id, gRef));
    expect(link).toMatchObject({ status: 'created', provider: 'google', calendarId: 'g-primary', sessionId: s1.id });
    expect(link!.snapshot).toMatchObject({ timingState: 'start_only', durationSec: null, durationSource: null, schedulingPlaceholder: true, categoryName: 'Surf' });
    const link2 = await c.repos.exportLinks.byOp(exportOpId(s2.id, aRef));
    expect(link2!.snapshot).toMatchObject({ timingState: 'duration_only', durationSec: 5400, durationSource: 'declared', schedulingPlaceholder: false, allDay: true });

    for (const p of [c.google, c.apple]) {
      for (const d of p.drafts) expect(Object.keys(d).sort()).toEqual(DRAFT_KEYS);
      expect(p.calls.every((x) => ALLOWED_PROVIDER_CALLS.has(x))).toBe(true);
    }
    expect(c.google.events[1].notes).toBe('Durata: 1 h 30 min\n\nOnde lunghe');
    // Exported events and placeholder spans never change local statistics.
    expect(summarize(await c.repos.sessions.listAll())).toEqual(statsBefore);
    expect((await c.repos.sessions.get(s1.id))!.timing.durationSec).toBeNull();

    // Re-planning recognises everything as already exported (default skip).
    const again = await c.plan([s1, s2], [gDest(), aDest()], { startOnlySpanMin: 60 });
    for (const d of again.destinations) expect(d.rows.map((r) => [r.status, r.selected])).toEqual([['already_exported', false], ['already_exported', false]]);
  });

  it('pending start-only rows are reported as pending and nothing is written', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04', { state: 'start_only', start: '07:00', timeZone: TZ });
    const plan = await c.plan([s], [gDest()]);
    expect(rowsOf(plan)[0]).toMatchObject({ status: 'pending_representation', draft: null, selected: false, reason: 'In attesa: approva la rappresentazione' });
    const res = await c.run(plan);
    expect(res.destinations[0].counts).toMatchObject({ pending: 1, created: 0 });
    expect(c.google.calls).not.toContain('createEvent');
  });

  it('keeps destinations independent: a failure in one does not affect the other', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04');
    c.google.createSteps = [{ fail: 'rate_limited' }];
    const res = await c.run(await c.plan([s], [gDest(), aDest()]));
    expect(res.destinations[0].counts).toMatchObject({ failed: 1, created: 0 });
    expect(res.destinations[0].rows[0]).toMatchObject({ code: 'provider_error', errorCode: 'rate_limited', message: 'Errore simulato del calendario' });
    expect(res.destinations[1].counts).toMatchObject({ created: 1, failed: 0 });
    const jobs = await c.repos.exportJobs.list();
    expect(jobs.map((j) => [j.provider, j.status, j.kind])).toEqual(
      expect.arrayContaining([
        ['google', 'failed', 'manual'],
        ['apple', 'succeeded', 'manual'],
      ]),
    );
  });

  it('recovers a partially failed batch without recreating successful items', async () => {
    const c = await setup();
    const sessions = [await c.save('2026-07-01'), await c.save('2026-07-02'), await c.save('2026-07-03')];
    c.google.createSteps = ['ok', { fail: 'offline' }, 'ok'];
    const plan = await c.plan(sessions, [gDest()]);
    const first = await c.run(plan);
    expect(first.destinations[0].counts).toMatchObject({ created: 2, failed: 1 });
    expect(c.google.events).toHaveLength(2);

    // Re-running the SAME (stale) plan: the stored links make successes skip.
    const retryStale = await c.run(plan);
    expect(retryStale.destinations[0].counts).toMatchObject({ created: 1, skipped: 2, failed: 0 });
    expect(retryStale.destinations[0].rows.filter((r) => r.code === 'already_exported')).toHaveLength(2);
    expect(c.google.events).toHaveLength(3);

    // A fresh plan now shows all three as already exported.
    const fresh = await c.plan(sessions, [gDest()]);
    expect(rowsOf(fresh).map((r) => r.status)).toEqual(['already_exported', 'already_exported', 'already_exported']);
    expect((await c.run(fresh)).destinations[0].counts).toMatchObject({ created: 0, skipped: 3 });
    expect(c.google.events).toHaveLength(3);
    expect(c.google.calls.filter((x) => x === 'createEvent')).toHaveLength(4);
  });

  it('reconciles an uncertain write via findByOpId right away', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04');
    c.google.createSteps = [{ uncertain: 'persisted' }];
    const res = await c.run(await c.plan([s], [gDest()]));
    expect(res.destinations[0].rows[0]).toMatchObject({ result: 'created', code: 'reconciled' });
    expect(c.google.events).toHaveLength(1);
    const link = await c.repos.exportLinks.byOp(exportOpId(s.id, gRef));
    expect(link?.externalEventId).toBe(c.google.events[0].eventId);
    expect((await c.repos.exportJobs.list()).map((j) => j.status)).toEqual(['succeeded']);
  });

  it('an unresolved uncertain write is reconciled before any retry creates again', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04');
    c.google.createSteps = [{ uncertain: 'persisted' }];
    c.google.findFailures = 1; // the immediate check cannot run
    const plan = await c.plan([s], [gDest()]);
    const first = await c.run(plan);
    expect(first.destinations[0].counts).toMatchObject({ pending: 1, created: 0 });
    expect(first.destinations[0].rows[0]).toMatchObject({ code: 'uncertain', message: 'Esito incerto: verifico prima di ritentare' });
    expect((await c.repos.exportJobs.list(['uncertain'])).length).toBe(1);

    // Retry while still offline for reads: no blind creation.
    c.google.findFailures = 1;
    const blocked = await c.run(plan);
    expect(blocked.destinations[0].rows[0]).toMatchObject({ result: 'failed', code: 'reconcile_failed' });
    expect(c.google.calls.filter((x) => x === 'createEvent')).toHaveLength(1);

    // Retry online: found by op id → linked, not created twice.
    const retry = await c.run(plan);
    expect(retry.destinations[0].rows[0]).toMatchObject({ result: 'created', code: 'reconciled' });
    expect(c.google.events).toHaveLength(1);
    expect(c.google.calls.filter((x) => x === 'createEvent')).toHaveLength(1);
    expect(await c.repos.exportJobs.list(['uncertain'])).toHaveLength(0);
  });

  it('an uncertain write that never landed is created on retry (once)', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04');
    c.google.createSteps = [{ uncertain: 'lost' }];
    const plan = await c.plan([s], [gDest()]);
    expect((await c.run(plan)).destinations[0].counts.pending).toBe(1);
    const retry = await c.run(plan);
    expect(retry.destinations[0].rows[0]).toMatchObject({ result: 'created', code: 'created' });
    expect(c.google.events).toHaveLength(1);
  });

  it('an unexpected error mid-write is treated as uncertain; a job left running is reconciled too', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04');
    c.google.createSteps = [{ crash: 'persisted' }];
    c.google.findFailures = 1;
    const plan = await c.plan([s], [gDest()]);
    expect((await c.run(plan)).destinations[0].rows[0].code).toBe('uncertain');
    // Simulate an interrupted app: the job is still 'running'.
    const [job] = await c.repos.exportJobs.list(['uncertain']);
    await c.repos.exportJobs.update(job.id, { status: 'running' });
    const retry = await c.run(plan);
    expect(retry.destinations[0].rows[0].code).toBe('reconciled');
    expect(c.google.events).toHaveLength(1);
  });

  it('a stale link is re-exported once (after checking by op id) and the link repointed', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04');
    await c.run(await c.plan([s], [gDest()]));
    const oldId = c.google.events[0].eventId;
    c.google.events = []; // the user deleted the event in Google Calendar
    const plan = await c.plan([s], [gDest()]);
    expect(rowsOf(plan)[0]).toMatchObject({ status: 'ready', reason: 'Evento collegato non trovato nel calendario: considerato non esportato.', selected: true });
    const res = await c.run(plan);
    expect(res.destinations[0].rows[0].code).toBe('created');
    expect(c.google.calls).toContain('findByOpId');
    const link = await c.repos.exportLinks.byOp(exportOpId(s.id, gRef));
    expect(link?.externalEventId).not.toBe(oldId);
    expect(c.google.events).toHaveLength(1);
  });

  it('link stores a link without changing the external event; possible duplicates need an explicit choice', async () => {
    const c = await setup();
    const s1 = await c.save('2026-07-04', { state: 'interval', start: '07:00', end: '08:00', endDayOffset: 0, timeZone: TZ });
    const s2 = await c.save('2026-07-05', { state: 'interval', start: '07:00', end: '08:00', endDayOffset: 0, timeZone: TZ });
    const mk = (id: string, date: string): ExternalEvent => ({
      ...gRef,
      eventId: id,
      recurringEventId: null,
      occurrenceKey: null,
      title: 'surf',
      notes: 'scritto a mano',
      location: null,
      allDay: false,
      start: { date, time: '07:05', timeZone: TZ, instant: new Date(zonedToEpoch(date, '07:05', TZ).epochMs).toISOString() },
      end: { date, time: '08:00', timeZone: TZ, instant: new Date(zonedToEpoch(date, '08:00', TZ).epochMs).toISOString() },
      status: 'confirmed',
      colorId: null,
      appMeta: null,
      updated: null,
    });
    c.google.events.push(mk('manual-1', '2026-07-04'), mk('manual-2', '2026-07-05'));
    const before = JSON.stringify(c.google.events);
    let plan = await c.plan([s1, s2], [gDest()]);
    expect(rowsOf(plan).map((r) => r.status)).toEqual(['possible_duplicate', 'possible_duplicate']);

    // Default: nothing happens to possible duplicates.
    const dry = await c.run(plan);
    expect(dry.destinations[0].counts).toMatchObject({ skipped: 2, created: 0, linked: 0 });

    plan = setRowChoice(plan, G_KEY, s1.id, { action: 'link' });
    plan = setRowChoice(plan, G_KEY, s2.id, { action: 'create' }); // deliberately a separate event
    const res = await c.run(plan);
    expect(res.destinations[0].counts).toMatchObject({ linked: 1, created: 1 });
    expect(c.google.events.slice(0, 2)).toEqual(JSON.parse(before)); // the manual events are untouched
    expect(c.google.calls).not.toContain('updateEvent');
    const link = await c.repos.exportLinks.byOp(exportOpId(s1.id, gRef));
    expect(link).toMatchObject({ status: 'linked', externalEventId: 'manual-1' });
    expect(link!.snapshot).toMatchObject({ title: 'surf', timingState: 'interval', durationSec: 3600, schedulingPlaceholder: false });

    // Next review: the linked event is recognised and unchanged.
    const next = await c.plan([s1, s2], [gDest()]);
    expect(rowsOf(next).map((r) => r.status)).toEqual(['already_exported', 'already_exported']);
  });

  it('update needs an explicit choice and only applies to a linked event in a writable destination', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04', undefined, { notes: 'prima' });
    await c.run(await c.plan([s], [gDest()]));
    const updated = await c.repos.sessions.update(s.id, { notes: 'dopo' });

    let plan = await c.plan([updated], [gDest()]);
    expect(rowsOf(plan)[0]).toMatchObject({ status: 'linked_changed', reason: 'Evento collegato modificato', defaultAction: 'skip', selected: false, allowedActions: ['skip', 'update'] });
    await c.run(plan);
    expect(c.google.events[0].notes).toBe('prima'); // default never overwrites

    // A hand-built row without an explicit choice is refused by the executor.
    const forced: ExportPlan = { ...plan, destinations: plan.destinations.map((d) => ({ ...d, rows: d.rows.map((r) => ({ ...r, action: 'update' as const, selected: true })) })) };
    expect((await c.run(forced)).destinations[0].rows[0]).toMatchObject({ result: 'failed', code: 'not_allowed' });
    expect(c.google.calls).not.toContain('updateEvent');

    plan = setRowChoice(plan, G_KEY, s.id, { action: 'update' });
    const res = await c.run(plan);
    expect(res.destinations[0].counts.updated).toBe(1);
    expect(c.google.events).toHaveLength(1);
    expect(c.google.events[0].notes).toBe('dopo');
    expect((await c.repos.exportLinks.byOp(exportOpId(s.id, gRef)))?.status).toBe('updated');

    // Not writable → update is not offered.
    const ro = await c.plan([await c.repos.sessions.update(s.id, { notes: 'ancora' })], [gDest({ calendar: cal(gRef, { canWrite: false }) })]);
    expect(rowsOf(ro)[0].allowedActions).toEqual(['skip']);
  });

  it('outgoing overrides change only the event unless explicitly applied to the session', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04', { state: 'start_only', start: '07:00', timeZone: TZ }, { notes: 'nota della sessione' });
    const override = { baseTitle: 'Surf all’alba', notes: 'solo nel calendario', date: '2026-07-05', time: { start: '06:30', end: '08:00' } };
    const statsBefore = summarize(await c.repos.sessions.listAll());
    const plan = await c.plan([s], [gDest()], { overrides: { [s.id]: override } });
    expect(rowsOf(plan)[0]).toMatchObject({ status: 'ready', title: { final: 'Surf all’alba', overridden: true } });
    await c.run(plan);
    expect(c.google.events[0]).toMatchObject({
      title: 'Surf all’alba',
      notes: 'solo nel calendario',
      start: { date: '2026-07-05', time: '06:30' },
      end: { time: '08:00' },
      appMeta: { timingState: 'start_only', durationSec: null, schedulingPlaceholder: true },
    });
    const stored = (await c.repos.sessions.get(s.id))!;
    expect(stored).toMatchObject({ date: '2026-07-04', notes: 'nota della sessione', timing: { state: 'start_only', start: '07:00', durationSec: null } });
    expect(summarize(await c.repos.sessions.listAll())).toEqual(statsBefore);

    // Explicit apply-back of notes + date + time.
    const r = overrideToSessionPatch(stored, override, ['notes', 'date', 'time']);
    if (!r.ok) throw new Error(r.error);
    const after = await c.repos.sessions.update(s.id, r.patch);
    expect(after).toMatchObject({ date: '2026-07-05', notes: 'solo nel calendario', timing: { state: 'interval', start: '06:30', end: '08:00', durationSec: 5400 } });
    expect(summarize(await c.repos.sessions.listAll()).duration.knownSec).toBe(5400);
  });

  it('refuses writes when the connection is gone or belongs to another account; link and skip stay local', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04');
    const plan = await c.plan([s], [gDest()]);
    c.google.conn = { ...gConn, status: 'disconnected', canRead: false, canWrite: false, detail: 'Non collegato' };
    expect((await c.run(plan)).destinations[0].rows[0]).toMatchObject({ result: 'failed', code: 'connection_unavailable', message: 'Non collegato' });
    c.google.conn = { ...gConn, accountId: 'someone-else@example.com' };
    expect((await c.run(plan)).destinations[0].rows[0]).toMatchObject({ result: 'failed', code: 'account_mismatch' });
    expect(c.google.calls).not.toContain('createEvent');
  });

  it('stops cleanly when aborted, leaving the rest pending', async () => {
    const c = await setup();
    const sessions = [await c.save('2026-07-01'), await c.save('2026-07-02')];
    const plan = await c.plan(sessions, [gDest()]);
    const ac = new AbortController();
    const res = await executePlan({
      plan,
      providers: { google: c.google },
      repos: c.repos,
      signal: ac.signal,
      onProgress: (p) => {
        if (p.done === 1) ac.abort();
      },
    });
    expect(res.destinations[0].counts).toMatchObject({ created: 1, pending: 1 });
    expect(res.destinations[0].rows[1].code).toBe('aborted');
  });
});

// ─── regressions found in review ─────────────────────────────────────────────

const iso = (date: string, time: string) => new Date(zonedToEpoch(date, time, TZ).epochMs).toISOString();
function foreignEvent(eventId: string, title: string, date: string, times: { start: string; end: string } | null, over: Partial<ExternalEvent> = {}): ExternalEvent {
  return {
    ...gRef,
    eventId,
    recurringEventId: null,
    occurrenceKey: null,
    title,
    notes: null,
    location: null,
    allDay: !times,
    start: times ? { date, time: times.start, timeZone: TZ, instant: iso(date, times.start) } : { date, time: null, timeZone: null, instant: null },
    end: times ? { date, time: times.end, timeZone: TZ, instant: iso(date, times.end) } : { date: addDays(date, 1), time: null, timeZone: null, instant: null },
    status: 'confirmed',
    colorId: null,
    appMeta: null,
    updated: null,
    ...over,
  };
}

describe('regressions', () => {
  it('mergeChoices never carries a choice onto a row whose situation changed (safe default wins)', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04', { state: 'interval', start: '07:00', end: '08:00', endDayOffset: 0, timeZone: TZ });
    const first = setRowChoice(await c.plan([s], [gDest()]), G_KEY, s.id, { action: 'create', selected: true }); // explicit while 'ready'
    expect(rowsOf(first)[0]).toMatchObject({ status: 'ready', touched: true });
    // A similar event appears (re-read): the row now needs a decision.
    c.google.events.push(foreignEvent('manual-1', 'Surf', '2026-07-04', { start: '07:05', end: '08:00' }));
    const merged = mergeChoices(first, await c.plan([s], [gDest()]));
    expect(rowsOf(merged)[0]).toMatchObject({ status: 'possible_duplicate', action: 'skip', selected: false });
    expect((await c.run(merged)).destinations[0].counts).toMatchObject({ created: 0, skipped: 1 });
    expect(c.google.calls).not.toContain('createEvent');

    // A 'link' whose chosen event disappeared is not silently retargeted to another candidate.
    const linked = setRowChoice(await c.plan([s], [gDest()]), G_KEY, s.id, { action: 'link' });
    expect(rowsOf(linked)[0].linkTargetEventId).toBe('manual-1');
    c.google.events = [foreignEvent('manual-2', 'Surf', '2026-07-04', { start: '07:10', end: '08:00' })];
    const retarget = mergeChoices(linked, await c.plan([s], [gDest()]));
    expect(rowsOf(retarget)[0]).toMatchObject({ status: 'possible_duplicate', action: 'skip', selected: false, linkTargetEventId: 'manual-2' });

    // An explicit opt-out IS carried across a status change (it can never write anything).
    const optOut = setRowChoice(retarget, G_KEY, s.id, { action: 'create', selected: false });
    c.google.events = [];
    const back = mergeChoices(optOut, await c.plan([s], [gDest()]));
    expect(rowsOf(back)[0]).toMatchObject({ status: 'ready', selected: false });
  });

  it('an imported session is not re-created into its source calendar when the source event is outside the window', async () => {
    const c = await setup();
    const s = await c.save('2026-07-10', undefined, {});
    const imported = { ...s, origin: 'import' as const };
    // Imported from an event on 1 July; the session was later moved to 10 July.
    c.google.events.push(foreignEvent('src-1', 'Lezione di surf', '2026-07-01', { start: '09:00', end: '11:00' }));
    const prov: ProvenanceRecord = {
      id: 'p1', sessionId: s.id, ...gRef, externalEventId: 'src-1', recurringEventId: null, occurrenceKey: null, originalTitle: 'Lezione di surf',
      sourceAllDay: false, sourceStart: iso('2026-07-01', '09:00'), sourceEnd: iso('2026-07-01', '11:00'), importBatchId: 'b1', importedAt: '2026-07-02T00:00:00.000Z',
    };
    const links = await c.repos.exportLinks.all();
    const mkPlan = async (loadProvenance: boolean) => {
      const reads = await loadAllDestinationEvents({ google: c.google }, [gDest()], [imported], links, loadProvenance ? { provenance: [prov] } : {});
      return buildExportPlan({ sessions: [imported], category: c.cat, destinations: [gDest()], options: baseOptions, links, destinationEvents: eventsOf(reads), provenance: [prov] });
    };
    // Caller passes provenance to the read: the source event is fetched and recognised (link/skip only).
    const withSource = rowsOf(await mkPlan(true))[0];
    expect(withSource).toMatchObject({ status: 'recognized', defaultAction: 'skip', selected: false, allowedActions: ['link', 'skip'], linkTargetEventId: 'src-1' });
    // Caller did not: the source is unknown, so the row is still never a default 'create'.
    const plan = await mkPlan(false);
    expect(rowsOf(plan)[0]).toMatchObject({ status: 'recognized', defaultAction: 'skip', selected: false, allowedActions: ['skip', 'create'], linkTargetEventId: null });
    expect(rowsOf(plan)[0].reason).toBe('Sessione importata da questo calendario');
    expect(setSelection(plan, null, true).destinations[0].rows[0].selected).toBe(false);
    await c.run(plan);
    expect(c.google.calls).not.toContain('createEvent');
  });

  it('linking Serie’s own event records the timing it was written with, so later drift is reported', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04', { state: 'start_only', start: '07:00', timeZone: TZ });
    // An earlier export (start-only + 60 min placeholder) whose local link was lost.
    const old = buildEventDraft(s, { categoryName: 'Surf', opId: exportOpId(s.id, gRef), prefix: '', suffix: '', includeNotes: true, includeLocation: true, startOnlySpanMin: 60 });
    c.google.events.push(foreignEvent('own-1', 'Surf', '2026-07-04', { start: '07:00', end: '08:00' }, { appMeta: old.draft!.appMeta }));
    // The session has since become a real interval.
    const iv = buildTiming('2026-07-04', { state: 'interval', start: '07:00', end: '09:00', endDayOffset: 0, timeZone: TZ });
    if (!iv.ok) throw new Error(iv.error);
    const now = await c.repos.sessions.update(s.id, { timing: iv.timing });
    const plan = await c.plan([now], [gDest()]);
    expect(rowsOf(plan)[0]).toMatchObject({ status: 'recognized', defaultAction: 'link', selected: true });
    const res = await c.run(plan);
    expect(res.destinations[0].counts).toMatchObject({ linked: 1, created: 0 });
    const link = await c.repos.exportLinks.byOp(exportOpId(s.id, gRef));
    expect(link!.snapshot).toMatchObject({ timingState: 'start_only', durationSec: null, schedulingPlaceholder: true });
    const next = await c.plan([now], [gDest()]);
    expect(rowsOf(next)[0]).toMatchObject({ status: 'linked_changed', allowedActions: ['skip', 'update'] });
    expect(rowsOf(next)[0].duplicate.changes?.session).toEqual(expect.arrayContaining(['timing']));
  });

  it('refuses a Google write when the signed-in account is not the destination account, even without a recorded connection account', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04');
    const dest = gDest({ connection: { ...gConn, accountId: null } });
    const plan = await c.plan([s], [dest]);
    c.google.conn = { ...gConn, accountId: 'someone-else@example.com' };
    expect((await c.run(plan)).destinations[0].rows[0]).toMatchObject({ result: 'failed', code: 'account_mismatch' });
    expect(c.google.calls).not.toContain('createEvent');
    // Same account, different letter case: allowed.
    c.google.conn = { ...gConn, accountId: G_ACCOUNT.toUpperCase() };
    expect((await c.run(plan)).destinations[0].counts.created).toBe(1);
  });

  it('a manual run never overwrites the payload of an open automatic job for the same operation', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04');
    const opId = exportOpId(s.id, gRef);
    const auto = await c.repos.exportJobs.enqueue({ opId, sessionId: s.id, ...gRef, kind: 'auto', payload: { v: 1, marker: 'auto-payload' } });
    c.google.createSteps = [{ fail: 'rate_limited' }];
    await c.run(await c.plan([s], [gDest()]));
    const [job] = await c.repos.exportJobs.list();
    expect(job).toMatchObject({ id: auto.id, kind: 'auto', status: 'failed', payload: { v: 1, marker: 'auto-payload' } });
  });

  it('reconciles with findByOpId around the session date as well as the outgoing date', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04');
    const opId = exportOpId(s.id, gRef);
    // An automatic attempt (session date) left an uncertain write that landed.
    const autoDraft = buildEventDraft(s, { categoryName: 'Surf', opId, prefix: '', suffix: '', includeNotes: true, includeLocation: true }).draft!;
    c.google.events.push({ ...foreignEvent('auto-ev', 'Surf', '2026-07-04', null), appMeta: autoDraft.appMeta });
    await c.repos.exportJobs.enqueue({ opId, sessionId: s.id, ...gRef, kind: 'auto', status: 'uncertain', payload: { v: 1 } });
    // The manual export moves the outgoing event to 20 July; the read finds nothing there (write-only-like: not checked).
    const plan = buildExportPlan({
      sessions: [s], category: c.cat, destinations: [gDest()], options: { ...baseOptions, overrides: { [s.id]: { date: '2026-07-20' } } }, links: [], destinationEvents: {},
    });
    const res = await c.run(setRowChoice(plan, G_KEY, s.id, { action: 'create', selected: true }));
    expect(res.destinations[0].rows[0]).toMatchObject({ result: 'created', code: 'reconciled' });
    expect(c.google.calls).not.toContain('createEvent');
  });

  it('a malformed outgoing date never breaks the destination read', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04');
    expect(exportWindow([s], { [s.id]: { date: 'not-a-date' } })).toEqual({ from: '2026-07-03', to: '2026-07-05' });
    const plan = await c.plan([s], [gDest()], { overrides: { [s.id]: { date: 'not-a-date' } } });
    expect(plan.destinations[0].checked).toBe(true);
    expect(rowsOf(plan)[0]).toMatchObject({ status: 'invalid', selected: false });
  });

  it('when earlier attempts cannot be read, creation reconciles by op id first (no blind second write)', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04');
    const plan = await c.plan([s], [gDest()]);
    // An earlier write landed but its job record is unreadable right now.
    const d = rowsOf(plan)[0].draft!;
    c.google.events.push({ ...foreignEvent('landed', 'Surf', '2026-07-04', null), appMeta: d.appMeta });
    const jobs = { ...c.repos.exportJobs, list: async () => { throw new Error('database is locked'); } };
    const res = await executePlan({ plan, providers: { google: c.google }, repos: { exportLinks: c.repos.exportLinks, exportJobs: jobs } });
    expect(res.destinations[0].rows[0]).toMatchObject({ result: 'created', code: 'reconciled' });
    expect(c.google.calls).not.toContain('createEvent');
  });

  it('an imported session’s original title counts as a known title in another calendar', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04', { state: 'interval', start: '09:00', end: '11:00', endDayOffset: 0, timeZone: TZ });
    // Imported from Apple; Google holds a copy of the same lesson under its original title.
    c.google.events.push(foreignEvent('copy-1', 'Lezione con Marco', '2026-07-04', { start: '09:00', end: '11:00' }));
    const prov: ProvenanceRecord = {
      id: 'p1', sessionId: s.id, ...aRef, externalEventId: 'a-src', recurringEventId: null, occurrenceKey: null, originalTitle: 'Lezione con Marco',
      sourceAllDay: false, sourceStart: iso('2026-07-04', '09:00'), sourceEnd: iso('2026-07-04', '11:00'), importBatchId: 'b1', importedAt: '2026-07-05T00:00:00.000Z',
    };
    const links = await c.repos.exportLinks.all();
    const reads = await loadAllDestinationEvents({ google: c.google }, [gDest()], [s], links);
    const build = (provenance: ProvenanceRecord[]) => buildExportPlan({ sessions: [s], category: c.cat, destinations: [gDest()], options: baseOptions, links, destinationEvents: eventsOf(reads), provenance });
    expect(rowsOf(build([]))[0].status).toBe('ready');
    expect(rowsOf(build([prov]))[0]).toMatchObject({ status: 'possible_duplicate', defaultAction: 'skip', selected: false, linkTargetEventId: 'copy-1' });
  });

  it('per-destination settings: undefined keys keep the batch value; per-session overrides merge field by field', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04', undefined, { notes: 'nota', place: { label: 'Lido', address: null, mapUrl: null, coords: null, resolution: 'none', resolutionNote: null } });
    const plan = await c.plan(
      [s],
      [gDest({ options: { prefix: undefined, includeNotes: undefined, includeLocation: undefined, overrides: { [s.id]: { baseTitle: 'Surf G', notes: undefined } } } })],
      { prefix: '🌊 ', overrides: { [s.id]: { notes: 'solo calendario' } } },
    );
    expect(plan.destinations[0].options).toMatchObject({ prefix: '🌊 ', includeNotes: true, includeLocation: true });
    expect(rowsOf(plan)[0].draft).toMatchObject({ title: '🌊 Surf G', notes: 'solo calendario', location: 'Lido' });
  });

  it('duplicate session entries produce one row per destination', async () => {
    const c = await setup();
    const s = await c.save('2026-07-04');
    const plan = await c.plan([s, s], [gDest()]);
    expect(rowsOf(plan)).toHaveLength(1);
  });
});
