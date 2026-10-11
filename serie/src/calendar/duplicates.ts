/**
 * Duplicate detection for export, per destination calendar.
 *
 * Classes, checked in this order:
 *  - not_checked        the destination's events could not be read (write-only
 *                       access, denied, offline…). Never reported as checked.
 *  - already_exported   a stored link for this destination points to an event
 *                       that still exists and neither side changed since.
 *  - linked_changed     linked event exists but the session (draft vs stored
 *                       snapshot) or the external event (vs snapshot) changed.
 *  - recognized         no usable link, but the destination holds an event that
 *                       Serie wrote for this session (appMeta.opId/sessionId), or
 *                       the very event the session was imported from.
 *  - possible_duplicate heuristic: same local date AND similar normalized title
 *                       (accounting for prefix/suffix, final/base/activity titles
 *                       and earlier snapshot titles) AND compatible times.
 *                       Never by date alone; unknown duration is neutral; all-day
 *                       vs timed is never certain; two same-day sessions whose
 *                       start times clearly differ are not flagged.
 *  - new                nothing found. A stored link whose event no longer
 *                       exists is reported as `staleLink` and treated as not
 *                       exported (heuristics still run).
 *
 * Pure: no React, no Expo. Nothing is merged, overwritten or deleted here.
 */
import type { EventDraft, ExternalEvent } from './types';
import type { ExportSnapshot, LocalDate, Session } from '@/domain/types';
import type { ExportLinkRecord } from '@/data/repositories';
import { epochToZoned, isValidTimeZone, isWallTime, zonedToEpoch } from '@/domain/zoned';
import { t } from '@/i18n/it';
import { snapshotFromDraft, snapshotFromEvent } from './representation';

// ─── strings (Italian) ───────────────────────────────────────────────────────

export const DUPLICATE_REASONS = {
  alreadyExported: t.exportStatusAlready, // "Già esportato"
  linkedChanged: t.exportStatusLinkedChanged, // "Evento collegato modificato"
  possibleDuplicate: t.exportStatusPossibleDuplicate, // "Possibile doppione: stesso giorno e titolo simile"
  notChecked: t.exportStatusNotChecked, // "Non verificato: accesso al calendario non disponibile"
  staleLink: 'Evento collegato non trovato nel calendario: considerato non esportato.',
  recognizedOwn: 'Evento creato da Serie per questa sessione.',
  recognizedImportSource: 'È l’evento da cui la sessione è stata importata.',
  alreadyInCalendar: 'Già presente in questo calendario',
  changedSession: 'La proposta è diversa dall’evento esportato: è cambiata la sessione o un’impostazione di esportazione.',
  changedExternal: 'L’evento nel calendario è stato modificato.',
  changedBoth: 'Sono cambiati sia la proposta sia l’evento nel calendario.',
  notCheckedLinked: 'Risulta già esportato, ma il calendario non è leggibile.',
  notCheckedImported: 'Sessione importata da questo calendario.',
} as const;

// ─── types ───────────────────────────────────────────────────────────────────

export type DuplicateClass = 'new' | 'already_exported' | 'linked_changed' | 'recognized' | 'possible_duplicate' | 'not_checked';

export type ChangeField = 'title' | 'notes' | 'location' | 'time' | 'timing';

export type Evidence =
  | 'same_date'
  | 'title_exact'
  | 'title_similar'
  | 'start_close'
  | 'overlap'
  | 'duration_close'
  | 'duration_unknown'
  | 'both_all_day'
  | 'all_day_vs_timed'
  | 'location_match'
  | 'notes_match';

export interface DuplicateCandidate {
  event: ExternalEvent;
  /** Ordering score only (title similarity + supporting evidence). Never a certainty. */
  score: number;
  titleScore: number;
  evidence: Evidence[];
}

export interface DuplicateCheck {
  class: DuplicateClass;
  /** Short Italian status reason (null for 'new' without a stale link). */
  reason: string | null;
  /** Optional Italian detail line. */
  detail: string | null;
  /** True only when the destination's events were actually read. */
  checked: boolean;
  /** Active link for this session in this destination (event found, or unverifiable when not checked). */
  link: ExportLinkRecord | null;
  /** Stored link whose event no longer exists (treated as not exported). */
  staleLink: ExportLinkRecord | null;
  /** Linked or recognized event. */
  event: ExternalEvent | null;
  recognizedBy: 'link' | 'op_id' | 'session_id' | 'import_source' | null;
  /** linked_changed: which side changed and which fields. */
  changes: { session: ChangeField[]; external: ChangeField[] } | null;
  /** Proposed draft vs the existing linked/recognized event, for "inspect existing vs proposed". */
  differences: ChangeField[];
  /** possible_duplicate: candidates, best first. */
  candidates: DuplicateCandidate[];
}

export interface DuplicateProposal {
  session: Session;
  opId: string;
  /** Outgoing draft; null when the representation is pending/invalid. */
  draft: EventDraft | null;
  finalTitle: string;
  baseTitle: string;
  /** Intended outgoing date (override date or session date). */
  date: LocalDate;
}

export interface ImportSource {
  sessionId: string;
  externalEventId: string;
  occurrenceKey: string | null;
}

export interface DuplicateContext {
  categoryName: string;
  prefix: string;
  suffix: string;
  /** Links stored for THIS destination (any session). */
  links: readonly ExportLinkRecord[];
  /** Earlier links of the proposed sessions in any destination (their snapshot titles count as known titles). */
  priorLinks?: readonly ExportLinkRecord[];
  /** Import provenance of sessions imported from THIS destination calendar. */
  importSources?: readonly ImportSource[];
  /** Events read from the destination for the window; null = could not read. */
  events: readonly ExternalEvent[] | null;
}

// ─── title normalisation & similarity ────────────────────────────────────────

function isSeparator(cp: number): boolean {
  if (cp < 0x80) return !((cp >= 0x30 && cp <= 0x39) || (cp >= 0x61 && cp <= 0x7a));
  if (cp <= 0xbf) return true; // Latin-1 punctuation & symbols (· « » ° …)
  if (cp === 0xd7 || cp === 0xf7) return true; // × ÷
  if (cp >= 0x2000 && cp <= 0x2bff) return true; // general punctuation, symbols, arrows, dingbats
  if (cp >= 0x3000 && cp <= 0x303f) return true; // CJK punctuation
  if (cp >= 0xfe00 && cp <= 0xfe0f) return true; // variation selectors
  if (cp >= 0x1f000) return true; // emoji & pictographs
  return false;
}

/** Lowercase, strip accents, emoji and punctuation, collapse spaces. */
export function normalizeTitle(s: string | null | undefined): string {
  if (!s) return '';
  const base = s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let out = '';
  for (const ch of base) out += isSeparator(ch.codePointAt(0)!) ? ' ' : ch;
  return out.replace(/\s+/g, ' ').trim();
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

function dice(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const A = bigrams(a), B = bigrams(b);
  let inter = 0;
  for (const [g, n] of A) inter += Math.min(n, B.get(g) ?? 0);
  return (2 * inter) / (a.length - 1 + (b.length - 1));
}

const tokenCovers = (w: string, v: string) => v === w || (w.length >= 4 && v.startsWith(w)) || (v.length >= 4 && w.startsWith(v));

/**
 * Similarity of two titles in [0, 1]: 1 when equal after normalisation, 0.85
 * when every word of the shorter title appears in the longer one ("Surf" vs
 * "Surf mattina", "surf" vs "surfing"), otherwise the bigram Dice coefficient.
 */
export function titleSimilarity(a: string, b: string): number {
  const x = normalizeTitle(a), y = normalizeTitle(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const tx = x.split(' '), ty = y.split(' ');
  const [short, long] = tx.length <= ty.length ? [tx, ty] : [ty, tx];
  if (short.every((w) => long.some((v) => tokenCovers(w, v)))) return 0.85;
  return dice(x.replace(/ /g, ''), y.replace(/ /g, ''));
}

export const TITLE_SIMILAR = 0.7;

/** Strip the batch prefix/suffix from a title when present (verbatim match). */
export function stripAffixes(title: string, prefix: string, suffix: string): string {
  let s = title;
  if (prefix && s.startsWith(prefix)) s = s.slice(prefix.length);
  if (suffix && s.endsWith(suffix) && s.length >= suffix.length) s = s.slice(0, s.length - suffix.length);
  return s;
}

// ─── change detection ────────────────────────────────────────────────────────

const normText = (s: string | null | undefined): string => (s ?? '').replace(/\r\n?/g, '\n').trim();

function sameTimeValue(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length === 10 || b.length === 10) return false;
  const x = Date.parse(a), y = Date.parse(b);
  return Number.isFinite(x) && Number.isFinite(y) && x === y;
}

/** Field-level differences between two snapshots. `timing` also compares the recorded-timing provenance. */
export function diffSnapshots(a: ExportSnapshot, b: ExportSnapshot, opts: { timing: boolean }): ChangeField[] {
  const out: ChangeField[] = [];
  if (normText(a.title) !== normText(b.title)) out.push('title');
  if (normText(a.notes) !== normText(b.notes)) out.push('notes');
  if (normText(a.location) !== normText(b.location)) out.push('location');
  if (a.allDay !== b.allDay || !sameTimeValue(a.start, b.start) || !sameTimeValue(a.end, b.end)) out.push('time');
  if (opts.timing && provenanceDiffers(a, b)) out.push('timing');
  return out;
}

function provenanceDiffers(a: Pick<ExportSnapshot, 'timingState' | 'durationSec' | 'durationSource'>, b: Pick<ExportSnapshot, 'timingState' | 'durationSec' | 'durationSource'>): boolean {
  return a.timingState !== b.timingState || (a.durationSec ?? null) !== (b.durationSec ?? null) || (a.durationSource ?? null) !== (b.durationSource ?? null);
}

const knownSec = (s: Session): number | null => (s.timing.durationSec != null && s.timing.durationSec > 0 ? s.timing.durationSec : null);

const sessionProvenance = (s: Session) => ({
  timingState: s.timing.state,
  durationSec: knownSec(s),
  durationSource: knownSec(s) != null ? s.timing.durationSource : null,
});

function linkChanges(link: ExportLinkRecord, ev: ExternalEvent, p: DuplicateProposal, categoryName: string): { session: ChangeField[]; external: ChangeField[] } {
  const snap = link.snapshot;
  const external = diffSnapshots(snap, snapshotFromEvent(ev, snap, categoryName), { timing: false });
  let session: ChangeField[];
  if (link.status === 'linked') {
    // A linked event was never written by Serie: only the recorded timing can drift on the session side.
    session = provenanceDiffers(snap, sessionProvenance(p.session)) ? ['timing'] : [];
  } else if (p.draft) {
    session = diffSnapshots(snap, snapshotFromDraft(p.draft, categoryName), { timing: true });
  } else {
    session = provenanceDiffers(snap, sessionProvenance(p.session)) ? ['timing'] : [];
  }
  return { session, external };
}

// ─── heuristic intent ────────────────────────────────────────────────────────

interface Intent {
  date: LocalDate;
  allDay: boolean;
  startMs: number | null;
  /** Real duration only (recorded/declared, or a foreign timed event's span). Never a placeholder. */
  durationSec: number | null;
  zone: string | null;
  location: string | null;
  notes: string | null;
}

function proposalIntent(p: DuplicateProposal): Intent {
  const tm = p.session.timing;
  if (p.draft) {
    const d = p.draft;
    const timed = !d.allDay && isWallTime(d.start.time) && isValidTimeZone(d.start.timeZone);
    return {
      date: d.start.date,
      allDay: !timed,
      startMs: timed ? zonedToEpoch(d.start.date, d.start.time as string, d.start.timeZone as string).epochMs : null,
      durationSec: knownSec(p.session),
      zone: timed ? d.start.timeZone : null,
      location: d.location,
      notes: p.session.notes,
    };
  }
  const timed = isWallTime(tm.start) && isValidTimeZone(tm.timeZone);
  return {
    date: p.date,
    allDay: !timed,
    startMs: timed ? zonedToEpoch(p.date, tm.start as string, tm.timeZone as string).epochMs : null,
    durationSec: knownSec(p.session),
    zone: timed ? tm.timeZone : null,
    location: null,
    notes: p.session.notes,
  };
}

function eventIntent(ev: ExternalEvent, zone: string | null): Intent {
  const startMs = !ev.allDay && ev.start.instant ? Date.parse(ev.start.instant) : null;
  const endMs = !ev.allDay && ev.end.instant ? Date.parse(ev.end.instant) : null;
  let durationSec: number | null = null;
  if (ev.appMeta) durationSec = ev.appMeta.durationSec ?? null; // Serie's own event: its true duration, never its span
  else if (startMs != null && endMs != null && endMs > startMs) durationSec = Math.round((endMs - startMs) / 1000);
  const date = startMs != null && Number.isFinite(startMs) && zone ? epochToZoned(startMs, zone).date : ev.start.date;
  return { date, allDay: ev.allDay || startMs == null || !Number.isFinite(startMs), startMs, durationSec, zone: ev.start.timeZone, location: ev.location, notes: ev.notes };
}

const START_TOLERANCE_MS = 30 * 60 * 1000;

function durationFar(a: number, b: number): boolean {
  return Math.abs(a - b) > Math.max(30 * 60, 0.5 * Math.max(a, b));
}

function timeEvidence(p: Intent, e: Intent): { compatible: boolean; evidence: Evidence[] } {
  const evidence: Evidence[] = [];
  const bothDur = p.durationSec != null && e.durationSec != null;
  if (bothDur && durationFar(p.durationSec!, e.durationSec!)) return { compatible: false, evidence };
  if (p.allDay && e.allDay) evidence.push('both_all_day');
  else if (p.allDay !== e.allDay) evidence.push('all_day_vs_timed');
  else {
    const delta = Math.abs((p.startMs as number) - (e.startMs as number));
    if (delta <= START_TOLERANCE_MS) evidence.push('start_close');
    else if (bothDur) {
      const a0 = p.startMs as number, a1 = a0 + p.durationSec! * 1000;
      const b0 = e.startMs as number, b1 = b0 + e.durationSec! * 1000;
      const overlap = Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
      if (overlap >= 0.5 * Math.min(a1 - a0, b1 - b0)) evidence.push('overlap');
      else return { compatible: false, evidence };
    } else return { compatible: false, evidence }; // start times clearly differ: separate sessions
  }
  evidence.push(bothDur ? 'duration_close' : 'duration_unknown');
  return { compatible: true, evidence };
}

function looseMatch(a: string | null, b: string | null): boolean {
  const x = normalizeTitle(a), y = normalizeTitle(b);
  if (x.length < 3 || y.length < 3) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function titleScore(p: DuplicateProposal, ev: ExternalEvent, ctx: DuplicateContext, priorTitles: string[]): number {
  const eventTitles = [ev.title, stripAffixes(ev.title, ctx.prefix, ctx.suffix)];
  // Exact matches of full titles (current final title, earlier snapshot titles).
  for (const full of [p.finalTitle, ...priorTitles]) if (normalizeTitle(full) && normalizeTitle(full) === normalizeTitle(ev.title)) return 1;
  // Base-level comparisons: prefix/suffix never inflate similarity.
  const bases = [p.baseTitle, ctx.categoryName, ...priorTitles.map((x) => stripAffixes(x, ctx.prefix, ctx.suffix))];
  let best = 0;
  for (const b of bases) for (const e of eventTitles) best = Math.max(best, titleSimilarity(b, e));
  return best;
}

// ─── classification ──────────────────────────────────────────────────────────

const evKey = (eventId: string, occurrenceKey: string | null | undefined) => `${eventId}\u0000${occurrenceKey ?? ''}`;

function findEvent(events: readonly ExternalEvent[], eventId: string, occurrenceKey: string | null): ExternalEvent | null {
  return (
    events.find((e) => e.eventId === eventId && (e.occurrenceKey ?? null) === (occurrenceKey ?? null)) ??
    (occurrenceKey ? null : events.find((e) => e.eventId === eventId && e.occurrenceKey == null)) ??
    null
  );
}

const base = (): Omit<DuplicateCheck, 'class' | 'reason'> => ({
  detail: null,
  checked: true,
  link: null,
  staleLink: null,
  event: null,
  recognizedBy: null,
  changes: null,
  differences: [],
  candidates: [],
});

function draftVsEvent(p: DuplicateProposal, ev: ExternalEvent, categoryName: string): ChangeField[] {
  if (!p.draft) return [];
  const d = snapshotFromDraft(p.draft, categoryName);
  return diffSnapshots(d, snapshotFromEvent(ev, d, categoryName), { timing: false });
}

/** Classify every proposal against the destination's links and events. Output order = input order. */
export function classifyDuplicates(proposals: readonly DuplicateProposal[], ctx: DuplicateContext): DuplicateCheck[] {
  const batchIds = new Set(proposals.map((p) => p.session.id));
  const live = ctx.events ? ctx.events.filter((e) => e.status !== 'cancelled') : null;

  // Events owned by a known session through a stored link.
  const claimedBy = new Map<string, string>();
  const linkedSessions = new Set<string>();
  for (const l of ctx.links) {
    if (!l.sessionId) continue; // the linked session was deleted: its event is an ordinary event now
    linkedSessions.add(l.sessionId);
    claimedBy.set(evKey(l.externalEventId, l.occurrenceKey), l.sessionId);
    if (l.occurrenceKey == null) claimedBy.set(evKey(l.externalEventId, null), l.sessionId);
  }
  const knownSessions = new Set([...batchIds, ...linkedSessions]);

  return proposals.map((p): DuplicateCheck => {
    const sid = p.session.id;
    const link = ctx.links.find((l) => l.opId === p.opId) ?? ctx.links.find((l) => l.sessionId === sid) ?? null;
    const importSource = ctx.importSources?.find((s) => s.sessionId === sid) ?? null;

    if (!live) {
      return {
        ...base(),
        class: 'not_checked',
        reason: DUPLICATE_REASONS.notChecked,
        detail: link ? DUPLICATE_REASONS.notCheckedLinked : importSource ? DUPLICATE_REASONS.notCheckedImported : null,
        checked: false,
        link,
        recognizedBy: link ? 'link' : importSource ? 'import_source' : null,
      };
    }

    let staleLink: ExportLinkRecord | null = null;
    if (link) {
      const ev = findEvent(live, link.externalEventId, link.occurrenceKey);
      if (ev) {
        const changes = linkChanges(link, ev, p, ctx.categoryName);
        const changed = changes.session.length > 0 || changes.external.length > 0;
        return {
          ...base(),
          class: changed ? 'linked_changed' : 'already_exported',
          reason: changed ? DUPLICATE_REASONS.linkedChanged : DUPLICATE_REASONS.alreadyExported,
          detail: !changed
            ? null
            : changes.session.length && changes.external.length
              ? DUPLICATE_REASONS.changedBoth
              : changes.session.length
                ? DUPLICATE_REASONS.changedSession
                : DUPLICATE_REASONS.changedExternal,
          link,
          event: ev,
          recognizedBy: 'link',
          changes,
          differences: draftVsEvent(p, ev, ctx.categoryName),
        };
      }
      staleLink = link;
    }

    // Serie's own event for this operation / session, without a usable link.
    const byOp = live.find((e) => e.appMeta?.opId === p.opId);
    const bySession = byOp ? null : live.find((e) => e.appMeta?.sessionId === sid && !(claimedBy.has(evKey(e.eventId, e.occurrenceKey)) && claimedBy.get(evKey(e.eventId, e.occurrenceKey)) !== sid));
    const own = byOp ?? bySession;
    if (own) {
      return {
        ...base(),
        class: 'recognized',
        reason: DUPLICATE_REASONS.alreadyExported,
        detail: DUPLICATE_REASONS.recognizedOwn,
        staleLink,
        event: own,
        recognizedBy: byOp ? 'op_id' : 'session_id',
        differences: draftVsEvent(p, own, ctx.categoryName),
      };
    }

    // The event this session was imported from: never duplicate it back into its source.
    if (importSource) {
      const src = findEvent(live, importSource.externalEventId, importSource.occurrenceKey);
      if (src) {
        return {
          ...base(),
          class: 'recognized',
          reason: DUPLICATE_REASONS.alreadyInCalendar,
          detail: DUPLICATE_REASONS.recognizedImportSource,
          staleLink,
          event: src,
          recognizedBy: 'import_source',
          differences: draftVsEvent(p, src, ctx.categoryName),
        };
      }
    }

    // Heuristic possible duplicates.
    const intent = proposalIntent(p);
    const priorTitles = (ctx.priorLinks ?? []).filter((l) => l.sessionId === sid).map((l) => l.snapshot.title);
    if (staleLink) priorTitles.push(staleLink.snapshot.title);
    const candidates: DuplicateCandidate[] = [];
    for (const ev of live) {
      const owner = claimedBy.get(evKey(ev.eventId, ev.occurrenceKey));
      if (owner && owner !== sid) continue; // linked to another session
      if (ev.appMeta && ev.appMeta.sessionId !== sid && knownSessions.has(ev.appMeta.sessionId)) continue; // another known session's export
      const ei = eventIntent(ev, intent.zone);
      if (ei.date !== intent.date) continue;
      const ts = titleScore(p, ev, ctx, priorTitles);
      if (ts < TITLE_SIMILAR) continue; // never by date alone
      const te = timeEvidence(intent, ei);
      if (!te.compatible) continue;
      const evidence: Evidence[] = ['same_date', ts >= 1 ? 'title_exact' : 'title_similar', ...te.evidence];
      if (looseMatch(intent.location, ei.location)) evidence.push('location_match');
      if (normText(intent.notes) && titleSimilarity(intent.notes ?? '', ei.notes ?? '') >= 0.85) evidence.push('notes_match');
      const bonus: Partial<Record<Evidence, number>> = {
        start_close: 0.3,
        overlap: 0.15,
        duration_close: 0.2,
        both_all_day: 0.1,
        all_day_vs_timed: -0.1,
        location_match: 0.1,
        notes_match: 0.05,
      };
      const score = evidence.reduce((s, e) => s + (bonus[e] ?? 0), ts);
      candidates.push({ event: ev, score, titleScore: ts, evidence });
    }
    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length) {
      return { ...base(), class: 'possible_duplicate', reason: DUPLICATE_REASONS.possibleDuplicate, detail: staleLink ? DUPLICATE_REASONS.staleLink : null, staleLink, candidates };
    }
    return { ...base(), class: 'new', reason: staleLink ? DUPLICATE_REASONS.staleLink : null, staleLink };
  });
}
