/**
 * Manual export engine: one activity per operation, one or two destinations.
 *
 *   loadDestinationEvents   read the REAL destination (window around the
 *                           sessions + linked / import-source events outside
 *                           it). Unreadable → null: every row 'not_checked'.
 *   buildExportPlan         pure: per destination, a review row per session
 *                           with title, draft (or pending representation),
 *                           duplicate class, status, Italian reason, default
 *                           action, allowed actions and selection. Destinations
 *                           are independent (settings, checks, results).
 *   setRowChoice / setSelection / mergeChoices
 *                           immutable review edits, preserved across rebuilds
 *                           while the row's situation is unchanged.
 *   executePlan             writes only the confirmed selection, per
 *                           destination, idempotently:
 *                             - link already stored for the op id → skipped;
 *                             - an earlier attempt left 'uncertain'/'running'
 *                               (or the link was stale) → findByOpId first and
 *                               link what is found instead of creating again;
 *                             - create → link with snapshot (true timing
 *                               provenance, placeholder flag, category name);
 *                             - 'link' stores a link, the event is untouched;
 *                             - 'update' only when explicitly chosen, only for
 *                               a linked event in a writable destination.
 *                           Failures are recorded per row (and as manual export
 *                           jobs) so re-running skips successes.
 *
 * Never adds attendees or reminders (EventDraft has no such fields; providers
 * write none), never deletes events, never touches the stored session.
 */
import { ProviderError, type CalendarProvider, type Connection, type EventDraft, type ExternalCalendar, type ExternalEvent } from './types';
import type { CalendarRef, Category, ExportJobStatus, LocalDate, ProviderKind, Session } from '@/domain/types';
import { DomainError, OPEN_JOB_STATUSES, type ExportJobRecord, type ExportLinkRecord, type ProvenanceRecord, type Repositories } from '@/data/repositories';
import { addDays, compareDates, isLocalDate } from '@/domain/dates';
import { t } from '@/i18n/it';
import { destinationKey, exportOpId } from './opId';
import type { ResolvedTitle } from './titles';
import { buildEventDraft, durationLabel, snapshotFromDraft, snapshotFromEvent, type ExportOverride, type TimeRepresentation } from './representation';
import { classifyDuplicates, type DuplicateCheck, type DuplicateProposal } from './duplicates';

// ─── strings (Italian) ───────────────────────────────────────────────────────

export const EXPORT_STRINGS = {
  ready: t.exportStatusReady,
  pending: t.exportStatusPending,
  notWritable: 'Calendario di sola lettura: scegli un calendario in cui si può scrivere.',
  labelUnsupported: 'I calendari di iPhone non hanno etichette colore: l’etichetta scelta non verrà applicata.',
  connectionUnavailable: 'Connessione al calendario non disponibile.',
  accountMismatch: 'L’account collegato non è quello scelto per questa destinazione.',
  noProvider: 'Integrazione non disponibile.',
  uncertain: t.jobUncertain,
  reconcileFailed: 'Esito precedente incerto e non verificabile ora: riprova più tardi.',
  noTarget: 'Nessun evento da collegare.',
  notAllowed: 'Azione non consentita per questa riga.',
  aborted: 'Interrotto.',
  storeFailed: 'Evento creato, ma non registrato in Serie: verrà verificato al prossimo tentativo.',
  alreadyExported: t.exportStatusAlready,
  linkedMissing: 'Evento collegato non trovato.',
} as const;

// ─── plan types ──────────────────────────────────────────────────────────────

export type ExportAction = 'create' | 'skip' | 'update' | 'link';

export type RowStatus =
  | 'ready'
  | 'already_exported'
  | 'linked_changed'
  | 'recognized'
  | 'possible_duplicate'
  | 'not_checked'
  | 'pending_representation'
  | 'invalid'
  | 'not_writable';

export interface ExportOptions {
  /** Batch prefix, verbatim (spacing preserved). */
  prefix: string;
  /** Batch suffix, verbatim. */
  suffix: string;
  includeNotes: boolean;
  includeLocation: boolean;
  /** User-approved export-only span for start-only sessions, or a configured visible preset; null = not approved. */
  startOnlySpanMin: number | null;
  /** Per-event outgoing overrides keyed by session id. */
  overrides: Readonly<Record<string, ExportOverride>>;
  /** Zone for outgoing times on sessions without one (defaults to the device zone). */
  defaultTimeZone?: string | null;
}

export interface ExportDestinationInput {
  ref: CalendarRef;
  calendar: ExternalCalendar;
  connection: Connection;
  labelId: string | null;
  /** Per-destination settings, merged over the batch options (overrides merge per session). */
  options?: Partial<ExportOptions>;
  /** Whether this route supports per-event labels. Default: Google yes, Apple no. */
  labelsSupported?: boolean;
}

export type DestinationEvents = Readonly<Record<string, readonly ExternalEvent[] | null | undefined>>;

export interface BuildPlanInput {
  sessions: readonly Session[];
  category: Pick<Category, 'id' | 'name'>;
  destinations: readonly ExportDestinationInput[];
  options: ExportOptions;
  /** Stored export links (any destination; filtered per destination here). */
  links: readonly ExportLinkRecord[];
  /** Events read from each destination keyed by `destinationKey(ref)`; missing or null = could not read. */
  destinationEvents: DestinationEvents;
  /** Import provenance of the sessions (so an imported session is never duplicated back into its source calendar). */
  provenance?: readonly ProvenanceRecord[];
}

export interface ExportPlanRow {
  /** `${destinationKey}|${sessionId}` */
  key: string;
  destinationKey: string;
  session: Session;
  opId: string;
  title: ResolvedTitle;
  /** Outgoing event, or null when the representation is pending/invalid. */
  draft: EventDraft | null;
  representation: TimeRepresentation;
  duplicate: DuplicateCheck;
  status: RowStatus;
  /** Italian status reason. */
  reason: string | null;
  /** Italian detail (which side changed, stale link, …). */
  detail: string | null;
  /** Recorded activity duration ("1 h 30 min" / "Durata non specificata"), separate from any calendar span. */
  durationLabel: string;
  defaultAction: ExportAction;
  allowedActions: ExportAction[];
  /** Current choice (starts as the default). */
  action: ExportAction;
  selected: boolean;
  /** Event to link when action = 'link' (recognized event or best candidate by default). */
  linkTargetEventId: string | null;
  linkTargetOccurrenceKey: string | null;
  /** True once the user changed selection/action (kept across rebuilds by `mergeChoices`). */
  touched: boolean;
}

export interface PlanDestination {
  key: string;
  ref: CalendarRef;
  calendar: ExternalCalendar;
  connection: Connection;
  labelId: string | null;
  /** Label actually written (null when the route has no labels). */
  colorId: string | null;
  /** Disclosure when a chosen label cannot be honoured. */
  labelNote: string | null;
  /** True only when the destination's events were read for the duplicate check. */
  checked: boolean;
  writable: boolean;
  options: ExportOptions;
  rows: ExportPlanRow[];
}

export interface ExportPlan {
  categoryId: string;
  categoryName: string;
  destinations: PlanDestination[];
}

// ─── reading the destination ─────────────────────────────────────────────────

/** Read access that allows a real duplicate check (write-only never qualifies). */
export function canCheckDestination(d: Pick<ExportDestinationInput, 'calendar' | 'connection'>): boolean {
  return d.connection.status === 'connected' && d.connection.canRead && d.calendar.canRead;
}

export function canWriteDestination(d: Pick<ExportDestinationInput, 'calendar' | 'connection'>): boolean {
  return (d.connection.status === 'connected' || d.connection.status === 'write_only') && d.connection.canWrite && d.calendar.canWrite;
}

/** Inclusive date window covering the outgoing dates, padded by one day on each side. */
export function exportWindow(sessions: readonly Session[], overrides: Readonly<Record<string, ExportOverride>> = {}): { from: LocalDate; to: LocalDate } | null {
  let from: LocalDate | null = null;
  let to: LocalDate | null = null;
  for (const s of sessions) {
    const d = overrides[s.id]?.date ?? s.date;
    for (const x of [s.date, d]) {
      if (!isLocalDate(x)) continue; // a malformed override is reported on its row, never breaks the read
      if (!from || compareDates(x, from) < 0) from = x;
      if (!to || compareDates(x, to) > 0) to = x;
    }
  }
  return from && to ? { from: addDays(from, -1), to: addDays(to, 1) } : null;
}

const sameDest = (l: Pick<ExportLinkRecord, 'provider' | 'accountId' | 'calendarId'>, ref: CalendarRef) =>
  l.provider === ref.provider && l.accountId === ref.accountId && l.calendarId === ref.calendarId;

export interface DestinationRead {
  events: ExternalEvent[] | null;
  /** Provider message when reading failed. */
  error: string | null;
}

export interface LoadEventsOptions {
  overrides?: Readonly<Record<string, ExportOverride>>;
  signal?: AbortSignal;
  /**
   * Import provenance of the sessions. Source events in this destination that
   * lie outside the window are fetched individually, so an imported session is
   * recognised against its source event instead of being re-created into it.
   */
  provenance?: readonly ProvenanceRecord[];
}

/**
 * Read the destination for duplicate checks: every event in the window (the
 * provider paginates/chunks completely), plus linked events (and import source
 * events) of these sessions that lie outside it (so they are not mistaken for
 * stale links / missing sources). Any read failure → `events: null` (not
 * checked), never a partial "checked" result.
 */
export async function loadDestinationEvents(
  provider: CalendarProvider,
  dest: Pick<ExportDestinationInput, 'ref' | 'calendar' | 'connection'>,
  sessions: readonly Session[],
  links: readonly ExportLinkRecord[],
  opts: LoadEventsOptions = {},
): Promise<DestinationRead> {
  if (!canCheckDestination(dest)) return { events: null, error: dest.connection.detail ?? null };
  const w = exportWindow(sessions, opts.overrides);
  if (!w) return { events: [], error: null };
  try {
    const listed = await provider.listEvents({ calendarIds: [dest.ref.calendarId], from: w.from, to: w.to, signal: opts.signal });
    const events = listed.filter((e) => e.status !== 'cancelled' && e.calendarId === dest.ref.calendarId);
    const ids = new Set(sessions.map((s) => s.id));
    const wanted: Array<{ eventId: string; occurrenceKey: string | null }> = [];
    for (const l of links) if (sameDest(l, dest.ref) && l.sessionId && ids.has(l.sessionId)) wanted.push({ eventId: l.externalEventId, occurrenceKey: l.occurrenceKey ?? null });
    for (const p of opts.provenance ?? []) if (sameDest(p, dest.ref) && p.sessionId && ids.has(p.sessionId)) wanted.push({ eventId: p.externalEventId, occurrenceKey: p.occurrenceKey ?? null });
    for (const w of wanted) {
      if (events.some((e) => e.eventId === w.eventId && (e.occurrenceKey ?? null) === w.occurrenceKey)) continue;
      const ev = await provider.getEvent(dest.ref.calendarId, w.eventId, w.occurrenceKey);
      if (ev && ev.status !== 'cancelled') events.push(ev);
    }
    return { events, error: null };
  } catch (e) {
    return { events: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export type ProviderLookup = Partial<Record<ProviderKind, CalendarProvider>> | ((ref: CalendarRef) => CalendarProvider | null | undefined);

function lookupProvider(p: ProviderLookup, ref: CalendarRef): CalendarProvider | null {
  return (typeof p === 'function' ? p(ref) : p[ref.provider]) ?? null;
}

/** Read every destination independently (one failing does not affect the other). */
export async function loadAllDestinationEvents(
  providers: ProviderLookup,
  destinations: readonly ExportDestinationInput[],
  sessions: readonly Session[],
  links: readonly ExportLinkRecord[],
  opts: LoadEventsOptions = {},
): Promise<Record<string, DestinationRead>> {
  const out: Record<string, DestinationRead> = {};
  for (const d of destinations) {
    const p = lookupProvider(providers, d.ref);
    out[destinationKey(d.ref)] = p ? await loadDestinationEvents(p, d, sessions, links, opts) : { events: null, error: EXPORT_STRINGS.noProvider };
  }
  return out;
}

/** Convenience: DestinationRead map → `destinationEvents` input. */
export const eventsOf = (reads: Record<string, DestinationRead>): DestinationEvents =>
  Object.fromEntries(Object.entries(reads).map(([k, v]) => [k, v.events]));

// ─── plan ────────────────────────────────────────────────────────────────────

interface Decision {
  status: RowStatus;
  reason: string | null;
  detail: string | null;
  defaultAction: ExportAction;
  allowedActions: ExportAction[];
  selected: boolean;
  linkTarget: ExternalEvent | null;
}

function decide(rep: TimeRepresentation, hasDraft: boolean, dup: DuplicateCheck, writable: boolean): Decision {
  const d = ((): Decision => {
    const mk = (status: RowStatus, defaultAction: ExportAction, allowedActions: ExportAction[], extra: Partial<Decision> = {}): Decision => ({
      status,
      reason: dup.reason,
      detail: dup.detail,
      defaultAction,
      allowedActions,
      selected: false,
      linkTarget: null,
      ...extra,
    });
    switch (dup.class) {
      case 'already_exported':
        return mk('already_exported', 'skip', ['skip']);
      case 'linked_changed':
        return mk('linked_changed', 'skip', hasDraft ? ['skip', 'update'] : ['skip']);
      case 'recognized': {
        // Imported from this calendar, source event not found: nothing to link; re-adding is deliberate only.
        if (!dup.event) return mk('recognized', 'skip', hasDraft ? ['skip', 'create'] : ['skip']);
        const sameOp = dup.recognizedBy === 'op_id';
        const allowed: ExportAction[] = sameOp || dup.recognizedBy === 'import_source' || !hasDraft ? ['link', 'skip'] : ['skip', 'link', 'create'];
        return mk('recognized', sameOp ? 'link' : 'skip', allowed, { selected: sameOp, linkTarget: dup.event });
      }
      default:
        break;
    }
    if (rep.status === 'invalid') return mk('invalid', 'skip', ['skip'], { reason: rep.disclosure, detail: dup.reason });
    if (rep.status === 'pending_representation') return mk('pending_representation', 'skip', ['skip'], { reason: EXPORT_STRINGS.pending, detail: rep.disclosure });
    switch (dup.class) {
      case 'not_checked': {
        const known = dup.link != null || dup.recognizedBy === 'import_source';
        return mk('not_checked', known ? 'skip' : 'create', known ? ['skip'] : ['create', 'skip']);
      }
      case 'possible_duplicate':
        return mk('possible_duplicate', 'skip', ['skip', 'link', 'create'], { linkTarget: dup.candidates[0]?.event ?? null });
      default:
        return mk('ready', 'create', ['create', 'skip'], { selected: true, reason: dup.reason, detail: dup.detail });
    }
  })();
  if (writable) return d;
  const allowed = d.allowedActions.filter((a) => a !== 'create' && a !== 'update');
  const blocked = d.defaultAction === 'create' || d.defaultAction === 'update';
  return {
    ...d,
    status: blocked ? 'not_writable' : d.status,
    reason: blocked ? EXPORT_STRINGS.notWritable : d.reason,
    defaultAction: blocked ? 'skip' : d.defaultAction,
    allowedActions: allowed.length ? allowed : ['skip'],
    selected: blocked ? false : d.selected,
  };
}

/**
 * Per-destination settings over the batch settings. Keys left `undefined` keep
 * the batch value (a missing toggle never silently drops notes, location or the
 * prefix); per-session overrides merge field by field.
 */
function mergeOptions(batch: ExportOptions, dest: Partial<ExportOptions> | undefined): ExportOptions {
  const defined = Object.fromEntries(Object.entries(dest ?? {}).filter(([k, v]) => v !== undefined && k !== 'overrides')) as Partial<ExportOptions>;
  const overrides: Record<string, ExportOverride> = { ...batch.overrides };
  for (const [sid, o] of Object.entries(dest?.overrides ?? {})) {
    const own = Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined)) as ExportOverride;
    overrides[sid] = { ...(batch.overrides[sid] ?? {}), ...own };
  }
  return { ...batch, ...defined, overrides };
}

const sortSessions = (a: Session, b: Session) => compareDates(a.date, b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** Build the review plan. Pure; sessions, links and events are never mutated. */
export function buildExportPlan(input: BuildPlanInput): ExportPlan {
  const { category } = input;
  for (const s of input.sessions) if (s.categoryId !== category.id) throw new DomainError('category_mismatch', `category_mismatch: ${s.id}`);
  const seen = new Set<string>();
  for (const d of input.destinations) {
    const k = destinationKey(d.ref);
    if (seen.has(k)) throw new DomainError('duplicate_destination', `duplicate_destination: ${k}`);
    seen.add(k);
  }
  const sessions = [...new Map(input.sessions.map((s) => [s.id, s])).values()].sort(sortSessions);
  const sessionIds = new Set(sessions.map((s) => s.id));
  const priorLinks = input.links.filter((l) => l.sessionId != null && sessionIds.has(l.sessionId));
  const originalTitles = (input.provenance ?? [])
    .filter((p) => p.sessionId != null && sessionIds.has(p.sessionId))
    .map((p) => ({ sessionId: p.sessionId as string, title: p.originalTitle }));

  const destinations = input.destinations.map((dest): PlanDestination => {
    const key = destinationKey(dest.ref);
    const options = mergeOptions(input.options, dest.options);
    const labelsSupported = dest.labelsSupported ?? dest.ref.provider === 'google';
    const colorId = labelsSupported ? dest.labelId : null;
    const writable = canWriteDestination(dest);
    const rawEvents = input.destinationEvents[key];
    const events = canCheckDestination(dest) && rawEvents ? rawEvents : null;
    const links = input.links.filter((l) => sameDest(l, dest.ref));
    const importSources = (input.provenance ?? [])
      .filter((p) => p.sessionId != null && sessionIds.has(p.sessionId) && sameDest(p, dest.ref))
      .map((p) => ({ sessionId: p.sessionId as string, externalEventId: p.externalEventId, occurrenceKey: p.occurrenceKey }));

    const built = sessions.map((session) => {
      const opId = exportOpId(session.id, dest.ref);
      const override = options.overrides[session.id] ?? null;
      const res = buildEventDraft(session, {
        categoryName: category.name,
        opId,
        prefix: options.prefix,
        suffix: options.suffix,
        includeNotes: options.includeNotes,
        includeLocation: options.includeLocation,
        startOnlySpanMin: options.startOnlySpanMin,
        colorId,
        override,
        defaultTimeZone: options.defaultTimeZone ?? null,
      });
      return { session, opId, res };
    });

    const proposals: DuplicateProposal[] = built.map(({ session, opId, res }) => ({
      session,
      opId,
      draft: res.draft,
      finalTitle: res.title.final,
      baseTitle: res.title.base,
      date: res.representation.outgoingDate,
    }));
    const checks = classifyDuplicates(proposals, {
      categoryName: category.name,
      prefix: options.prefix,
      suffix: options.suffix,
      links,
      priorLinks,
      importSources,
      originalTitles,
      events,
    });

    const rows = built.map(({ session, opId, res }, i): ExportPlanRow => {
      const dup = checks[i];
      const d = decide(res.representation, res.draft != null, dup, writable);
      return {
        key: `${key}|${session.id}`,
        destinationKey: key,
        session,
        opId,
        title: res.title,
        draft: res.draft,
        representation: res.representation,
        duplicate: dup,
        status: d.status,
        reason: d.reason,
        detail: d.detail,
        durationLabel: durationLabel(session),
        defaultAction: d.defaultAction,
        allowedActions: d.allowedActions,
        action: d.defaultAction,
        selected: d.selected,
        linkTargetEventId: d.linkTarget?.eventId ?? null,
        linkTargetOccurrenceKey: d.linkTarget?.occurrenceKey ?? null,
        touched: false,
      };
    });

    return {
      key,
      ref: dest.ref,
      calendar: dest.calendar,
      connection: dest.connection,
      labelId: dest.labelId,
      colorId,
      labelNote: !labelsSupported && dest.labelId ? EXPORT_STRINGS.labelUnsupported : null,
      checked: events != null,
      writable,
      options,
      rows,
    };
  });

  return { categoryId: category.id, categoryName: category.name, destinations };
}

// ─── review edits (immutable) ────────────────────────────────────────────────

const isTarget = (e: ExternalEvent, eventId: string | null, occurrenceKey: string | null | undefined) => e.eventId === eventId && (e.occurrenceKey ?? null) === (occurrenceKey ?? null);

function linkTargets(row: ExportPlanRow): ExternalEvent[] {
  const out: ExternalEvent[] = [];
  if (row.duplicate.event) out.push(row.duplicate.event);
  for (const c of row.duplicate.candidates) out.push(c.event);
  return out;
}

function mapRows(plan: ExportPlan, destKey: string | null, fn: (r: ExportPlanRow) => ExportPlanRow): ExportPlan {
  return {
    ...plan,
    destinations: plan.destinations.map((d) => (destKey == null || d.key === destKey ? { ...d, rows: d.rows.map(fn) } : d)),
  };
}

/**
 * Change one row's selection, action or link target. Throws DomainError
 * 'action_not_allowed' / 'invalid_link_target' for choices the row does not allow
 * (e.g. 'update' on anything but a linked, writable event).
 */
export function setRowChoice(
  plan: ExportPlan,
  destKey: string,
  sessionId: string,
  choice: { selected?: boolean; action?: ExportAction; linkTargetEventId?: string; linkTargetOccurrenceKey?: string | null },
): ExportPlan {
  let found = false;
  const next = mapRows(plan, destKey, (r) => {
    if (r.session.id !== sessionId) return r;
    found = true;
    const action = choice.action ?? r.action;
    if (!r.allowedActions.includes(action)) throw new DomainError('action_not_allowed', `action_not_allowed: ${action} @ ${r.key}`);
    let { linkTargetEventId, linkTargetOccurrenceKey } = r;
    if (choice.linkTargetEventId !== undefined) {
      const occ = choice.linkTargetOccurrenceKey ?? null;
      const ok = linkTargets(r).some((e) => e.eventId === choice.linkTargetEventId && (choice.linkTargetOccurrenceKey === undefined || (e.occurrenceKey ?? null) === occ));
      if (!ok) throw new DomainError('invalid_link_target', `invalid_link_target: ${choice.linkTargetEventId}`);
      linkTargetEventId = choice.linkTargetEventId;
      linkTargetOccurrenceKey =
        choice.linkTargetOccurrenceKey !== undefined ? occ : (linkTargets(r).find((e) => e.eventId === choice.linkTargetEventId)?.occurrenceKey ?? null);
    }
    const selected = choice.selected ?? (choice.action !== undefined ? action !== 'skip' : r.selected);
    return { ...r, action, selected: action === 'skip' ? false : selected, linkTargetEventId, linkTargetOccurrenceKey, touched: true };
  });
  if (!found) throw new DomainError('row_missing', `row_missing: ${destKey}|${sessionId}`);
  return next;
}

/**
 * Scoped select-all / deselect-all. Selecting only affects rows whose current
 * action does something (rows needing a decision, like possible duplicates,
 * stay unselected until an action is chosen). `destKey` null = every destination.
 */
export function setSelection(plan: ExportPlan, destKey: string | null, selected: boolean, filter: (r: ExportPlanRow) => boolean = () => true): ExportPlan {
  return mapRows(plan, destKey, (r) => {
    if (!filter(r)) return r;
    const next = selected ? r.action !== 'skip' : false;
    return next === r.selected ? r : { ...r, selected: next, touched: true };
  });
}

/**
 * Carry the user's choices from a previous plan into a rebuilt one (e.g. after
 * a prefix change). A choice is carried only while the row's status and
 * duplicate class are unchanged and its link target still exists; otherwise
 * the new row's safe default applies (an explicit deselection is still kept).
 */
export function mergeChoices(prev: ExportPlan, next: ExportPlan): ExportPlan {
  const old = new Map<string, ExportPlanRow>();
  for (const d of prev.destinations) for (const r of d.rows) if (r.touched) old.set(r.key, r);
  return mapRows(next, null, (r) => {
    const o = old.get(r.key);
    if (!o) return r;
    // The row's situation changed (e.g. 'ready' → 'possible_duplicate' after a title or read change):
    // a choice made for the old situation must not override the new safe default. Only an
    // explicit opt-out (deselection) is carried, since it can never write anything.
    if (o.status !== r.status || o.duplicate.class !== r.duplicate.class) return !o.selected && r.selected ? { ...r, selected: false, touched: true } : r;
    if (!r.allowedActions.includes(o.action)) return r;
    const targetOk = o.linkTargetEventId == null || linkTargets(r).some((e) => isTarget(e, o.linkTargetEventId, o.linkTargetOccurrenceKey));
    // The chosen event is no longer a candidate: never retarget a 'link' to another event silently.
    if (o.action === 'link' && !targetOk) return r;
    return {
      ...r,
      action: o.action,
      selected: o.action === 'skip' ? false : o.selected,
      linkTargetEventId: targetOk ? o.linkTargetEventId : r.linkTargetEventId,
      linkTargetOccurrenceKey: targetOk ? o.linkTargetOccurrenceKey : r.linkTargetOccurrenceKey,
      touched: true,
    };
  });
}

/** Selected / total per destination (accurate counts for the review header). */
export function selectionCounts(plan: ExportPlan): Record<string, { selected: number; total: number }> {
  return Object.fromEntries(plan.destinations.map((d) => [d.key, { selected: d.rows.filter((r) => r.selected).length, total: d.rows.length }]));
}

// ─── execution ───────────────────────────────────────────────────────────────

export interface ExportCounts {
  created: number;
  linked: number;
  updated: number;
  skipped: number;
  failed: number;
  pending: number;
}

export type OutcomeCode =
  | 'created'
  | 'reconciled'
  | 'linked'
  | 'updated'
  | 'already_exported'
  | 'not_selected'
  | 'skipped'
  | 'pending_representation'
  | 'invalid'
  | 'uncertain'
  | 'provider_error'
  | 'reconcile_failed'
  | 'store_failed'
  | 'not_allowed'
  | 'no_provider'
  | 'connection_unavailable'
  | 'account_mismatch'
  | 'no_target'
  | 'aborted';

export interface RowOutcome {
  key: string;
  destinationKey: string;
  sessionId: string;
  opId: string;
  action: ExportAction;
  result: keyof ExportCounts;
  code: OutcomeCode;
  /** Italian message for failures/pending/skips that need explaining. */
  message: string | null;
  event: ExternalEvent | null;
  link: ExportLinkRecord | null;
  /** Provider error code when a provider call failed. */
  errorCode: ProviderError['code'] | null;
}

export interface DestinationResult {
  key: string;
  ref: CalendarRef;
  counts: ExportCounts;
  rows: RowOutcome[];
}

export interface ExecuteResult {
  destinations: DestinationResult[];
  totals: ExportCounts;
}

export interface ExecuteInput {
  plan: ExportPlan;
  providers: ProviderLookup;
  repos: Pick<Repositories, 'exportLinks' | 'exportJobs'>;
  /** ISO clock for `exportedAt` and retry times. */
  now?: () => string;
  signal?: AbortSignal;
  onProgress?: (p: { destinationKey: string; done: number; total: number }) => void;
}

/** Payload stored on manual export jobs (so pending/uncertain operations can be shown and reconciled). */
export interface ManualExportJobPayload {
  v: 1;
  source: 'manual_export';
  categoryName: string;
  window: { from: LocalDate; to: LocalDate };
  draft: EventDraft;
}

const zeroCounts = (): ExportCounts => ({ created: 0, linked: 0, updated: 0, skipped: 0, failed: 0, pending: 0 });

const errMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** A write whose outcome is unknown: the provider said so, or an unexpected error happened mid-request. */
const isUncertain = (e: unknown) => !(e instanceof ProviderError) || e.code === 'uncertain';

/**
 * Window searched by `findByOpId`: the outgoing event's dates, the session date
 * (an automatic attempt for the same operation writes on the session date) and
 * the window of an earlier manual attempt, each padded by a day.
 */
function draftWindow(draft: EventDraft, sessionDate: LocalDate, prev?: { from: LocalDate; to: LocalDate } | null): { from: LocalDate; to: LocalDate } {
  const dates = [draft.start.date, draft.end.date, sessionDate].filter((d) => isLocalDate(d)).sort(compareDates);
  let from = addDays(dates[0], -1);
  let to = addDays(dates[dates.length - 1], 1);
  if (prev) {
    if (compareDates(prev.from, from) < 0) from = prev.from;
    if (compareDates(prev.to, to) > 0) to = prev.to;
  }
  return { from, to };
}

function payloadWindow(job: ExportJobRecord | undefined): { from: LocalDate; to: LocalDate } | null {
  const p = job?.payload as Partial<ManualExportJobPayload> | null | undefined;
  return p && p.source === 'manual_export' && p.window?.from && p.window?.to ? p.window : null;
}

/**
 * Execute the confirmed selection, destination by destination. Each row's
 * failure is isolated; each destination's connection problems are isolated.
 */
export async function executePlan(input: ExecuteInput): Promise<ExecuteResult> {
  const now = input.now ?? (() => new Date().toISOString());
  const { exportLinks, exportJobs } = input.repos;
  const results: DestinationResult[] = [];

  for (const dest of input.plan.destinations) {
    const counts = zeroCounts();
    const outcomes: RowOutcome[] = [];
    const provider = lookupProvider(input.providers, dest.ref);
    const categoryName = input.plan.categoryName;

    // Connection gate for provider writes (create/update). 'link' and 'skip' are local.
    const needsWrite = dest.rows.some((r) => r.selected && (r.action === 'create' || r.action === 'update'));
    let gate: { code: OutcomeCode; message: string } | null = null;
    if (needsWrite) {
      if (!provider) gate = { code: 'no_provider', message: EXPORT_STRINGS.noProvider };
      else {
        try {
          const conn = await provider.getConnection();
          if (!(conn.status === 'connected' || conn.status === 'write_only') || !conn.canWrite) {
            gate = { code: 'connection_unavailable', message: conn.detail ?? EXPORT_STRINGS.connectionUnavailable };
          } else {
            // Google calendar ids (e.g. 'primary') are account-relative: the account in the ref must be the signed-in one.
            const expected = [dest.connection.accountId, dest.ref.provider === 'google' ? dest.ref.accountId : null].filter((x): x is string => !!x);
            if (conn.accountId && expected.some((a) => a.toLowerCase() !== conn.accountId!.toLowerCase())) gate = { code: 'account_mismatch', message: EXPORT_STRINGS.accountMismatch };
          }
        } catch (e) {
          gate = { code: 'connection_unavailable', message: errMessage(e) || EXPORT_STRINGS.connectionUnavailable };
        }
      }
    }

    const opIds = new Set(dest.rows.map((r) => r.opId));
    const openJobs = new Map<string, ExportJobRecord>();
    // When earlier attempts cannot be read, any of them may have been uncertain: reconcile before every create.
    let jobsUnknown = false;
    if (dest.rows.some((r) => r.selected)) {
      try {
        for (const j of await exportJobs.list(OPEN_JOB_STATUSES)) if (opIds.has(j.opId)) openJobs.set(j.opId, j);
      } catch {
        jobsUnknown = true;
      }
    }

    const closeJob = async (opId: string, status: ExportJobStatus, patch: { lastError?: string | null; reviewReason?: string | null; nextAttemptAt?: string | null } = {}) => {
      const j = openJobs.get(opId);
      if (!j) return;
      try {
        await exportJobs.update(j.id, { status, ...patch });
      } catch {
        /* job bookkeeping must never mask the row outcome */
      }
      if (status === 'succeeded' || status === 'cancelled') openJobs.delete(opId);
      else openJobs.set(opId, { ...j, status, ...patch } as ExportJobRecord);
    };

    const startJob = async (row: ExportPlanRow, draft: EventDraft, window: { from: LocalDate; to: LocalDate }) => {
      const payload: ManualExportJobPayload = { v: 1, source: 'manual_export', categoryName, window, draft };
      const cur = openJobs.get(row.opId);
      if (cur) {
        // An open automatic job for the same operation keeps its own payload (the auto runner reads it).
        const nextPayload = cur.kind === 'manual' ? payload : cur.payload;
        await exportJobs.update(cur.id, { status: 'running', attempts: cur.attempts + 1, ...(cur.kind === 'manual' ? { payload } : {}) });
        openJobs.set(row.opId, { ...cur, status: 'running', attempts: cur.attempts + 1, payload: nextPayload });
        return;
      }
      let j = await exportJobs.enqueue({
        opId: row.opId,
        sessionId: row.session.id,
        provider: dest.ref.provider,
        accountId: dest.ref.accountId,
        calendarId: dest.ref.calendarId,
        kind: 'manual',
        status: 'running',
        payload,
      });
      if (j.opId !== row.opId || j.status !== 'running') j = (await exportJobs.list(['running'])).find((x) => x.opId === row.opId) ?? j;
      await exportJobs.update(j.id, { attempts: j.attempts + 1 });
      openJobs.set(row.opId, { ...j, attempts: j.attempts + 1 });
    };

    const storeCreated = async (row: ExportPlanRow, ev: ExternalEvent, snapshot: ReturnType<typeof snapshotFromDraft>) =>
      exportLinks.upsert({
        sessionId: row.session.id,
        provider: dest.ref.provider,
        accountId: dest.ref.accountId,
        calendarId: dest.ref.calendarId,
        externalEventId: ev.eventId,
        occurrenceKey: ev.occurrenceKey,
        status: 'created',
        opId: row.opId,
        snapshot,
        exportedAt: now(),
      });

    const runRow = async (row: ExportPlanRow): Promise<Omit<RowOutcome, 'key' | 'destinationKey' | 'sessionId' | 'opId' | 'action'>> => {
      const none = { event: null, link: null, errorCode: null };
      if (row.status === 'pending_representation') return { ...none, result: 'pending', code: 'pending_representation', message: EXPORT_STRINGS.pending };
      if (row.status === 'invalid') return { ...none, result: 'pending', code: 'invalid', message: row.reason };
      if (!row.selected) return { ...none, result: 'skipped', code: 'not_selected', message: null };
      if (!row.allowedActions.includes(row.action)) return { ...none, result: 'failed', code: 'not_allowed', message: EXPORT_STRINGS.notAllowed };
      if (row.action === 'skip') return { ...none, result: 'skipped', code: 'skipped', message: null };

      if (row.action === 'link') {
        const target = linkTargets(row).find((e) => isTarget(e, row.linkTargetEventId, row.linkTargetOccurrenceKey));
        if (!target) return { ...none, result: 'failed', code: 'no_target', message: EXPORT_STRINGS.noTarget };
        const existing = await exportLinks.byOp(row.opId);
        if (existing && existing.externalEventId === target.eventId && (existing.occurrenceKey ?? null) === (target.occurrenceKey ?? null)) {
          await closeJob(row.opId, 'succeeded');
          return { ...none, result: 'skipped', code: 'already_exported', message: EXPORT_STRINGS.alreadyExported, link: existing, event: target };
        }
        const tm = row.session.timing;
        const known = tm.durationSec != null && tm.durationSec > 0 ? tm.durationSec : null;
        // Serie's own event for this session carries the timing it was written with: record THAT,
        // so a later difference with the session is reported instead of being masked.
        const own = target.appMeta && target.appMeta.sessionId === row.session.id ? target.appMeta : null;
        const meta = own ?? { timingState: tm.state, durationSec: known, durationSource: known != null ? tm.durationSource : null, schedulingPlaceholder: target.appMeta?.schedulingPlaceholder ?? false };
        const link = await exportLinks.upsert({
          sessionId: row.session.id,
          provider: dest.ref.provider,
          accountId: dest.ref.accountId,
          calendarId: dest.ref.calendarId,
          externalEventId: target.eventId,
          occurrenceKey: target.occurrenceKey,
          status: 'linked',
          opId: row.opId,
          snapshot: snapshotFromEvent(target, meta, categoryName),
          exportedAt: now(),
        });
        await closeJob(row.opId, 'succeeded');
        return { ...none, result: 'linked', code: 'linked', message: null, link, event: target };
      }

      // create / update need the provider and a usable connection.
      if (gate) return { ...none, result: 'failed', code: gate.code, message: gate.message };
      const p = provider as CalendarProvider;
      const draft = row.draft;
      if (!draft) return { ...none, result: 'pending', code: 'pending_representation', message: EXPORT_STRINGS.pending };
      const calId = dest.ref.calendarId;

      if (row.action === 'update') {
        const link = (await exportLinks.byOp(row.opId)) ?? row.duplicate.link;
        // Explicit choice only (the default is never 'update'), and only for a linked event.
        if (!row.touched || !link || (row.duplicate.class !== 'linked_changed' && row.duplicate.class !== 'already_exported')) {
          return { ...none, result: 'failed', code: 'not_allowed', message: EXPORT_STRINGS.notAllowed };
        }
        let ev: ExternalEvent;
        try {
          ev = await p.updateEvent(calId, link.externalEventId, draft, link.occurrenceKey);
        } catch (e) {
          const code = e instanceof ProviderError ? e.code : null;
          return { ...none, result: 'failed', code: 'provider_error', message: code === 'not_found' ? EXPORT_STRINGS.linkedMissing : errMessage(e), errorCode: code };
        }
        const stored = await exportLinks.upsert({
          sessionId: row.session.id,
          provider: dest.ref.provider,
          accountId: dest.ref.accountId,
          calendarId: calId,
          externalEventId: ev.eventId,
          occurrenceKey: ev.occurrenceKey ?? link.occurrenceKey,
          status: 'updated',
          opId: link.opId,
          snapshot: snapshotFromDraft(draft, categoryName),
          exportedAt: now(),
        });
        return { ...none, result: 'updated', code: 'updated', message: null, event: ev, link: stored };
      }

      // create — idempotent.
      const staleId = row.duplicate.staleLink?.externalEventId ?? null;
      const existing = await exportLinks.byOp(row.opId);
      if (existing && !(staleId && existing.externalEventId === staleId)) {
        await closeJob(row.opId, 'succeeded');
        return { ...none, result: 'skipped', code: 'already_exported', message: EXPORT_STRINGS.alreadyExported, link: existing };
      }

      const prevJob = openJobs.get(row.opId);
      const window = draftWindow(draft, row.session.date, payloadWindow(prevJob));
      const reconcile = async (): Promise<ExternalEvent | null> => {
        const found = await p.findByOpId(calId, row.opId, window);
        return found && found.status !== 'cancelled' && found.appMeta?.opId === row.opId ? found : null;
      };
      const linkFound = async (found: ExternalEvent) => {
        const snap = snapshotFromEvent(found, found.appMeta ?? draft.appMeta, categoryName);
        const link = await storeCreated(row, found, snap);
        await closeJob(row.opId, 'succeeded', { lastError: null });
        return { ...none, result: 'created' as const, code: 'reconciled' as const, message: null, event: found, link };
      };

      if (jobsUnknown || prevJob?.status === 'uncertain' || prevJob?.status === 'running' || staleId) {
        let found: ExternalEvent | null;
        try {
          found = await reconcile();
        } catch (e) {
          if (prevJob) await closeJob(row.opId, 'uncertain', { lastError: errMessage(e) });
          return { ...none, result: 'failed', code: 'reconcile_failed', message: EXPORT_STRINGS.reconcileFailed, errorCode: e instanceof ProviderError ? e.code : null };
        }
        if (found) return linkFound(found);
      }

      await startJob(row, draft, window);
      let ev: ExternalEvent;
      try {
        ev = await p.createEvent(calId, draft);
      } catch (e) {
        const errorCode = e instanceof ProviderError ? e.code : null;
        if (isUncertain(e)) {
          await closeJob(row.opId, 'uncertain', { lastError: errMessage(e), nextAttemptAt: now() });
          try {
            const found = await reconcile();
            if (found) return linkFound(found);
          } catch {
            /* stays uncertain: the next attempt reconciles before creating */
          }
          return { ...none, result: 'pending', code: 'uncertain', message: EXPORT_STRINGS.uncertain, errorCode };
        }
        const retryable = (e as ProviderError).retryable;
        const retryAt = retryable && (e as ProviderError).retryAfterMs ? new Date(Date.parse(now()) + (e as ProviderError).retryAfterMs!).toISOString() : null;
        await closeJob(row.opId, retryable ? 'failed' : 'needs_review', { lastError: errMessage(e), reviewReason: retryable ? null : errMessage(e), nextAttemptAt: retryAt });
        return { ...none, result: 'failed', code: 'provider_error', message: errMessage(e), errorCode };
      }

      let link: ExportLinkRecord;
      try {
        link = await storeCreated(row, ev, snapshotFromDraft(draft, categoryName));
      } catch (e) {
        // The event exists but the link could not be stored: keep the job uncertain so the next run reconciles by op id.
        await closeJob(row.opId, 'uncertain', { lastError: errMessage(e) });
        return { ...none, result: 'created', code: 'store_failed', message: EXPORT_STRINGS.storeFailed, event: ev };
      }
      await closeJob(row.opId, 'succeeded', { lastError: null });
      return { ...none, result: 'created', code: 'created', message: null, event: ev, link };
    };

    let done = 0;
    for (const row of dest.rows) {
      const head = { key: row.key, destinationKey: dest.key, sessionId: row.session.id, opId: row.opId, action: row.action };
      let out: Omit<RowOutcome, keyof typeof head>;
      if (input.signal?.aborted && row.selected && row.action !== 'skip') {
        out = { result: 'pending', code: 'aborted', message: EXPORT_STRINGS.aborted, event: null, link: null, errorCode: null };
      } else {
        try {
          out = await runRow(row);
        } catch (e) {
          out = { result: 'failed', code: 'provider_error', message: errMessage(e), event: null, link: null, errorCode: e instanceof ProviderError ? e.code : null };
        }
      }
      counts[out.result]++;
      outcomes.push({ ...head, ...out });
      input.onProgress?.({ destinationKey: dest.key, done: ++done, total: dest.rows.length });
    }
    results.push({ key: dest.key, ref: dest.ref, counts, rows: outcomes });
  }

  const totals = zeroCounts();
  for (const r of results) for (const k of Object.keys(totals) as Array<keyof ExportCounts>) totals[k] += r.counts[k];
  return { destinations: results, totals };
}
