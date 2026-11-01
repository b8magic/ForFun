import { buildTiming, type TimingInput } from '@/domain/timing';
import { zonedToEpoch } from '@/domain/zoned';
import { addDays } from '@/domain/dates';
import type { Session } from '@/domain/types';
import type { ExportLinkRecord } from '@/data/repositories';
import { mkSession } from '@/test/factories';
import type { EventDraft, ExternalEvent } from '../types';
import { buildEventDraft, snapshotFromDraft, type ExportOverride } from '../representation';
import { exportOpId } from '../opId';
import {
  DUPLICATE_REASONS,
  classifyDuplicates,
  normalizeTitle,
  stripAffixes,
  titleSimilarity,
  type DuplicateContext,
  type DuplicateProposal,
} from '../duplicates';

const TZ = 'Europe/Rome';
const REF = { provider: 'google' as const, accountId: 'marta@example.com', calendarId: 'cal-1' };

function session(id: string, date: string, input?: TimingInput, extra: Partial<Session> = {}): Session {
  const r = input ? buildTiming(date, input) : null;
  if (r && !r.ok) throw new Error(r.error);
  return mkSession({ id, date, ...(r ? { timing: r.timing } : {}), ...extra });
}

interface PropOpts {
  prefix?: string;
  suffix?: string;
  startOnlySpanMin?: number | null;
  override?: ExportOverride;
}

function proposal(s: Session, o: PropOpts = {}): DuplicateProposal {
  const res = buildEventDraft(s, {
    categoryName: 'Surf',
    opId: exportOpId(s.id, REF),
    prefix: o.prefix ?? '',
    suffix: o.suffix ?? '',
    includeNotes: true,
    includeLocation: true,
    startOnlySpanMin: o.startOnlySpanMin ?? null,
    override: o.override ?? null,
  });
  return { session: s, opId: exportOpId(s.id, REF), draft: res.draft, finalTitle: res.title.final, baseTitle: res.title.base, date: res.representation.outgoingDate };
}

const iso = (date: string, time: string, tz = TZ) => new Date(zonedToEpoch(date, time, tz).epochMs).toISOString();

function eventFromDraft(d: EventDraft, eventId: string, patch: Partial<ExternalEvent> = {}): ExternalEvent {
  const time = (p: EventDraft['start']) => ({ date: p.date, time: p.time, timeZone: p.timeZone, instant: d.allDay ? null : iso(p.date, p.time!, p.timeZone!) });
  return {
    ...REF,
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
    colorId: d.colorId,
    appMeta: d.appMeta,
    updated: null,
    ...patch,
  };
}

function foreign(eventId: string, title: string, date: string, times?: { start: string; end: string; tz?: string }, patch: Partial<ExternalEvent> = {}): ExternalEvent {
  const tz = times?.tz ?? TZ;
  return {
    ...REF,
    eventId,
    recurringEventId: null,
    occurrenceKey: null,
    title,
    notes: null,
    location: null,
    allDay: !times,
    start: times ? { date, time: times.start, timeZone: tz, instant: iso(date, times.start, tz) } : { date, time: null, timeZone: null, instant: null },
    end: times ? { date, time: times.end, timeZone: tz, instant: iso(date, times.end, tz) } : { date: addDays(date, 1), time: null, timeZone: null, instant: null },
    status: 'confirmed',
    colorId: null,
    appMeta: null,
    updated: null,
    ...patch,
  };
}

let linkN = 0;
function linkFor(p: DuplicateProposal, ev: ExternalEvent, over: Partial<ExportLinkRecord> = {}): ExportLinkRecord {
  return {
    id: `link-${++linkN}`,
    sessionId: p.session.id,
    ...REF,
    externalEventId: ev.eventId,
    occurrenceKey: ev.occurrenceKey,
    status: 'created',
    opId: p.opId,
    snapshot: snapshotFromDraft(p.draft!, 'Surf'),
    exportedAt: '2026-07-01T10:00:00.000Z',
    ...over,
  };
}

const ctx = (c: Partial<DuplicateContext>): DuplicateContext => ({ categoryName: 'Surf', prefix: '', suffix: '', links: [], events: [], ...c });

describe('title normalisation', () => {
  it('ignores case, accents, emoji and punctuation', () => {
    expect(normalizeTitle('  🌊 SURF — Mattìna! ')).toBe('surf mattina');
    expect(normalizeTitle('Corsa · 10 km')).toBe('corsa 10 km');
  });
  it('scores containment and prefixes of words; unrelated titles stay low', () => {
    expect(titleSimilarity('Surf', '🌊 surf')).toBe(1);
    expect(titleSimilarity('Surf', 'Surf mattina con Luca')).toBe(0.85);
    expect(titleSimilarity('Surf', 'Surfing')).toBe(0.85);
    expect(titleSimilarity('Surf', 'Corsa')).toBeLessThan(0.7);
    expect(titleSimilarity('Surf', 'Dentista')).toBeLessThan(0.7);
    expect(stripAffixes('🏄 Surf · Lido', '🏄 ', ' · Lido')).toBe('Surf');
  });
});

describe('recognized links', () => {
  it('already exported: stored link, event present and unchanged on both sides', () => {
    const s = session('a', '2026-07-04', { state: 'interval', start: '07:00', end: '08:30', endDayOffset: 0, timeZone: TZ });
    const p = proposal(s);
    const ev = eventFromDraft(p.draft!, 'e1');
    const [r] = classifyDuplicates([p], ctx({ links: [linkFor(p, ev)], events: [ev] }));
    expect(r).toMatchObject({ class: 'already_exported', reason: 'Già esportato', checked: true, recognizedBy: 'link', changes: { session: [], external: [] } });
    expect(r.event?.eventId).toBe('e1');
  });

  it('linked changed: the session changed since the export (draft vs snapshot)', () => {
    const s0 = session('a', '2026-07-04', undefined, { notes: 'prima' });
    const p0 = proposal(s0);
    const ev = eventFromDraft(p0.draft!, 'e1');
    const link = linkFor(p0, ev);
    const p1 = proposal({ ...s0, notes: 'dopo' });
    const [r] = classifyDuplicates([p1], ctx({ links: [link], events: [ev] }));
    expect(r).toMatchObject({ class: 'linked_changed', reason: 'Evento collegato modificato', detail: DUPLICATE_REASONS.changedSession, changes: { session: ['notes'], external: [] } });
    expect(r.differences).toEqual(['notes']);
  });

  it('linked changed: the external event was edited in the calendar', () => {
    const s = session('a', '2026-07-04', { state: 'start_only', start: '07:00', timeZone: TZ });
    const p = proposal(s, { startOnlySpanMin: 60 });
    const ev = eventFromDraft(p.draft!, 'e1');
    const link = linkFor(p, ev);
    const edited = { ...ev, title: 'Surf con Luca', start: { ...ev.start, time: '07:30', instant: iso('2026-07-04', '07:30') } };
    const [r] = classifyDuplicates([p], ctx({ links: [link], events: [edited] }));
    expect(r.class).toBe('linked_changed');
    expect(r.changes).toEqual({ session: [], external: ['title', 'time'] });
    expect(r.detail).toBe(DUPLICATE_REASONS.changedExternal);
  });

  it('a timing provenance change is a session-side change even when the outgoing text is equal', () => {
    const s0 = session('a', '2026-07-04');
    const p0 = proposal(s0);
    const ev = eventFromDraft(p0.draft!, 'e1');
    const link = linkFor(p0, ev, { status: 'linked', snapshot: { ...snapshotFromDraft(p0.draft!, 'Surf') } });
    const s1 = session('a', '2026-07-04', { state: 'start_only', start: '07:00', timeZone: TZ });
    const [r] = classifyDuplicates([proposal(s1)], ctx({ links: [link], events: [ev] }));
    expect(r.class).toBe('linked_changed');
    expect(r.changes?.session).toEqual(['timing']);
  });

  it('stale link: the linked event is gone → treated as not exported, reason flagged', () => {
    const s = session('a', '2026-07-04');
    const p = proposal(s);
    const ev = eventFromDraft(p.draft!, 'e-deleted');
    const [r] = classifyDuplicates([p], ctx({ links: [linkFor(p, ev)], events: [] }));
    expect(r).toMatchObject({ class: 'new', reason: DUPLICATE_REASONS.staleLink, link: null });
    expect(r.staleLink?.externalEventId).toBe('e-deleted');
    // A cancelled event counts as gone too.
    const [c] = classifyDuplicates([p], ctx({ links: [linkFor(p, ev)], events: [{ ...ev, status: 'cancelled' }] }));
    expect(c.class).toBe('new');
  });
});

describe('recognized by app metadata or import provenance', () => {
  it('finds Serie’s own event for the op id even without a stored link', () => {
    const s = session('a', '2026-07-04');
    const p = proposal(s);
    const ev = eventFromDraft(p.draft!, 'e1');
    const [r] = classifyDuplicates([p], ctx({ events: [ev] }));
    expect(r).toMatchObject({ class: 'recognized', recognizedBy: 'op_id', reason: 'Già esportato' });
  });

  it('finds an event written for the same session through another op id', () => {
    const s = session('a', '2026-07-04');
    const p = proposal(s);
    const ev = eventFromDraft(p.draft!, 'e1', { appMeta: { ...p.draft!.appMeta, opId: 'op1_a_ffffffffffff' } });
    const [r] = classifyDuplicates([p], ctx({ events: [ev] }));
    expect(r).toMatchObject({ class: 'recognized', recognizedBy: 'session_id' });
  });

  it('never proposes an imported session back into its source event', () => {
    const s = session('a', '2026-07-04', undefined, { origin: 'import' });
    const src = foreign('src-1', 'Lezione di surf a Ostia', '2026-07-04', { start: '09:00', end: '11:00' });
    const [r] = classifyDuplicates([proposal(s)], ctx({ events: [src], importSources: [{ sessionId: 'a', externalEventId: 'src-1', occurrenceKey: null }] }));
    expect(r).toMatchObject({ class: 'recognized', recognizedBy: 'import_source', detail: DUPLICATE_REASONS.recognizedImportSource });
  });
});

describe('possible duplicates (heuristic)', () => {
  it('same day + similar title + compatible start → possible duplicate with evidence', () => {
    const s = session('a', '2026-07-04', { state: 'interval', start: '07:00', end: '08:30', endDayOffset: 0, timeZone: TZ }, { place: { label: 'Lido di Ostia', address: null, mapUrl: null, coords: null, resolution: 'none', resolutionNote: null } });
    const ev = foreign('f1', '🌊 surf!', '2026-07-04', { start: '07:15', end: '08:45' }, { location: 'Lido di Ostia, Roma' });
    const [r] = classifyDuplicates([proposal(s)], ctx({ events: [ev] }));
    expect(r.class).toBe('possible_duplicate');
    expect(r.reason).toBe('Possibile doppione: stesso giorno e titolo simile');
    expect(r.candidates[0].evidence).toEqual(expect.arrayContaining(['same_date', 'title_exact', 'start_close', 'duration_close', 'location_match']));
  });

  it('accounts for prefix/suffix rules and earlier snapshot titles', () => {
    const s = session('a', '2026-07-04');
    const withAffixes = classifyDuplicates([proposal(s, { prefix: '🏄 ', suffix: ' · Lido' })], ctx({ prefix: '🏄 ', suffix: ' · Lido', events: [foreign('f1', '🏄 Surf · Lido', '2026-07-04')] }));
    expect(withAffixes[0].class).toBe('possible_duplicate');
    // An event carrying the batch prefix of a DIFFERENT activity is not similar just because the prefix matches.
    const otherActivity = classifyDuplicates([proposal(s, { prefix: 'Allenamento serie A – ' })], ctx({ prefix: 'Allenamento serie A – ', events: [foreign('f2', 'Allenamento serie A – Corsa', '2026-07-04')] }));
    expect(otherActivity[0].class).toBe('new');
    // A title used by an earlier export of this session (snapshot) counts as known.
    const p = proposal(s);
    const prior: ExportLinkRecord = { ...linkFor(p, foreign('x', 'x', '2026-07-04')), calendarId: 'other-cal', snapshot: { ...snapshotFromDraft(p.draft!, 'Surf'), title: 'Uscita in tavola' } };
    const [r] = classifyDuplicates([p], ctx({ priorLinks: [prior], events: [foreign('f3', 'Uscita in tavola', '2026-07-04')] }));
    expect(r.class).toBe('possible_duplicate');
    expect(r.candidates[0].evidence).toContain('title_exact');
  });

  it('never flags by date alone', () => {
    const s = session('a', '2026-07-04', { state: 'interval', start: '07:00', end: '08:00', endDayOffset: 0, timeZone: TZ });
    const [r] = classifyDuplicates([proposal(s)], ctx({ events: [foreign('f1', 'Dentista', '2026-07-04', { start: '07:00', end: '08:00' }), foreign('f2', 'Compleanno di Anna', '2026-07-04')] }));
    expect(r.class).toBe('new');
    expect(r.reason).toBeNull();
  });

  it('two legitimate same-day sessions are not flagged against each other when their times clearly differ', () => {
    const morning = session('m', '2026-07-04', { state: 'interval', start: '07:00', end: '08:30', endDayOffset: 0, timeZone: TZ });
    const evening = session('e', '2026-07-04', { state: 'interval', start: '18:00', end: '19:30', endDayOffset: 0, timeZone: TZ });
    // A manual "Surf" event in the morning only matches the morning session.
    const manual = foreign('f1', 'Surf', '2026-07-04', { start: '07:10', end: '08:40' });
    const [m, e] = classifyDuplicates([proposal(morning), proposal(evening)], ctx({ events: [manual] }));
    expect(m.class).toBe('possible_duplicate');
    expect(e.class).toBe('new');

    // Once the morning session is exported (linked, or carrying its metadata), the evening one is not matched to it.
    const pm = proposal(morning), pe = proposal(evening);
    const morningEv = eventFromDraft(pm.draft!, 'e-m');
    const linked = classifyDuplicates([pe], ctx({ links: [linkFor(pm, morningEv)], events: [morningEv] }));
    expect(linked[0].class).toBe('new');
    // Same-day date-only sessions with identical titles in one batch: Serie's event of one is never the other's duplicate.
    const d1 = session('d1', '2026-07-05'), d2 = session('d2', '2026-07-05');
    const p1 = proposal(d1), p2 = proposal(d2);
    const ev1 = eventFromDraft(p1.draft!, 'e-d1');
    const both = classifyDuplicates([p1, p2], ctx({ events: [ev1] }));
    expect(both.map((x) => x.class)).toEqual(['recognized', 'new']);
  });

  it('an event linked to a deleted session becomes an ordinary event for heuristics', () => {
    const old = session('gone', '2026-07-04');
    const pOld = proposal(old);
    const oldEv = eventFromDraft(pOld.draft!, 'e-old');
    const link = { ...linkFor(pOld, oldEv), sessionId: null };
    const fresh = session('new', '2026-07-04');
    const [r] = classifyDuplicates([proposal(fresh)], ctx({ links: [link], events: [oldEv] }));
    expect(r.class).toBe('possible_duplicate');
  });

  it('all-day vs timed is never certain: flagged as possible, never recognized', () => {
    const dateOnly = session('a', '2026-07-04');
    const [r] = classifyDuplicates([proposal(dateOnly)], ctx({ events: [foreign('f1', 'Surf', '2026-07-04', { start: '09:00', end: '10:00' })] }));
    expect(r.class).toBe('possible_duplicate');
    expect(r.candidates[0].evidence).toContain('all_day_vs_timed');
    const timed = session('b', '2026-07-04', { state: 'interval', start: '09:00', end: '10:00', endDayOffset: 0, timeZone: TZ });
    const [t2] = classifyDuplicates([proposal(timed)], ctx({ events: [foreign('f2', 'Surf', '2026-07-04')] }));
    expect(t2.class).toBe('possible_duplicate');
    expect(t2.candidates[0].evidence).toContain('all_day_vs_timed');
  });

  it('unknown duration is neutral evidence; a known, very different duration is a mismatch; spans are not durations', () => {
    const ev = foreign('f1', 'Surf', '2026-07-04', { start: '07:00', end: '10:00' });
    // Start-only with a 30-min scheduling span: the span is not a duration, so the 3 h event is still a possible match.
    const startOnly = session('a', '2026-07-04', { state: 'start_only', start: '07:00', timeZone: TZ });
    const [r1] = classifyDuplicates([proposal(startOnly, { startOnlySpanMin: 30 })], ctx({ events: [ev] }));
    expect(r1.class).toBe('possible_duplicate');
    expect(r1.candidates[0].evidence).toContain('duration_unknown');
    // A recorded 1 h interval vs the 3 h event starting at the same time: durations clearly differ.
    const oneHour = session('b', '2026-07-04', { state: 'interval', start: '07:00', end: '08:00', endDayOffset: 0, timeZone: TZ });
    expect(classifyDuplicates([proposal(oneHour)], ctx({ events: [ev] }))[0].class).toBe('new');
    // Overlapping intervals with a later start (45 min) are still compatible.
    const overlap = session('c', '2026-07-04', { state: 'interval', start: '07:45', end: '10:15', endDayOffset: 0, timeZone: TZ });
    const [r3] = classifyDuplicates([proposal(overlap)], ctx({ events: [ev] }));
    expect(r3.class).toBe('possible_duplicate');
    expect(r3.candidates[0].evidence).toContain('overlap');
  });

  it('uses the pending session’s recorded start when no draft exists', () => {
    const s = session('a', '2026-07-04', { state: 'start_only', start: '07:00', timeZone: TZ });
    const p = proposal(s);
    expect(p.draft).toBeNull();
    const [near] = classifyDuplicates([p], ctx({ events: [foreign('f1', 'Surf', '2026-07-04', { start: '07:20', end: '08:00' })] }));
    expect(near.class).toBe('possible_duplicate');
    const [far] = classifyDuplicates([p], ctx({ events: [foreign('f2', 'Surf', '2026-07-04', { start: '17:00', end: '18:00' })] }));
    expect(far.class).toBe('new');
  });
});

describe('not checked', () => {
  it('reports not_checked when events could not be read — never as checked', () => {
    const s = session('a', '2026-07-04');
    const p = proposal(s);
    const [r] = classifyDuplicates([p], ctx({ events: null }));
    expect(r).toMatchObject({ class: 'not_checked', checked: false, reason: 'Non verificato: accesso al calendario non disponibile', detail: null, link: null });
    const ev = eventFromDraft(p.draft!, 'e1');
    const [linked] = classifyDuplicates([p], ctx({ events: null, links: [linkFor(p, ev)] }));
    expect(linked).toMatchObject({ class: 'not_checked', checked: false, detail: DUPLICATE_REASONS.notCheckedLinked });
    expect(linked.link?.externalEventId).toBe('e1');
  });
});

describe('regressions', () => {
  it('symbol-only titles: identical emoji titles still match, different ones do not', () => {
    expect(normalizeTitle('🏄️')).toBe('🏄');
    expect(titleSimilarity('🏄', '🏄️')).toBe(1);
    expect(titleSimilarity('🏄', '🌊')).toBeLessThan(0.7);
    const s = session('a', '2026-07-04');
    const res = buildEventDraft(s, { categoryName: '🏄', opId: exportOpId(s.id, REF), prefix: '', suffix: '', includeNotes: true, includeLocation: true });
    const p: DuplicateProposal = { session: s, opId: exportOpId(s.id, REF), draft: res.draft, finalTitle: res.title.final, baseTitle: res.title.base, date: res.representation.outgoingDate };
    const [same] = classifyDuplicates([p], ctx({ categoryName: '🏄', events: [foreign('f1', '🏄', '2026-07-04')] }));
    expect(same.class).toBe('possible_duplicate');
    const [other] = classifyDuplicates([p], ctx({ categoryName: '🏄', events: [foreign('f2', '🌊', '2026-07-04')] }));
    expect(other.class).toBe('new');
  });

  it('an imported session whose source event was not read is never "new" for its source calendar', () => {
    const s = session('a', '2026-07-04', undefined, { origin: 'import' });
    const [r] = classifyDuplicates([proposal(s)], ctx({ events: [], importSources: [{ sessionId: 'a', externalEventId: 'src-1', occurrenceKey: null }] }));
    expect(r).toMatchObject({ class: 'recognized', recognizedBy: 'import_source', event: null, checked: true, reason: DUPLICATE_REASONS.importedHere, detail: DUPLICATE_REASONS.importSourceMissing });
    // A similar event that IS there is still offered as a possible duplicate (more useful than "missing").
    const [near] = classifyDuplicates([proposal(s)], ctx({ events: [foreign('f1', 'Surf', '2026-07-04')], importSources: [{ sessionId: 'a', externalEventId: 'src-1', occurrenceKey: null }] }));
    expect(near.class).toBe('possible_duplicate');
  });

  it('recurring occurrences: a link to one occurrence never resolves to another occurrence of the series', () => {
    const a = session('a', '2026-07-04', { state: 'interval', start: '07:00', end: '08:00', endDayOffset: 0, timeZone: TZ });
    const b = session('b', '2026-07-11', { state: 'interval', start: '07:00', end: '08:00', endDayOffset: 0, timeZone: TZ });
    const occ = (date: string) => foreign('series-1', 'Surf club', date, { start: '07:00', end: '08:00' }, { recurringEventId: 'series-1', occurrenceKey: `${date}T05:00:00Z` });
    const pa = proposal(a), pb = proposal(b);
    const link = linkFor(pa, occ('2026-07-04'), { status: 'linked', snapshot: { ...snapshotFromDraft(pa.draft!, 'Surf'), title: 'Surf club', notes: null } });
    // Only the 11 July occurrence is left (the 4 July one was cancelled/removed): the link is stale for A…
    const [ra, rb] = classifyDuplicates([pa, pb], ctx({ links: [link], events: [occ('2026-07-11')] }));
    expect(ra.class).not.toBe('already_exported');
    expect(ra.staleLink?.occurrenceKey).toBe('2026-07-04T05:00:00Z');
    // …and B is free to match its own occurrence (not claimed by A's link to another occurrence).
    expect(rb.class).toBe('possible_duplicate');
    expect(rb.candidates[0].event.occurrenceKey).toBe('2026-07-11T05:00:00Z');
    // With both occurrences present, A's link resolves to exactly its occurrence.
    const [both] = classifyDuplicates([pa], ctx({ links: [link], events: [occ('2026-07-11'), occ('2026-07-04')] }));
    expect(both.event?.occurrenceKey).toBe('2026-07-04T05:00:00Z');
  });

  it('a re-linked event written by Serie is compared fully: later session drift is reported', () => {
    const s0 = session('a', '2026-07-04', { state: 'start_only', start: '07:00', timeZone: TZ });
    const p0 = proposal(s0, { startOnlySpanMin: 60 });
    const ev = eventFromDraft(p0.draft!, 'e1');
    // Linked (not created) record whose snapshot carries the event's own provenance.
    const link = linkFor(p0, ev, { status: 'linked' });
    expect(classifyDuplicates([p0], ctx({ links: [link], events: [ev] }))[0].class).toBe('already_exported');
    // Same timing, new title rule: the outgoing content differs from what Serie wrote.
    const [retitled] = classifyDuplicates([proposal(s0, { startOnlySpanMin: 60, prefix: '🌊 ' })], ctx({ prefix: '🌊 ', links: [link], events: [ev] }));
    expect(retitled).toMatchObject({ class: 'linked_changed', changes: { session: ['title'], external: [] } });
    // The session now has a real interval: the calendar event (placeholder span) no longer matches.
    const s1 = session('a', '2026-07-04', { state: 'interval', start: '07:00', end: '09:00', endDayOffset: 0, timeZone: TZ });
    const [r] = classifyDuplicates([proposal(s1)], ctx({ links: [link], events: [ev] }));
    expect(r.class).toBe('linked_changed');
    expect(r.changes?.session).toEqual(expect.arrayContaining(['time', 'timing']));
  });
});
