/**
 * Cross-module consistency: the manual export engine, automatic export, the
 * import engine and both providers' metadata codecs must agree on
 *   - AppEventMeta (what one writes, every other reads back unchanged, and the
 *     same malformed metadata is rejected everywhere);
 *   - op ids (the same session × destination gets the same id in both engines);
 *   - the failed-write rule (a create that may have landed is reconciled by op
 *     id before any retry, whichever engine retries);
 *   - link snapshots, account comparison and one export run at a time.
 */
import { testRepos } from '@/test/sqljs';
import { mkSession } from '@/test/factories';
import { buildTiming, type TimingInput } from '@/domain/timing';
import { addDays } from '@/domain/dates';
import type { Category, LocalDate, ProviderKind, Session } from '@/domain/types';
import type { Repositories } from '@/data/repositories';
import { ProviderError, refKey, type AppEventMeta, type CalendarRef, type EventDraft, type ExternalEvent } from '../types';
import { APP_META_TIMING_STATES, canonicalAppMeta, parseAppMeta, sameAppMeta } from '../appMeta';
import { appMetaFor, buildEventDraft } from '../representation';
import { classifyDuplicates } from '../duplicates';
import { destinationKey, exportOpId } from '../opId';
import { buildReview, trustedTimingOf } from '../importEngine';
import { buildExportPlan, eventsOf, executePlan, loadAllDestinationEvents, setRowChoice, type ExportDestinationInput, type ExportOptions } from '../exportEngine';
import { defaultConfig, eligibleDestinations, enqueueForSessions, parsePayload, resolveReviewJob, runJobs, type AutoExportConfig } from '../autoExport';
import { linkedEventMeta, paddedWindow, sameAccountId, withExportLock, writeMayHaveApplied } from '../exportCore';
import { draftToGoogleBody, metaToPrivate, normalizeGoogleEvent, privateToMeta } from '../google/provider';
import type { GCalEvent } from '../google/api';
import { draftToDetails, toExternalEvent, type EKEventLike } from '../apple/mapping';
import { decodeMeta, encodeMeta, base64UrlEncode } from '../apple/meta';
import { createMemoryProvider } from '../memory';
import { A_CAL, A_CONN, A_REF, EMAIL, FakeProvider, G_CAL, G_CONN, G_REF, TZ, instantOf } from './fakeCalendar';

// ─── sessions in every timing state ──────────────────────────────────────────

function sessionWith(date: LocalDate, input: TimingInput | null, id?: string): Session {
  if (!input) return mkSession({ date, id });
  const r = buildTiming(date, input);
  if (!r.ok) throw new Error(`bad timing: ${r.error}`);
  return mkSession({ date, id, timing: r.timing, notes: 'Onde lunghe', place: { label: 'La Fuente', address: null, mapUrl: 'https://maps.app.goo.gl/abc', coords: null, resolution: 'unsupported', resolutionNote: null } });
}

const CASES: { name: string; date: LocalDate; timing: TimingInput | null }[] = [
  { name: 'date only', date: '2026-07-04', timing: null },
  { name: 'start only (approved span)', date: '2026-07-04', timing: { state: 'start_only', start: '07:30', timeZone: TZ } },
  { name: 'interval', date: '2026-07-04', timing: { state: 'interval', start: '07:30', end: '09:00', endDayOffset: 0, timeZone: TZ } },
  { name: 'overnight interval', date: '2026-07-04', timing: { state: 'interval', start: '22:30', end: '01:00', endDayOffset: 1, timeZone: TZ } },
  { name: 'duration only', date: '2026-07-04', timing: { state: 'duration_only', declaredSec: 5400 } },
  { name: 'start + declared duration', date: '2026-07-04', timing: { state: 'start_duration', start: '07:00', timeZone: TZ, declaredSec: 5400 } },
  { name: 'start + duration across the DST fall-back hour', date: '2026-10-25', timing: { state: 'start_duration', start: '01:30', timeZone: TZ, declaredSec: 7200 } },
];


function draftOf(session: Session, ref: CalendarRef): EventDraft {
  const res = buildEventDraft(session, {
    categoryName: 'Surf',
    opId: exportOpId(session.id, ref),
    prefix: '🌊 ',
    suffix: '',
    includeNotes: true,
    includeLocation: true,
    startOnlySpanMin: 90,
    colorId: ref.provider === 'google' ? '7' : null,
  });
  if (res.status !== 'ready') throw new Error(`draft not ready: ${res.status}`);
  return res.draft;
}


/** Google: draft → insert body → what the API echoes → ExternalEvent. */
function viaGoogle(draft: EventDraft): ExternalEvent {
  const body = draftToGoogleBody(draft);
  const echoed: GCalEvent = { ...(body as unknown as GCalEvent), id: 'g-1', status: 'confirmed', updated: '2026-07-05T10:00:00.000Z' };
  return normalizeGoogleEvent(JSON.parse(JSON.stringify(echoed)) as GCalEvent, { accountId: EMAIL, calendarId: G_REF.calendarId, calendarTimeZone: TZ })!;
}

/** Apple: draft → EventKit fields → the saved EKEvent → ExternalEvent (URL field, or the notes trailer when the URL is the user's). */
function viaApple(draft: EventDraft, existingUrl: string | null = null): ExternalEvent {
  const d = draftToDetails(draft, { deviceTz: TZ, mode: existingUrl ? 'update' : 'create', existingUrl });
  const ek: EKEventLike = {
    id: 'EK-1',
    calendarId: A_REF.calendarId,
    title: d.title,
    location: d.location ?? null,
    notes: d.notes ?? null,
    url: d.url ?? existingUrl,
    timeZone: d.timeZone ?? null,
    startDate: d.startDate.toISOString(),
    endDate: d.endDate.toISOString(),
    allDay: d.allDay,
    status: 'confirmed',
  };
  return toExternalEvent(ek, { accountId: A_REF.accountId, deviceTz: TZ })!;
}

const reviewOf = (ev: ExternalEvent, localSessions: Session[]) =>
  buildReview({
    events: [ev],
    filters: { calendarIds: [ev.calendarId], titleContains: null, labelIds: null, from: addDays(ev.start.date, -3), to: addDays(ev.start.date, 3) },
    capabilities: { eventLabels: ev.provider === 'google' },
    provenance: [],
    localSessions,
    exportLinks: [],
    category: { id: 'surf', name: 'Surf' },
    deviceTimeZone: TZ,
  })[0];

describe('AppEventMeta round-trips between the engines and both providers', () => {
  for (const c of CASES) {
    describe(c.name, () => {
      const session = sessionWith(c.date, c.timing);

      it('writes canonical metadata carrying the TRUE recorded timing', () => {
        const draft = draftOf(session, G_REF);
        expect(parseAppMeta(draft.appMeta)).toEqual(draft.appMeta);
        expect(draft.appMeta).toMatchObject({ sessionId: session.id, opId: exportOpId(session.id, G_REF), timingState: session.timing.state, durationSec: session.timing.durationSec });
      });

      it('Google: insert body → API echo → the same metadata and instants', () => {
        const draft = draftOf(session, G_REF);
        const ev = viaGoogle(draft);
        expect(ev.appMeta).toEqual(draft.appMeta);
        expect(privateToMeta(metaToPrivate(draft.appMeta))).toEqual(draft.appMeta);
        if (!draft.allDay) {
          expect(ev.start.instant).toBe(instantOf(draft.start));
          expect(ev.end.instant).toBe(instantOf(draft.end));
        } else {
          expect([ev.start.date, ev.end.date]).toEqual([draft.start.date, draft.end.date]);
        }
      });

      it('Apple: URL field and notes trailer both read back the same metadata; notes stay clean', () => {
        const draft = draftOf(session, A_REF);
        const viaUrl = viaApple(draft);
        expect(viaUrl.appMeta).toEqual(draft.appMeta);
        expect(viaUrl.notes).toBe(draft.notes);
        const viaNotes = viaApple(draft, 'https://example.com/my-own-link');
        expect(viaNotes.appMeta).toEqual(draft.appMeta);
        expect(viaNotes.notes).toBe(draft.notes);
        expect(decodeMeta(encodeMeta(draft.appMeta))).toEqual(draft.appMeta);
        if (!draft.allDay) {
          expect(viaUrl.start.instant).toBe(instantOf(draft.start));
          expect(viaUrl.end.instant).toBe(instantOf(draft.end));
        }
      });

      it('in-memory provider (E2E builds) stores and returns the same metadata', async () => {
        const p = createMemoryProvider('google');
        await p.connect('readwrite');
        const created = await p.createEvent('primary-e2e', draftOf(session, G_REF));
        expect(created.appMeta).toEqual(draftOf(session, G_REF).appMeta);
      });

      it('import restores the recorded timing from either provider and never manufactures hours', () => {
        for (const ev of [viaGoogle(draftOf(session, G_REF)), viaApple(draftOf(session, A_REF))]) {
          expect(trustedTimingOf(ev, null)).toMatchObject({ source: 'app_meta', timingState: session.timing.state, durationSec: session.timing.durationSec });
          // No local trace (another install, or deleted without a link): importable, timing restored from the metadata.
          const gone = reviewOf(ev, []);
          expect(gone.status).toBe('new');
          expect(gone.proposed.timingSource).toBe('app_meta');
          expect(gone.proposed.timing.state).toBe(session.timing.state);
          expect(gone.proposed.timing.durationSec).toBe(session.timing.durationSec);
          expect(gone.proposed.timing.start).toBe(session.timing.start);
          expect(gone.proposed.notes ?? '').not.toMatch(/serie:\/\/|Durata:/);
          // Session still there: never imported again.
          const live = reviewOf(ev, [session]);
          expect(live).toMatchObject({ status: 'own_export', selectable: false, matchedSessionId: session.id });
        }
      });

      it('duplicate check recognises the event by op id from either provider', () => {
        for (const [ref, ev] of [
          [G_REF, viaGoogle(draftOf(session, G_REF))],
          [A_REF, viaApple(draftOf(session, A_REF))],
        ] as const) {
          const draft = draftOf(session, ref);
          const [check] = classifyDuplicates([{ session, opId: exportOpId(session.id, ref), draft, finalTitle: draft.title, baseTitle: 'Surf', date: session.date }], {
            categoryName: 'Surf',
            prefix: '🌊 ',
            suffix: '',
            links: [],
            events: [ev],
          });
          expect(check).toMatchObject({ class: 'recognized', recognizedBy: 'op_id' });
        }
      });
    });
  }

  it('canonicalises a non-canonical session timing so every reader accepts what was written', () => {
    const s = mkSession({ date: '2026-07-04', timing: { ...sessionWith('2026-07-04', CASES[4].timing).timing, durationSec: 5400.4, durationSource: null } });
    const meta = appMetaFor(s, exportOpId(s.id, G_REF), false);
    expect(meta).toMatchObject({ durationSec: 5400, durationSource: 'declared' });
    expect(privateToMeta(metaToPrivate(meta))).toEqual(meta);
    expect(decodeMeta(encodeMeta(meta))).toEqual(meta);
    expect(canonicalAppMeta({ ...meta, durationSec: 0, durationSource: 'declared' })).toMatchObject({ durationSec: null, durationSource: null });
  });

  it('every reader rejects the same malformed metadata', () => {
    const good: AppEventMeta = { v: 1, sessionId: 's1', opId: 'op1_s1_0123456789ab', timingState: 'interval', durationSec: 5400, durationSource: 'interval', schedulingPlaceholder: false };
    const bad: Record<string, unknown>[] = [
      { ...good, v: 2 },
      { ...good, sessionId: '' },
      { ...good, opId: '' },
      { ...good, timingState: 'all_day' },
      { ...good, durationSec: 0 },
      { ...good, durationSec: 1.5 },
      { ...good, durationSec: 5400, durationSource: null },
      { ...good, durationSec: null, durationSource: 'interval' },
      { ...good, durationSource: 'guess' },
      { ...good, schedulingPlaceholder: 'no' },
      (({ schedulingPlaceholder: _x, ...rest }) => rest)(good),
    ];
    const asGoogle = (m: Record<string, unknown>): Record<string, string> => {
      const p: Record<string, string> = { serie_v: String(m.v), serie_session: String(m.sessionId ?? ''), serie_op: String(m.opId ?? ''), serie_timing: String(m.timingState) };
      if (m.durationSec != null) p.serie_dur = String(m.durationSec);
      if (m.durationSource != null) p.serie_src = String(m.durationSource);
      if (typeof m.schedulingPlaceholder === 'boolean') p.serie_sched = m.schedulingPlaceholder ? '1' : '0';
      else if (m.schedulingPlaceholder != null) p.serie_sched = String(m.schedulingPlaceholder);
      return p;
    };
    const ev = (appMeta: unknown): ExternalEvent => ({ ...viaGoogle(draftOf(sessionWith('2026-07-04', CASES[2].timing), G_REF)), appMeta: appMeta as AppEventMeta });
    expect(parseAppMeta(good)).toEqual(good);
    expect(privateToMeta(asGoogle(good as never))).toEqual(good);
    for (const b of bad) {
      expect(parseAppMeta(b)).toBeNull();
      expect(privateToMeta(asGoogle(b))).toBeNull();
      expect(decodeMeta(base64UrlEncode(JSON.stringify(b)))).toBeNull();
      expect(trustedTimingOf(ev(b), null)).toBeNull();
    }
    expect(APP_META_TIMING_STATES).toHaveLength(5);
    expect(sameAppMeta(good, { ...good })).toBe(true);
    expect(sameAppMeta(good, { ...good, schedulingPlaceholder: true })).toBe(false);
  });
});

// ─── engines over real (sql.js) repositories ─────────────────────────────────

const OPTIONS: ExportOptions = { prefix: '', suffix: '', includeNotes: true, includeLocation: true, startOnlySpanMin: null, overrides: {} };
/** After the test repositories' clock (jobs are due from their creation time). */
const NOW = new Date('2026-10-12T09:00:00.000Z');

interface World {
  repos: Repositories;
  surf: Category;
  google: FakeProvider;
  apple: FakeProvider;
  providers: { google: FakeProvider; apple: FakeProvider };
  save: (date?: LocalDate) => Promise<Session>;
  dests: (which?: ProviderKind[]) => ExportDestinationInput[];
  manual: (sessions: Session[], which?: ProviderKind[], options?: Partial<ExportOptions>) => Promise<ReturnType<typeof buildExportPlan>>;
  config: (p?: Partial<AutoExportConfig>) => AutoExportConfig;
}

async function world(): Promise<World> {
  const repos = await testRepos();
  const surf = await repos.categories.create({ name: 'Surf', color: '#2E7D9A', pattern: 'swell' });
  const google = new FakeProvider('google', [G_CAL], G_CONN);
  const apple = new FakeProvider('apple', [A_CAL], A_CONN);
  const providers = { google, apple };
  let req = 0;
  const dests = (which: ProviderKind[] = ['google']): ExportDestinationInput[] =>
    which.map((k) => (k === 'google' ? { ref: G_REF, calendar: G_CAL, connection: G_CONN, labelId: null } : { ref: A_REF, calendar: A_CAL, connection: A_CONN, labelId: null }));
  return {
    repos,
    surf,
    google,
    apple,
    providers,
    async save(date = '2026-07-04') {
      const tm = buildTiming(date, { state: 'interval', start: '07:30', end: '09:00', endDayOffset: 0, timeZone: TZ });
      if (!tm.ok) throw new Error('timing');
      return (await repos.sessions.saveBatch({ categoryId: surf.id, dates: [date], requestId: `req-${++req}`, shared: { timing: tm.timing } })).sessions[0];
    },
    dests,
    async manual(sessions, which = ['google'], options = {}) {
      const d = dests(which);
      const links = await repos.exportLinks.all();
      const reads = await loadAllDestinationEvents(providers, d, sessions, links, { overrides: options.overrides });
      return buildExportPlan({ sessions, category: surf, destinations: d, options: { ...OPTIONS, ...options }, links, destinationEvents: eventsOf(reads) });
    },
    config(p = {}) {
      return { ...defaultConfig(), enabled: true, destinations: { google: { calendarId: G_REF.calendarId, accountId: EMAIL, labelId: null } }, ...p };
    },
  };
}

describe('op ids are identical in both engines', () => {
  it('the same session × destination gets the same op id in the manual plan and the automatic plan', async () => {
    const w = await world();
    const s = await w.save();
    const cfg = w.config({ destinations: { google: { calendarId: G_REF.calendarId, accountId: EMAIL, labelId: null }, apple: { calendarId: A_REF.calendarId, accountId: A_REF.accountId } }, bothResolution: 'resolved_distinct' });
    const auto = eligibleDestinations(s, w.surf, cfg, [], { calendars: [G_CAL, A_CAL] });
    const manual = await w.manual([s], ['google', 'apple']);
    const autoIds = Object.fromEntries(auto.eligible.map((d) => [d.provider, d.opId]));
    const manualIds = Object.fromEntries(manual.destinations.map((d) => [d.ref.provider, d.rows[0].opId]));
    expect(autoIds).toEqual(manualIds);
    expect(manualIds).toEqual({ google: exportOpId(s.id, G_REF), apple: exportOpId(s.id, A_REF) });
    expect(destinationKey(G_REF)).toBe(refKey(G_REF));
    expect(manual.destinations[0].rows[0].draft!.appMeta.opId).toBe(manualIds.google);
  });

  it('a manual export is never queued again by automatic export, and vice versa', async () => {
    const w = await world();
    const [a, b] = [await w.save('2026-07-04'), await w.save('2026-07-05')];
    // a: manual first.
    await executePlan({ plan: await w.manual([a]), providers: w.providers, repos: w.repos });
    const q = await enqueueForSessions(w.repos, [a, b], [w.surf], w.config());
    expect(q.skipped).toEqual([expect.objectContaining({ sessionId: a.id, code: 'already_exported' })]);
    // b: automatic first.
    await runJobs({ repos: w.repos, providers: w.providers, now: NOW, config: w.config() });
    expect(w.google.count('createEvent')).toBe(2);
    const plan = await w.manual([a, b]);
    expect(plan.destinations[0].rows.map((r) => r.status)).toEqual(['already_exported', 'already_exported']);
    expect((await executePlan({ plan, providers: w.providers, repos: w.repos })).totals).toMatchObject({ created: 0, skipped: 2 });
    expect(w.google.events).toHaveLength(2);
  });
});

describe('failed writes follow one rule in both engines', () => {
  it('writeMayHaveApplied: only proven refusals allow a fresh create', () => {
    for (const code of ['unauthorized', 'forbidden', 'not_found', 'invalid', 'rate_limited'] as const) expect(writeMayHaveApplied(new ProviderError(code, 'x'))).toBe(false);
    for (const code of ['uncertain', 'conflict', 'unknown', 'unavailable', 'offline'] as const) expect(writeMayHaveApplied(new ProviderError(code, 'x'))).toBe(true);
    expect(writeMayHaveApplied(new TypeError('Network request failed'))).toBe(true);
  });

  it('manual: a create that failed as "unavailable" but landed is found by op id, not created twice', async () => {
    const w = await world();
    const s = await w.save();
    w.google.createSteps = [{ throw: new ProviderError('unavailable', 'Servizio non disponibile'), persist: true }];
    w.google.findFailures = 1; // the immediate look-up cannot run either
    const plan = await w.manual([s]);
    const first = await executePlan({ plan, providers: w.providers, repos: w.repos });
    expect(first.destinations[0].rows[0]).toMatchObject({ result: 'failed', code: 'provider_error', errorCode: 'unavailable', message: 'Servizio non disponibile' });
    expect((await w.repos.exportJobs.list()).map((j) => j.status)).toEqual(['uncertain']);
    const retry = await executePlan({ plan, providers: w.providers, repos: w.repos });
    expect(retry.destinations[0].rows[0]).toMatchObject({ result: 'created', code: 'reconciled' });
    expect(w.google.events).toHaveLength(1);
    expect(w.google.count('createEvent')).toBe(1);
  });

  it('manual: a proven refusal stays a plain failure (no reconciliation duty)', async () => {
    const w = await world();
    const s = await w.save();
    w.google.createSteps = [{ throw: new ProviderError('rate_limited', 'Troppe richieste', 60_000), persist: false }];
    await executePlan({ plan: await w.manual([s]), providers: w.providers, repos: w.repos });
    expect((await w.repos.exportJobs.list()).map((j) => j.status)).toEqual(['failed']);
    expect(w.google.count('findByOpId')).toBe(0);
  });

  it('auto job taken over by a manual export with another outgoing date: the runner reconciles where it was written', async () => {
    const w = await world();
    const s = await w.save('2026-07-04');
    const { jobs } = await enqueueForSessions(w.repos, [s], [w.surf], w.config());
    expect(jobs[0]).toMatchObject({ kind: 'auto', status: 'pending' });

    // The manual export moves the outgoing event 5 days later; its write lands but the answer is lost.
    w.google.createSteps = [{ throw: new ProviderError('uncertain', 'Risposta persa'), persist: true }];
    w.google.findFailures = 1;
    const plan = await w.manual([s], ['google'], { overrides: { [s.id]: { date: '2026-07-09' } } });
    const res = await executePlan({ plan, providers: w.providers, repos: w.repos });
    expect(res.destinations[0].rows[0]).toMatchObject({ result: 'pending', code: 'uncertain' });
    const taken = (await w.repos.exportJobs.list()).find((j) => j.id === jobs[0].id)!;
    expect(taken).toMatchObject({ kind: 'auto', status: 'uncertain' });
    expect(parsePayload(taken.payload)).toMatchObject({ attemptedDate: '2026-07-09', reconcile: true, source: 'auto_export' });

    const out = await runJobs({ repos: w.repos, providers: w.providers, now: new Date(Date.now() + 60_000), config: w.config() }); // after the manual run's clock
    expect(out.outcomes).toEqual([expect.objectContaining({ jobId: jobs[0].id, status: 'succeeded', eventId: w.google.events[0].eventId })]);
    expect(w.google.events).toHaveLength(1);
    expect(w.google.count('createEvent')).toBe(1);
  });
});

describe('an unreadable event of this operation is never written over', () => {
  it('manual refuses to create; automatic export sends the job to "Da rivedere" instead of retrying blindly', async () => {
    const w = await world();
    const s = await w.save();
    const conflict = new ProviderError('conflict', 'Su Google c’è già un evento di questa esportazione, ma i suoi dati Serie non sono leggibili.');
    // An earlier attempt was uncertain in both engines.
    w.google.createSteps = [{ throw: new ProviderError('uncertain', 'Risposta persa'), persist: false }];
    w.google.findFailures = 1;
    const plan = await w.manual([s]);
    await executePlan({ plan, providers: w.providers, repos: w.repos });
    w.google.findError = conflict;
    const manual = await executePlan({ plan, providers: w.providers, repos: w.repos });
    expect(manual.destinations[0].rows[0]).toMatchObject({ result: 'failed', code: 'reconcile_failed', errorCode: 'conflict' });

    const w2 = await world();
    const s2 = await w2.save();
    const { jobs } = await enqueueForSessions(w2.repos, [s2], [w2.surf], w2.config());
    w2.google.createSteps = [{ throw: new ProviderError('uncertain', 'Risposta persa'), persist: false }];
    await runJobs({ repos: w2.repos, providers: w2.providers, now: NOW, config: w2.config() });
    w2.google.findError = conflict;
    await runJobs({ repos: w2.repos, providers: w2.providers, now: new Date(NOW.getTime() + 3_600_000), config: w2.config() });
    const j = (await w2.repos.exportJobs.list()).find((x) => x.id === jobs[0].id)!;
    expect(j).toMatchObject({ status: 'needs_review', reviewReason: conflict.message });
    expect(parsePayload(j.payload)).toMatchObject({ review: { code: 'op_unreadable', eventIds: [] }, reconcile: true });
    expect(w.google.count('createEvent') + w2.google.count('createEvent')).toBe(2); // only the two first attempts
  });
});

describe('links, accounts and locking are shared', () => {
  it('linking Serie\'s own older event records the timing it was written with, in both engines', async () => {
    const w = await world();
    const s = await w.save();
    // An event Serie wrote for this session when it was still "duration only" (other op id: e.g. an old account id).
    const old = mkSession({ id: s.id, date: s.date, timing: sessionWith(s.date, { state: 'duration_only', declaredSec: 3600 }).timing });
    const oldDraft = draftOf(old, { ...G_REF, accountId: 'old@gmail.com' });
    const own: ExternalEvent = { ...viaGoogle(oldDraft), eventId: 'g-own', calendarId: G_REF.calendarId };
    expect(linkedEventMeta(s, own)).toMatchObject({ timingState: 'duration_only', durationSec: 3600, durationSource: 'declared' });
    expect(linkedEventMeta(s, { appMeta: null })).toMatchObject({ timingState: 'interval', durationSec: 5400 });

    // Manual link.
    w.google.events = [own];
    let plan = await w.manual([s]);
    expect(plan.destinations[0].rows[0]).toMatchObject({ status: 'recognized' });
    plan = setRowChoice(plan, plan.destinations[0].key, s.id, { action: 'link', selected: true });
    await executePlan({ plan, providers: w.providers, repos: w.repos });
    const manualLink = await w.repos.exportLinks.byOp(exportOpId(s.id, G_REF));

    // Automatic link (review action) on a second world: same snapshot.
    const w2 = await world();
    const s2 = await w2.save();
    const own2: ExternalEvent = { ...own, appMeta: { ...own.appMeta!, sessionId: s2.id } };
    const { jobs } = await enqueueForSessions(w2.repos, [s2], [w2.surf], w2.config());
    await w2.repos.exportJobs.update(jobs[0].id, { status: 'needs_review' });
    await resolveReviewJob(w2.repos, jobs[0].id, { kind: 'link', event: own2 });
    const autoLink = await w2.repos.exportLinks.byOp(exportOpId(s2.id, G_REF));

    const timing = (l: typeof manualLink) => l && { timingState: l.snapshot.timingState, durationSec: l.snapshot.durationSec, durationSource: l.snapshot.durationSource, schedulingPlaceholder: l.snapshot.schedulingPlaceholder };
    expect(timing(manualLink)).toEqual({ timingState: 'duration_only', durationSec: 3600, durationSource: 'declared', schedulingPlaceholder: false });
    expect(timing(autoLink)).toEqual(timing(manualLink));
    expect({ ...autoLink!.snapshot }).toEqual({ ...manualLink!.snapshot });
  });

  it('account ids compare the same way everywhere', () => {
    expect(sameAccountId('google', 'Surfer@Gmail.com', 'surfer@gmail.com')).toBe(true);
    expect(sameAccountId('google', 's.urfer@googlemail.com', 'surfer@gmail.com')).toBe(true);
    expect(sameAccountId('google', 'other@gmail.com', 'surfer@gmail.com')).toBe(false);
    expect(sameAccountId('apple', 'SRC-1', 'src-1')).toBe(false);
    expect(sameAccountId('google', null, 'surfer@gmail.com')).toBe(false);
  });

  it('manual: a live account written differently is not a mismatch (same rule as automatic export)', async () => {
    const w = await world();
    const s = await w.save();
    w.google.conn = { ...G_CONN, accountId: 'Surfer@GMail.com' };
    const res = await executePlan({ plan: await w.manual([s]), providers: w.providers, repos: w.repos });
    expect(res.destinations[0].rows[0]).toMatchObject({ result: 'created' });
    w.google.conn = { ...G_CONN, accountId: 'someone.else@gmail.com' };
    const s2 = await w.save('2026-07-06');
    const res2 = await executePlan({ plan: await w.manual([s2]), providers: w.providers, repos: w.repos });
    expect(res2.destinations[0].rows[0]).toMatchObject({ result: 'failed', code: 'account_mismatch' });
  });

  it('manual and automatic runs on one database never interleave', async () => {
    const w = await world();
    const [a, b] = [await w.save('2026-07-04'), await w.save('2026-07-05')];
    await enqueueForSessions(w.repos, [b], [w.surf], w.config());
    let release!: () => void;
    w.google.createGate = new Promise<void>((r) => (release = r));
    const manual = executePlan({ plan: await w.manual([a]), providers: w.providers, repos: w.repos });
    while (w.google.count('createEvent') === 0) await new Promise((r) => setTimeout(r, 0));
    const mark = w.google.log.length;
    const auto = runJobs({ repos: w.repos, providers: w.providers, now: NOW, config: w.config() });
    for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
    expect(w.google.log.slice(mark)).toEqual([]); // the automatic run waits for the manual one
    w.google.createGate = null;
    release();
    await manual;
    const out = await auto;
    expect(out.outcomes.map((o) => o.status)).toEqual(['succeeded']);
    expect(w.google.events).toHaveLength(2);
  });

  it('withExportLock serialises per key and keeps going after a failure', async () => {
    const order: string[] = [];
    const key = {};
    const slow = withExportLock(key, async () => {
      await new Promise((r) => setTimeout(r, 5));
      order.push('first');
      throw new Error('boom');
    });
    const next = withExportLock(key, async () => {
      order.push('second');
      return 2;
    });
    const other = withExportLock({}, async () => {
      order.push('other key');
    });
    await expect(slow).rejects.toThrow('boom');
    await expect(next).resolves.toBe(2);
    await other;
    expect(order).toEqual(['other key', 'first', 'second']);
  });

  it('paddedWindow: padded, widened, malformed dates ignored', () => {
    expect(paddedWindow(['2026-07-04', '2026-07-09', 'bad' as LocalDate, null])).toEqual({ from: '2026-07-03', to: '2026-07-10' });
    expect(paddedWindow(['2026-07-04'], { from: '2026-06-01', to: '2026-07-02' })).toEqual({ from: '2026-06-01', to: '2026-07-05' });
    expect(paddedWindow([])).toBeNull();
  });
});
