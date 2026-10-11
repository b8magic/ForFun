/**
 * Automatic export after saving (opt-in, off by default).
 *
 *   defaultConfig / loadConfig / saveConfig
 *                       configuration persisted in settings under 'autoExport'.
 *   validateConfig      destinations exist and are writable; "Both" pairs are
 *                       cleared by the equivalence rule (equivalent → never;
 *                       unknown → only after the user confirmed THIS pair).
 *   eligibleDestinations
 *                       pure plan for one session: scope, imported sessions
 *                       (excluded unless forwarding; never back to their source
 *                       calendar, using provenance), per-activity destination
 *                       overrides, representation approval, op ids.
 *   enqueueForSessions  called right after a local commit; idempotent (op id);
 *                       unapproved representations / ambiguity go straight to
 *                       'needs_review' ("Da rivedere") without blocking saving.
 *   runJobs             processes due auto jobs: offline → stays pending;
 *                       unauthorized/denied/disconnected → 'failed' + backoff;
 *                       write-only → 'needs_review' (duplicates cannot be
 *                       checked); rate limited → 'failed' with backoff (1 m,
 *                       5 m, 30 m, 2 h, then 12 h; Retry-After respected).
 *                       Before writing: stored link by op id → succeeded;
 *                       uncertain → findByOpId first; the REAL destination is
 *                       read and classified with `classifyDuplicates`
 *                       (recognized → linked, possible duplicate → review).
 *                       'succeeded' means accepted by the calendar integration,
 *                       not synced to any cloud.
 *   resolveReviewJob    skip / retry / approve a span / create separately / link.
 *   disableAutoExport   stops future enqueues; optionally cancels open auto
 *                       jobs. Never deletes or edits calendar events.
 *   summarizeJobs       counts + Italian badge for the UI.
 *
 * Pure logic plus repository calls; providers are injected. No React, no Expo.
 */
import { ProviderError, type CalendarProvider, type CalendarRef, type Connection, type EventDraft, type ExternalCalendar, type ExternalEvent, type ProviderKind } from './types';
import type { AppEventMeta } from './types';
import type { Category, ExportJobStatus, ExportSnapshot, LocalDate, Session, TimingState } from '@/domain/types';
import { DomainError, OPEN_JOB_STATUSES, type ExportJobRecord, type ExportLinkRecord, type ProvenanceRecord, type Repositories } from '@/data/repositories';
import { addDays, compareDates } from '@/domain/dates';
import { t } from '@/i18n/it';
import { exportOpId } from './opId';
import { buildEventDraft, snapshotFromDraft, snapshotFromEvent, validSpanMin, type DraftResult } from './representation';
import { classifyDuplicates } from './duplicates';
import { canonicalEmail, gateBothDestinations, pairKey, sameUnderlyingCalendar, type BothGate, type BothResolution, type EquivalenceVerdict } from './equivalence';

export type { BothResolution };

// ─── strings (Italian) ───────────────────────────────────────────────────────

export const AUTO_EXPORT_STRINGS = {
  review: {
    start_only_not_approved: t.reprStartOnly,
    representation_not_approved: 'Rappresentazione nel calendario non ancora approvata per questo tipo di sessione.',
    invalid_timing: 'Orario della sessione incompleto: correggilo per esportarla.',
    both_equivalent: t.equivalentWarning,
    both_unresolved: t.equivalenceUnknown,
    source_calendar_unknown: 'Potrebbe essere il calendario da cui la sessione è stata importata: verifica prima di esportare.',
    possible_duplicate: t.exportStatusPossibleDuplicate,
    write_only: t.writeOnly,
    not_checked: t.exportStatusNotChecked,
    calendar_not_found: 'Calendario di destinazione non trovato.',
    calendar_read_only: 'Il calendario di destinazione è di sola lettura.',
    invalid_event: 'Il calendario ha rifiutato i dati dell’evento.',
    invalid_payload: 'Dati dell’esportazione non leggibili: riprova dalla revisione.',
  },
  error: {
    offline: 'Offline: riprovo quando torna la connessione.',
    rateLimited: 'Troppe richieste al calendario: riprovo più tardi.',
    unauthorized: 'Accesso al calendario scaduto o revocato: ricollega per riprendere.',
    disconnected: 'Calendario non collegato: collegalo per riprendere.',
    readOnlyAccess: 'Accesso al calendario in sola lettura: ricollega concedendo la scrittura.',
    accountMismatch: (connected: string, wanted: string) => `Collegato come ${connected}, ma la destinazione è di ${wanted}.`,
    noProvider: 'Integrazione non disponibile in questa build.',
    uncertain: t.jobUncertain,
    storeFailed: 'Evento accettato dal calendario ma non registrato in Serie: verifico al prossimo tentativo.',
    generic: t.errorGeneric,
  },
  cancelled: {
    sourceCalendar: 'È il calendario da cui la sessione è stata importata: non viene riesportata lì.',
    importSourceEvent: 'È l’evento da cui la sessione è stata importata.',
    sessionMissing: 'La sessione non esiste più.',
    userSkipped: 'Saltata dalla revisione.',
  },
  exclusion: {
    disabled: 'Esportazione automatica disattivata.',
    category_missing: 'Attività non trovata.',
    out_of_scope: 'Attività non inclusa nell’esportazione automatica.',
    imported_not_forwarded: 'Sessione importata: non viene riesportata automaticamente.',
    imported_source_unknown: 'Sessione importata senza provenienza registrata: non viene riesportata.',
    no_destination: 'Nessun calendario di destinazione.',
    source_calendar: 'È il calendario da cui la sessione è stata importata: non viene riesportata lì.',
    source_calendar_equivalent: 'È il calendario da cui la sessione è stata importata, visto da un altro percorso.',
  },
  skip: {
    already_exported: t.exportStatusAlready,
    already_queued: 'Esportazione già in coda o già gestita.',
    error: t.errorGeneric,
  },
  issues: {
    no_destination: 'Scegli almeno un calendario di destinazione.',
    scope_empty: 'Scegli almeno un’attività.',
    category_missing: 'Un’attività scelta non esiste più.',
    calendar_not_found: 'Calendario di destinazione non trovato.',
    calendar_unverified: 'Calendario non verificabile ora: collega il servizio per controllarlo.',
    calendar_not_writable: 'Calendario di sola lettura: scegline uno in cui si può scrivere.',
    account_mismatch: 'Il calendario non appartiene all’account indicato.',
    start_only_span_invalid: 'Intervallo di pianificazione non valido: da 1 a 1440 minuti.',
    both_equivalent: t.equivalentWarning,
    both_unresolved: t.equivalenceUnknown,
  },
  badgeReview: (n: number) => `${n} da rivedere`,
  badgePending: (n: number) => t.manage.pendingExports(n),
} as const;

export const JOB_STATUS_LABELS: Record<ExportJobStatus, string> = {
  pending: t.jobPending,
  running: t.jobRunning,
  succeeded: t.jobSucceeded,
  failed: t.jobFailed,
  uncertain: t.jobUncertain,
  needs_review: t.jobNeedsReview,
  cancelled: t.jobCancelled,
};

// ─── configuration ───────────────────────────────────────────────────────────

export const AUTO_EXPORT_SETTINGS_KEY = 'autoExport';

export interface GoogleDestination {
  calendarId: string;
  /** Google account email. */
  accountId: string;
  /** Google colorId written on the event, or null. */
  labelId: string | null;
}

/** EventKit has no per-event labels, so an Apple destination has none (disclosed in the UI). */
export interface AppleDestination {
  calendarId: string;
  /** EventKit source id. */
  accountId: string;
}

export interface DestinationSet {
  google?: GoogleDestination;
  apple?: AppleDestination;
}

/** Per-activity destination settings; replaces the default set for that activity. */
export interface CategoryOverride {
  destinations: DestinationSet;
}

export type AutoExportScope = 'all' | { categoryIds: string[] };

export interface TitleRules {
  /** Verbatim (spacing preserved). Final title = prefix + activity name + suffix. */
  prefix: string;
  suffix: string;
}

/** Start-only sessions need an export-only scheduling span: opt-in only. */
export type StartOnlyRule = { mode: 'review' } | { mode: 'span'; minutes: number };

/** Approved outgoing representation per timing state; 'review' queues the job in "Da rivedere". */
export interface RepresentationRules {
  dateOnly: 'date_marker' | 'review';
  startOnly: StartOnlyRule;
  interval: 'interval' | 'review';
  durationOnly: 'duration_marker' | 'review';
  startDuration: 'derived_end' | 'review';
}

export interface AutoExportConfig {
  v: 1;
  enabled: boolean;
  scope: AutoExportScope;
  destinations: DestinationSet;
  categoryOverrides: Record<string, CategoryOverride>;
  title: TitleRules;
  includeNotes: boolean;
  includeLocation: boolean;
  representation: RepresentationRules;
  /** Export sessions that were imported from a calendar (never back into their source). */
  forwardImported: boolean;
  /** The user explicitly confirmed an ambiguous Google × Apple pair as distinct calendars. */
  bothResolution: BothResolution;
  /** Pairs (`pairKey`) the confirmation applies to; changing a destination needs a new confirmation. */
  bothResolvedPairs: string[];
}

export const DEFAULT_REPRESENTATION: Readonly<RepresentationRules> = Object.freeze({
  dateOnly: 'date_marker',
  startOnly: { mode: 'review' },
  interval: 'interval',
  durationOnly: 'duration_marker',
  startDuration: 'derived_end',
}) as RepresentationRules;

export function defaultConfig(): AutoExportConfig {
  return {
    v: 1,
    enabled: false,
    scope: 'all',
    destinations: {},
    categoryOverrides: {},
    title: { prefix: '', suffix: '' },
    includeNotes: true,
    includeLocation: true,
    representation: { ...DEFAULT_REPRESENTATION, startOnly: { mode: 'review' } },
    forwardImported: false,
    bothResolution: null,
    bothResolvedPairs: [],
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const nonEmpty = (x: unknown): x is string => typeof x === 'string' && x.length > 0;
const pick = <T extends string>(x: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(x as T) ? (x as T) : fallback);

function normGoogle(x: unknown): GoogleDestination | undefined {
  if (!isObj(x) || !nonEmpty(x.calendarId) || !nonEmpty(x.accountId)) return undefined;
  return { calendarId: x.calendarId, accountId: x.accountId, labelId: nonEmpty(x.labelId) ? x.labelId : null };
}

function normApple(x: unknown): AppleDestination | undefined {
  if (!isObj(x) || !nonEmpty(x.calendarId) || !nonEmpty(x.accountId)) return undefined;
  return { calendarId: x.calendarId, accountId: x.accountId };
}

function normSet(x: unknown): DestinationSet {
  const out: DestinationSet = {};
  if (!isObj(x)) return out;
  const g = normGoogle(x.google);
  const a = normApple(x.apple);
  if (g) out.google = g;
  if (a) out.apple = a;
  return out;
}

function normStartOnly(x: unknown): StartOnlyRule {
  if (isObj(x) && x.mode === 'span') {
    const m = validSpanMin(x.minutes as number);
    if (m != null) return { mode: 'span', minutes: m };
  }
  return { mode: 'review' };
}

function normRepresentation(x: unknown): RepresentationRules {
  const r = isObj(x) ? x : {};
  return {
    dateOnly: pick(r.dateOnly, ['date_marker', 'review'] as const, DEFAULT_REPRESENTATION.dateOnly),
    startOnly: normStartOnly(r.startOnly),
    interval: pick(r.interval, ['interval', 'review'] as const, DEFAULT_REPRESENTATION.interval),
    durationOnly: pick(r.durationOnly, ['duration_marker', 'review'] as const, DEFAULT_REPRESENTATION.durationOnly),
    startDuration: pick(r.startDuration, ['derived_end', 'review'] as const, DEFAULT_REPRESENTATION.startDuration),
  };
}

/**
 * Sanitise a stored or edited configuration. Anything unreadable falls back to
 * the conservative default (disabled, start-only → review, no forwarding).
 */
export function normalizeConfig(raw: unknown): AutoExportConfig {
  const d = defaultConfig();
  if (!isObj(raw)) return d;
  let scope: AutoExportScope = 'all';
  if (isObj(raw.scope) && Array.isArray(raw.scope.categoryIds)) {
    scope = { categoryIds: [...new Set(raw.scope.categoryIds.filter(nonEmpty))] };
  }
  const overrides: Record<string, CategoryOverride> = {};
  if (isObj(raw.categoryOverrides)) {
    for (const [id, o] of Object.entries(raw.categoryOverrides)) {
      if (nonEmpty(id) && isObj(o)) overrides[id] = { destinations: normSet(o.destinations) };
    }
  }
  const title = isObj(raw.title) ? raw.title : {};
  return {
    v: 1,
    enabled: raw.enabled === true,
    scope,
    destinations: normSet(raw.destinations),
    categoryOverrides: overrides,
    title: { prefix: typeof title.prefix === 'string' ? title.prefix : '', suffix: typeof title.suffix === 'string' ? title.suffix : '' },
    includeNotes: typeof raw.includeNotes === 'boolean' ? raw.includeNotes : d.includeNotes,
    includeLocation: typeof raw.includeLocation === 'boolean' ? raw.includeLocation : d.includeLocation,
    representation: normRepresentation(raw.representation),
    forwardImported: raw.forwardImported === true,
    bothResolution: raw.bothResolution === 'resolved_distinct' ? 'resolved_distinct' : null,
    bothResolvedPairs: Array.isArray(raw.bothResolvedPairs) ? [...new Set(raw.bothResolvedPairs.filter(nonEmpty))] : [],
  };
}

export async function loadConfig(repos: Pick<Repositories, 'settings'>): Promise<AutoExportConfig> {
  return normalizeConfig(await repos.settings.get<unknown>(AUTO_EXPORT_SETTINGS_KEY, null));
}

export async function saveConfig(repos: Pick<Repositories, 'settings'>, config: AutoExportConfig): Promise<AutoExportConfig> {
  const c = normalizeConfig(config);
  await repos.settings.set(AUTO_EXPORT_SETTINGS_KEY, c);
  return c;
}

export const googleRef = (d: GoogleDestination): CalendarRef => ({ provider: 'google', accountId: d.accountId, calendarId: d.calendarId });
export const appleRef = (d: AppleDestination): CalendarRef => ({ provider: 'apple', accountId: d.accountId, calendarId: d.calendarId });

/** Destination set in effect for an activity (its override, else the default). */
export function destinationsFor(config: AutoExportConfig, categoryId: string): DestinationSet {
  return config.categoryOverrides[categoryId]?.destinations ?? config.destinations;
}

export function inScope(config: AutoExportConfig, categoryId: string): boolean {
  return config.scope === 'all' || config.scope.categoryIds.includes(categoryId);
}

export function isPairResolved(config: AutoExportConfig, google: CalendarRef, apple: CalendarRef): boolean {
  return config.bothResolution === 'resolved_distinct' && config.bothResolvedPairs.includes(pairKey(google, apple));
}

/** Record the user's explicit confirmation that this Google × Apple pair are different calendars. */
export function withBothResolved(config: AutoExportConfig, google: CalendarRef, apple: CalendarRef): AutoExportConfig {
  const key = pairKey(google, apple);
  return { ...config, bothResolution: 'resolved_distinct', bothResolvedPairs: config.bothResolvedPairs.includes(key) ? config.bothResolvedPairs : [...config.bothResolvedPairs, key] };
}

export function withoutBothResolution(config: AutoExportConfig): AutoExportConfig {
  return { ...config, bothResolution: null, bothResolvedPairs: [] };
}

// ─── validation ──────────────────────────────────────────────────────────────

export type ConfigIssueCode = keyof typeof AUTO_EXPORT_STRINGS.issues;

export interface ConfigIssue {
  code: ConfigIssueCode;
  /** 'error' blocks automatic export for the affected destinations. */
  severity: 'error' | 'warning';
  message: string;
  /** null = default destinations; otherwise the activity whose override is affected. */
  categoryId: string | null;
  provider: ProviderKind | null;
  /** For "Both" issues: the equivalence verdict and the account/calendar details to show. */
  gate?: BothGate;
}

export interface ConfigValidation {
  /** No blocking issue. */
  runnable: boolean;
  /** Every Google × Apple pair is cleared for "Both". */
  bothRunnable: boolean;
  issues: ConfigIssue[];
}

function destinationSetsInUse(config: AutoExportConfig): Array<{ categoryId: string | null; set: DestinationSet }> {
  const out: Array<{ categoryId: string | null; set: DestinationSet }> = [];
  const overridden = Object.keys(config.categoryOverrides);
  if (config.scope === 'all') {
    out.push({ categoryId: null, set: config.destinations });
    for (const id of overridden) out.push({ categoryId: id, set: config.categoryOverrides[id].destinations });
  } else {
    const ids = config.scope.categoryIds;
    if (ids.some((id) => !config.categoryOverrides[id])) out.push({ categoryId: null, set: config.destinations });
    for (const id of ids) if (config.categoryOverrides[id]) out.push({ categoryId: id, set: config.categoryOverrides[id].destinations });
  }
  return out;
}

const sameAccount = (provider: ProviderKind, a: string, b: string) =>
  provider === 'google' ? (canonicalEmail(a) ?? a.toLowerCase()) === (canonicalEmail(b) ?? b.toLowerCase()) : a === b;

/**
 * Check a configuration against the calendars currently listed by the
 * providers (pass both providers' calendars). Equivalent "Both" pairs are
 * never runnable; unknown ones only after `withBothResolved` for that pair.
 */
export function validateConfig(config: AutoExportConfig, calendars: readonly ExternalCalendar[], opts: { categories?: readonly Pick<Category, 'id'>[] } = {}): ConfigValidation {
  const issues: ConfigIssue[] = [];
  const S = AUTO_EXPORT_STRINGS.issues;
  const issue = (code: ConfigIssueCode, severity: ConfigIssue['severity'], categoryId: string | null, provider: ProviderKind | null = null, gate?: BothGate) =>
    issues.push({ code, severity, message: S[code], categoryId, provider, ...(gate ? { gate } : {}) });

  if (config.scope !== 'all') {
    if (config.scope.categoryIds.length === 0) issue('scope_empty', 'error', null);
    if (opts.categories) for (const id of config.scope.categoryIds) if (!opts.categories.some((c) => c.id === id)) issue('category_missing', 'warning', id);
  }
  const so = config.representation?.startOnly;
  if (so && so.mode === 'span' && validSpanMin(so.minutes) == null) issue('start_only_span_invalid', 'error', null);

  const googleCals = calendars.filter((c) => c.provider === 'google');
  for (const { categoryId, set } of destinationSetsInUse(config)) {
    const dests: Array<[ProviderKind, CalendarRef]> = [];
    if (set.google) dests.push(['google', googleRef(set.google)]);
    if (set.apple) dests.push(['apple', appleRef(set.apple)]);
    if (!dests.length) {
      issue('no_destination', 'error', categoryId);
      continue;
    }
    const found: Partial<Record<ProviderKind, ExternalCalendar>> = {};
    const before = issues.length;
    for (const [provider, ref] of dests) {
      const listed = calendars.filter((c) => c.provider === provider);
      if (!listed.length) {
        issue('calendar_unverified', 'warning', categoryId, provider);
        continue;
      }
      const cal = listed.find((c) => c.calendarId === ref.calendarId);
      if (!cal) issue('calendar_not_found', 'error', categoryId, provider);
      else if (!sameAccount(provider, cal.accountId, ref.accountId)) issue('account_mismatch', 'error', categoryId, provider);
      else if (!cal.canWrite) issue('calendar_not_writable', 'error', categoryId, provider);
      else found[provider] = cal;
    }
    const destinationError = issues.slice(before).some((i) => i.severity === 'error');
    if (set.google && set.apple && !destinationError) {
      const resolved = isPairResolved(config, googleRef(set.google), appleRef(set.apple));
      if (found.google && found.apple) {
        const gate = gateBothDestinations(found.google, found.apple, resolved ? 'resolved_distinct' : null, { googleCalendars: googleCals });
        if (!gate.allowed) issue(gate.code === 'equivalent' ? 'both_equivalent' : 'both_unresolved', 'error', categoryId, null, gate);
      } else if (!resolved) {
        issue('both_unresolved', 'error', categoryId);
      }
    }
  }
  return {
    runnable: !issues.some((i) => i.severity === 'error'),
    bothRunnable: !issues.some((i) => i.code === 'both_equivalent' || i.code === 'both_unresolved'),
    issues,
  };
}

// ─── planning (pure) ─────────────────────────────────────────────────────────

export type ExclusionCode = keyof typeof AUTO_EXPORT_STRINGS.exclusion;

export interface Exclusion {
  code: ExclusionCode;
  message: string;
  provider: ProviderKind | null;
  ref: CalendarRef | null;
}

export type ReviewCode = keyof typeof AUTO_EXPORT_STRINGS.review;

export interface ReviewNote {
  code: ReviewCode;
  /** Italian reason shown in "Da rivedere". */
  message: string;
}

export interface PlannedDestination {
  provider: ProviderKind;
  ref: CalendarRef;
  labelId: string | null;
  opId: string;
  /** Set when the job must wait in "Da rivedere" instead of running. */
  review: ReviewNote | null;
}

/** The two routes of one session when exporting to "Both". */
export interface JobPair {
  google: CalendarRef;
  apple: CalendarRef;
  googleOpId: string;
  appleOpId: string;
}

export interface DestinationPlan {
  sessionId: string;
  eligible: PlannedDestination[];
  excluded: Exclusion[];
  pair: JobPair | null;
}

/** The part of a provenance record that identifies the source calendar. */
export type SourceRecord = Pick<ProvenanceRecord, 'provider' | 'accountId' | 'calendarId'>;

export interface PlanOptions {
  /** Calendars currently listed by the providers (enables equivalence checks at enqueue time). */
  calendars?: readonly ExternalCalendar[];
}

const reviewNote = (code: ReviewCode, message?: string): ReviewNote => ({ code, message: message ?? AUTO_EXPORT_STRINGS.review[code] });

export type RepresentationApproval = { approved: true; startOnlySpanMin: number | null } | { approved: false; review: ReviewNote };

/** Is the outgoing representation for this timing state approved by the rules (or by a per-job approval)? */
export function representationApproval(state: TimingState, rules: RepresentationRules, approvedSpanMin: number | null = null): RepresentationApproval {
  const ok = (span: number | null = null): RepresentationApproval => ({ approved: true, startOnlySpanMin: span });
  const no = (code: ReviewCode): RepresentationApproval => ({ approved: false, review: reviewNote(code) });
  switch (state) {
    case 'date_only':
      return rules.dateOnly === 'date_marker' ? ok() : no('representation_not_approved');
    case 'start_only': {
      const span = validSpanMin(approvedSpanMin) ?? (rules.startOnly.mode === 'span' ? validSpanMin(rules.startOnly.minutes) : null);
      return span != null ? ok(span) : no('start_only_not_approved');
    }
    case 'interval':
      return rules.interval === 'interval' ? ok() : no('representation_not_approved');
    case 'duration_only':
      return rules.durationOnly === 'duration_marker' ? ok() : no('representation_not_approved');
    case 'start_duration':
      return rules.startDuration === 'derived_end' ? ok() : no('representation_not_approved');
  }
  return no('representation_not_approved');
}

/** Stand-in descriptor for a source calendar that is not currently listed (no title, no source details). */
function stubCalendar(p: SourceRecord): ExternalCalendar {
  const email = canonicalEmail(p.accountId);
  return {
    provider: p.provider,
    accountId: p.accountId,
    calendarId: p.calendarId,
    accountLabel: p.accountId,
    title: '',
    color: null,
    access: 'unknown',
    canRead: false,
    canWrite: false,
    isPrimary: p.provider === 'google' && email != null && canonicalEmail(p.calendarId) === email,
    sourceType: null,
    sourceName: null,
  };
}

type SourceVerdict = 'none' | 'same' | 'equivalent' | 'unknown';

/**
 * Is `dest` the calendar the session was imported from? Same provider → same
 * calendar id. Other provider → the equivalence rule (when descriptors exist).
 */
function sourceVerdict(dest: CalendarRef, provenance: readonly SourceRecord[], destCal: ExternalCalendar | null, lookup: ((p: SourceRecord) => ExternalCalendar | null) | null, googleCalendars?: readonly ExternalCalendar[]): SourceVerdict {
  if (provenance.some((p) => p.provider === dest.provider && p.calendarId === dest.calendarId)) return 'same';
  if (!destCal || !lookup) return 'none';
  let unknown = false;
  for (const p of provenance) {
    if (p.provider === dest.provider) continue;
    const src = lookup(p) ?? stubCalendar(p);
    const v: EquivalenceVerdict = sameUnderlyingCalendar(src, destCal, { googleCalendars });
    if (v === 'equivalent') return 'equivalent';
    if (v === 'unknown') unknown = true;
  }
  return unknown ? 'unknown' : 'none';
}

const findCal = (calendars: readonly ExternalCalendar[] | undefined, ref: Pick<CalendarRef, 'provider' | 'calendarId'>) =>
  calendars?.find((c) => c.provider === ref.provider && c.calendarId === ref.calendarId) ?? null;

/**
 * Plan the automatic export of one session. Pure. Pass the session's import
 * provenance: an imported session without provenance is never forwarded
 * (its source cannot be ruled out).
 */
export function eligibleDestinations(
  session: Session,
  category: Pick<Category, 'id' | 'name'> | null,
  config: AutoExportConfig,
  provenance: readonly SourceRecord[] = [],
  opts: PlanOptions = {},
): DestinationPlan {
  const plan: DestinationPlan = { sessionId: session.id, eligible: [], excluded: [], pair: null };
  const exclude = (code: ExclusionCode, provider: ProviderKind | null = null, ref: CalendarRef | null = null): DestinationPlan => {
    plan.excluded.push({ code, message: AUTO_EXPORT_STRINGS.exclusion[code], provider, ref });
    return plan;
  };

  if (!config.enabled) return exclude('disabled');
  if (!category || category.id !== session.categoryId) return exclude('category_missing');
  if (!inScope(config, category.id)) return exclude('out_of_scope');
  if (session.origin === 'import') {
    if (!config.forwardImported) return exclude('imported_not_forwarded');
    if (!provenance.length) return exclude('imported_source_unknown');
  }
  const set = destinationsFor(config, category.id);
  const candidates: Array<{ provider: ProviderKind; ref: CalendarRef; labelId: string | null }> = [];
  if (set.google) candidates.push({ provider: 'google', ref: googleRef(set.google), labelId: set.google.labelId });
  if (set.apple) candidates.push({ provider: 'apple', ref: appleRef(set.apple), labelId: null });
  if (!candidates.length) return exclude('no_destination');

  const approval = representationApproval(session.timing.state, config.representation);
  const googleCals = opts.calendars?.filter((c) => c.provider === 'google');
  const lookup = opts.calendars ? (p: SourceRecord) => findCal(opts.calendars, p) : null;

  for (const c of candidates) {
    const sv = sourceVerdict(c.ref, provenance, findCal(opts.calendars, c.ref), lookup, googleCals);
    if (sv === 'same') {
      exclude('source_calendar', c.provider, c.ref);
      continue;
    }
    if (sv === 'equivalent') {
      exclude('source_calendar_equivalent', c.provider, c.ref);
      continue;
    }
    const opId = exportOpId(session.id, c.ref);
    let review: ReviewNote | null = sv === 'unknown' ? reviewNote('source_calendar_unknown') : null;
    if (!review && !approval.approved) review = approval.review;
    if (!review) {
      const res = draftFor(session, category.name, opId, c.provider, { ...settingsFrom(config), labelId: c.labelId }, approval.approved ? approval.startOnlySpanMin : null);
      if (res.status === 'invalid') review = reviewNote('invalid_timing', res.representation.disclosure);
      else if (res.status === 'pending_representation') review = reviewNote('start_only_not_approved');
    }
    plan.eligible.push({ provider: c.provider, ref: c.ref, labelId: c.labelId, opId, review });
  }

  const g = plan.eligible.find((d) => d.provider === 'google');
  const a = plan.eligible.find((d) => d.provider === 'apple');
  if (g && a) {
    plan.pair = { google: g.ref, apple: a.ref, googleOpId: g.opId, appleOpId: a.opId };
    const gCal = findCal(opts.calendars, g.ref);
    const aCal = findCal(opts.calendars, a.ref);
    if (gCal && aCal) {
      const gate = gateBothDestinations(gCal, aCal, isPairResolved(config, g.ref, a.ref) ? 'resolved_distinct' : null, { googleCalendars: googleCals });
      if (!gate.allowed) {
        const note = reviewNote(gate.code === 'equivalent' ? 'both_equivalent' : 'both_unresolved');
        g.review = g.review ?? note;
        a.review = a.review ?? note;
      }
    }
  }
  return plan;
}

// ─── job payload ─────────────────────────────────────────────────────────────

interface JobSettings {
  labelId: string | null;
  title: TitleRules;
  includeNotes: boolean;
  includeLocation: boolean;
  representation: RepresentationRules;
}

/** Stored on each auto job: the settings approved when it was queued. */
export interface AutoJobPayload extends JobSettings {
  v: 1;
  source: 'auto_export';
  categoryId: string;
  /** Activity name when queued (the current name is used when the job runs). */
  categoryName: string;
  pair: JobPair | null;
  /** Export-only span approved for this item from the review. */
  approvedSpanMin: number | null;
  /** The user chose to create a separate event despite a possible duplicate. */
  allowSeparate: boolean;
  /** Why the job is waiting without counting an attempt. */
  deferred: 'offline' | 'rate_limit' | null;
  review: { code: ReviewCode; eventIds: string[] } | null;
  /** Outgoing date of the last write attempt (reconciliation window). */
  attemptedDate: LocalDate | null;
  /**
   * The destination calendar as last listed by its provider. Lets the "Both"
   * rule be evaluated when that provider is momentarily unreachable.
   */
  calendar: ExternalCalendar | null;
}

const settingsFrom = (config: AutoExportConfig): Omit<JobSettings, 'labelId'> => ({
  title: { ...config.title },
  includeNotes: config.includeNotes,
  includeLocation: config.includeLocation,
  representation: normRepresentation(config.representation),
});

function isRef(x: unknown, provider: ProviderKind): x is CalendarRef {
  return isObj(x) && x.provider === provider && nonEmpty(x.accountId) && nonEmpty(x.calendarId);
}

/** Read a job payload written by this module; null when it is not one. */
export function parsePayload(raw: unknown): AutoJobPayload | null {
  if (!isObj(raw) || raw.source !== 'auto_export' || !nonEmpty(raw.categoryId)) return null;
  const title = isObj(raw.title) ? raw.title : {};
  const p = isObj(raw.pair) ? raw.pair : null;
  const pair: JobPair | null =
    p && isRef(p.google, 'google') && isRef(p.apple, 'apple') && nonEmpty(p.googleOpId) && nonEmpty(p.appleOpId)
      ? { google: p.google, apple: p.apple, googleOpId: p.googleOpId, appleOpId: p.appleOpId }
      : null;
  const review = isObj(raw.review) && nonEmpty(raw.review.code) && raw.review.code in AUTO_EXPORT_STRINGS.review
    ? { code: raw.review.code as ReviewCode, eventIds: Array.isArray(raw.review.eventIds) ? raw.review.eventIds.filter(nonEmpty) : [] }
    : null;
  return {
    v: 1,
    source: 'auto_export',
    categoryId: raw.categoryId,
    categoryName: typeof raw.categoryName === 'string' ? raw.categoryName : '',
    labelId: nonEmpty(raw.labelId) ? raw.labelId : null,
    title: { prefix: typeof title.prefix === 'string' ? title.prefix : '', suffix: typeof title.suffix === 'string' ? title.suffix : '' },
    includeNotes: raw.includeNotes === true,
    includeLocation: raw.includeLocation === true,
    representation: normRepresentation(raw.representation),
    pair,
    approvedSpanMin: validSpanMin(raw.approvedSpanMin as number),
    allowSeparate: raw.allowSeparate === true,
    deferred: raw.deferred === 'offline' || raw.deferred === 'rate_limit' ? raw.deferred : null,
    review,
    attemptedDate: typeof raw.attemptedDate === 'string' ? raw.attemptedDate : null,
    calendar: isCalendar(raw.calendar) ? raw.calendar : null,
  };
}

function isCalendar(x: unknown): x is ExternalCalendar {
  return isObj(x) && (x.provider === 'google' || x.provider === 'apple') && nonEmpty(x.calendarId) && typeof x.accountId === 'string' && typeof x.title === 'string' && typeof x.accountLabel === 'string' && typeof x.isPrimary === 'boolean';
}

function draftFor(session: Session, categoryName: string, opId: string, provider: ProviderKind, s: JobSettings, startOnlySpanMin: number | null): DraftResult {
  return buildEventDraft(session, {
    categoryName,
    opId,
    prefix: s.title.prefix,
    suffix: s.title.suffix,
    includeNotes: s.includeNotes,
    includeLocation: s.includeLocation,
    startOnlySpanMin,
    colorId: provider === 'google' ? s.labelId : null,
  });
}

// ─── enqueue ─────────────────────────────────────────────────────────────────

export type EnqueueSkipCode = ExclusionCode | keyof typeof AUTO_EXPORT_STRINGS.skip;

export interface EnqueueResult {
  /** Jobs for the planned destinations: newly queued or already open for the same operation. */
  jobs: ExportJobRecord[];
  created: number;
  needsReview: number;
  skipped: Array<{ sessionId: string; provider: ProviderKind | null; code: EnqueueSkipCode; message: string }>;
}

/**
 * Queue automatic export jobs for sessions that were just committed locally.
 * Never throws for a single session (local saving must not be affected):
 * problems are reported in `skipped`. Idempotent: an operation that already
 * has a link or a job (open or closed) is not queued again.
 */
export async function enqueueForSessions(
  repos: Repositories,
  sessions: readonly Session[],
  categories: readonly Pick<Category, 'id' | 'name'>[],
  config: AutoExportConfig,
  opts: PlanOptions = {},
): Promise<EnqueueResult> {
  const out: EnqueueResult = { jobs: [], created: 0, needsReview: 0, skipped: [] };
  if (!config.enabled) {
    for (const s of sessions) out.skipped.push({ sessionId: s.id, provider: null, code: 'disabled', message: AUTO_EXPORT_STRINGS.exclusion.disabled });
    return out;
  }
  const byOp = new Map<string, ExportJobRecord[]>();
  for (const j of await repos.exportJobs.list()) byOp.set(j.opId, [...(byOp.get(j.opId) ?? []), j]);

  for (const session of sessions) {
    try {
      const category = categories.find((c) => c.id === session.categoryId) ?? null;
      const provenance = await repos.provenance.listBySession(session.id);
      const plan = eligibleDestinations(session, category, config, provenance, opts);
      for (const x of plan.excluded) out.skipped.push({ sessionId: session.id, provider: x.provider, code: x.code, message: x.message });

      for (const d of plan.eligible) {
        if (await repos.exportLinks.byOp(d.opId)) {
          out.skipped.push({ sessionId: session.id, provider: d.provider, code: 'already_exported', message: AUTO_EXPORT_STRINGS.skip.already_exported });
          continue;
        }
        const prior = byOp.get(d.opId) ?? [];
        const open = prior.find((j) => OPEN_JOB_STATUSES.includes(j.status));
        if (open) {
          out.jobs.push(open);
          continue;
        }
        if (prior.length) {
          out.skipped.push({ sessionId: session.id, provider: d.provider, code: 'already_queued', message: AUTO_EXPORT_STRINGS.skip.already_queued });
          continue;
        }
        const payload: AutoJobPayload = {
          v: 1,
          source: 'auto_export',
          categoryId: session.categoryId,
          categoryName: category?.name ?? '',
          ...settingsFrom(config),
          labelId: d.labelId,
          pair: plan.pair,
          approvedSpanMin: null,
          allowSeparate: false,
          deferred: null,
          review: d.review ? { code: d.review.code, eventIds: [] } : null,
          attemptedDate: null,
          calendar: findCal(opts.calendars, d.ref),
        };
        const job = await repos.exportJobs.enqueue({
          opId: d.opId,
          sessionId: session.id,
          provider: d.provider,
          accountId: d.ref.accountId,
          calendarId: d.ref.calendarId,
          kind: 'auto',
          payload,
          status: d.review ? 'needs_review' : 'pending',
          reviewReason: d.review?.message ?? null,
        });
        byOp.set(d.opId, [...prior, job]);
        out.jobs.push(job);
        out.created++;
        if (job.status === 'needs_review') out.needsReview++;
      }
    } catch {
      out.skipped.push({ sessionId: session.id, provider: null, code: 'error', message: AUTO_EXPORT_STRINGS.skip.error });
    }
  }
  return out;
}

// ─── backoff ─────────────────────────────────────────────────────────────────

/** Retry delays after the 1st, 2nd, 3rd, 4th and every later failed attempt. */
export const BACKOFF_SCHEDULE_MS: readonly number[] = Object.freeze([60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000]);

/** Re-check interval while offline (a reconnection run processes the job immediately). */
export const OFFLINE_RECHECK_MS = 60_000;

/** Delay before the next attempt after `attempt` failed attempts (≥ 1); a provider's Retry-After wins when longer. */
export function backoffDelayMs(attempt: number, retryAfterMs?: number | null): number {
  const n = Number.isFinite(attempt) ? Math.max(1, Math.floor(attempt)) : 1;
  const base = BACKOFF_SCHEDULE_MS[Math.min(n, BACKOFF_SCHEDULE_MS.length) - 1];
  const ra = typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : 0;
  return Math.max(base, ra);
}

// ─── running jobs ────────────────────────────────────────────────────────────

export interface RunJobsInput {
  repos: Repositories;
  providers: Partial<Record<ProviderKind, CalendarProvider | null>>;
  /** Known connection states (fetched from the provider when missing). */
  connections?: Partial<Record<ProviderKind, Connection | null>>;
  now?: Date | (() => Date);
  isOnline?: boolean | (() => boolean | Promise<boolean>);
  /** Defaults to the stored configuration (used for "Both" resolutions). */
  config?: AutoExportConfig;
  /** Maximum number of jobs processed in this run. */
  limit?: number;
}

export interface JobRunOutcome {
  jobId: string;
  opId: string;
  sessionId: string;
  provider: ProviderKind;
  status: ExportJobStatus;
  /** Italian reason / error for anything but success. */
  message: string | null;
  eventId: string | null;
}

export interface RunJobsResult {
  processed: number;
  online: boolean;
  outcomes: JobRunOutcome[];
}

type Outcome =
  | { kind: 'succeeded'; attempted: boolean; eventId: string | null }
  | { kind: 'review'; note: ReviewNote; attempted: boolean; eventIds?: string[] }
  | { kind: 'failed'; message: string; retryAfterMs?: number | null; keepUncertain: boolean }
  | { kind: 'uncertain'; message: string }
  | { kind: 'offline'; message: string; keepUncertain: boolean }
  | { kind: 'deferred'; untilMs: number; message: string }
  | { kind: 'cancelled'; message: string };

type ConnResult = { ok: true; conn: Connection } | { ok: false; error: unknown };
type CalResult = { ok: true; calendars: ExternalCalendar[] } | { ok: false; error: unknown; retryable: boolean; message: string };

const errMessage = (e: unknown): string => (e instanceof Error && e.message ? e.message : AUTO_EXPORT_STRINGS.error.generic);

const locks = new WeakMap<object, Promise<unknown>>();
function withLock<T>(key: object, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  locks.set(key, run.then(() => undefined, () => undefined));
  return run;
}

/** Process due automatic export jobs. Runs are serialised per repository. */
export function runJobs(input: RunJobsInput): Promise<RunJobsResult> {
  return withLock(input.repos.exportJobs, () => runJobsNow(input));
}

async function runJobsNow(input: RunJobsInput): Promise<RunJobsResult> {
  const { repos } = input;
  const S = AUTO_EXPORT_STRINGS;
  const clock = (): Date => (typeof input.now === 'function' ? input.now() : (input.now ?? new Date()));
  const nowMs = () => clock().getTime();
  const iso = (ms: number) => new Date(ms).toISOString();
  let online = typeof input.isOnline === 'function' ? await input.isOnline() : (input.isOnline ?? true);
  const config = input.config ?? (await loadConfig(repos));

  // A job left 'running' by an interrupted run may have been written: reconcile before any retry.
  for (const j of await repos.exportJobs.list(['running'])) {
    if (j.kind === 'auto') await repos.exportJobs.update(j.id, { status: 'uncertain', lastError: S.error.uncertain, nextAttemptAt: iso(nowMs()) });
  }

  const allJobs = await repos.exportJobs.list();
  const jobsByOp = new Map<string, ExportJobRecord[]>();
  for (const j of allJobs) jobsByOp.set(j.opId, [...(jobsByOp.get(j.opId) ?? []), j]);
  const remember = (j: ExportJobRecord, status: ExportJobStatus, payload: AutoJobPayload | null) => {
    const list = jobsByOp.get(j.opId) ?? [];
    jobsByOp.set(j.opId, list.map((x) => (x.id === j.id ? { ...x, status, payload: payload ?? x.payload } : x)));
  };

  const candidates = new Map<string, ExportJobRecord>();
  for (const j of await repos.exportJobs.due(iso(nowMs()))) if (j.kind === 'auto') candidates.set(j.id, j);
  if (online) {
    for (const j of allJobs) {
      if (j.kind === 'auto' && (j.status === 'pending' || j.status === 'failed' || j.status === 'uncertain') && parsePayload(j.payload)?.deferred === 'offline') candidates.set(j.id, j);
    }
  }
  const queue = [...candidates.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, input.limit ?? Infinity);

  // Per-run caches.
  const connCache = new Map<ProviderKind, Promise<ConnResult>>();
  const connectionOf = (kind: ProviderKind): Promise<ConnResult> => {
    let p = connCache.get(kind);
    if (!p) {
      const given = input.connections?.[kind];
      const provider = input.providers[kind];
      p = given
        ? Promise.resolve<ConnResult>({ ok: true, conn: given })
        : provider
          ? provider.getConnection().then(
              (conn): ConnResult => ({ ok: true, conn }),
              (error): ConnResult => ({ ok: false, error }),
            )
          : Promise.resolve<ConnResult>({ ok: false, error: new ProviderError('unavailable', S.error.noProvider) });
      connCache.set(kind, p);
    }
    return p;
  };
  const calCache = new Map<ProviderKind, Promise<CalResult>>();
  const calendarsOf = (kind: ProviderKind): Promise<CalResult> => {
    let p = calCache.get(kind);
    if (!p) {
      p = (async (): Promise<CalResult> => {
        const provider = input.providers[kind];
        if (!provider) return { ok: false, error: null, retryable: false, message: S.error.noProvider };
        const c = await connectionOf(kind);
        if (!c.ok) return { ok: false, error: c.error, retryable: c.error instanceof ProviderError && c.error.retryable, message: errMessage(c.error) };
        if (c.conn.status !== 'connected' && c.conn.status !== 'write_only') return { ok: false, error: null, retryable: false, message: c.conn.detail ?? S.error.disconnected };
        try {
          return { ok: true, calendars: await provider.listCalendars() };
        } catch (error) {
          return { ok: false, error, retryable: error instanceof ProviderError && error.retryable, message: errMessage(error) };
        }
      })();
      calCache.set(kind, p);
    }
    return p;
  };
  const blockedUntil = new Map<ProviderKind, number>();

  const outcomes: JobRunOutcome[] = [];
  for (const job of queue) {
    const payload = parsePayload(job.payload);
    let eventId: string | null = null;
    let outcome: Outcome;
    try {
      outcome = await processJob(job, payload);
    } catch (e) {
      // Unexpected failure outside a provider write (e.g. storage): retry later, keep reconciliation duty.
      outcome = { kind: 'failed', message: errMessage(e), keepUncertain: job.status === 'uncertain' };
    }
    if (outcome.kind === 'succeeded') eventId = outcome.eventId;
    const status = await apply(job, payload, outcome);
    remember(job, status, payload);
    outcomes.push({
      jobId: job.id,
      opId: job.opId,
      sessionId: job.sessionId,
      provider: job.provider,
      status,
      message: outcome.kind === 'succeeded' ? null : outcome.kind === 'review' ? outcome.note.message : outcome.message,
      eventId,
    });
  }
  return { processed: outcomes.length, online, outcomes };

  // ── per job ────────────────────────────────────────────────────────────────

  async function processJob(job: ExportJobRecord, payload: AutoJobPayload | null): Promise<Outcome> {
    let mustReconcile = job.status === 'uncertain';
    const failed = (message: string, retryAfterMs: number | null = null): Outcome => ({ kind: 'failed', message, retryAfterMs, keepUncertain: mustReconcile });
    const review = (code: ReviewCode, message?: string, eventIds?: string[]): Outcome => ({ kind: 'review', note: reviewNote(code, message), attempted: false, eventIds });

    if (!payload) return review('invalid_payload');
    const session = await repos.sessions.get(job.sessionId);
    if (!session) return { kind: 'cancelled', message: S.cancelled.sessionMissing };

    // Already written for this operation (local record; works offline).
    const existing = await repos.exportLinks.byOp(job.opId);
    if (existing) return { kind: 'succeeded', attempted: false, eventId: existing.externalEventId };

    if (!online) return { kind: 'offline', message: S.error.offline, keepUncertain: mustReconcile };
    const provider = input.providers[job.provider];
    if (!provider) return failed(S.error.noProvider);
    const blocked = blockedUntil.get(job.provider);
    if (blocked != null && blocked > nowMs()) return { kind: 'deferred', untilMs: blocked, message: S.error.rateLimited };

    const providerError = (e: unknown, phase: 'read' | 'write'): Outcome => {
      if (!(e instanceof ProviderError)) return phase === 'write' ? { kind: 'uncertain', message: S.error.uncertain } : failed(errMessage(e));
      switch (e.code) {
        case 'offline':
          online = false;
          return { kind: 'offline', message: S.error.offline, keepUncertain: mustReconcile || phase === 'write' };
        case 'rate_limited': {
          const delay = backoffDelayMs(job.attempts + 1, e.retryAfterMs);
          blockedUntil.set(job.provider, nowMs() + delay);
          return failed(S.error.rateLimited, e.retryAfterMs);
        }
        case 'unauthorized':
          return failed(S.error.unauthorized);
        case 'forbidden':
          return phase === 'write' ? review('calendar_read_only') : review('not_checked');
        case 'not_found':
          return review('calendar_not_found');
        case 'invalid':
          return review('invalid_event', e.message ? `${S.review.invalid_event} ${e.message}` : undefined);
        default:
          // conflict / uncertain / unavailable / unknown during a write: it may have been applied.
          return phase === 'write' ? { kind: 'uncertain', message: S.error.uncertain } : failed(e.message || S.error.generic);
      }
    };

    // Connection.
    const cr = await connectionOf(job.provider);
    if (!cr.ok) return providerError(cr.error, 'read');
    const conn = cr.conn;
    switch (conn.status) {
      case 'connected':
        break;
      case 'write_only':
        return review('write_only');
      case 'denied':
        return failed(conn.detail ?? t.permissionDenied);
      case 'not_configured':
        return failed(conn.detail ?? t.notConfigured);
      case 'unavailable':
        return failed(conn.detail ?? t.unavailablePlatform);
      default:
        return failed(conn.detail ?? S.error.disconnected);
    }
    if (!conn.canRead) return review('write_only');
    if (!conn.canWrite) return failed(S.error.readOnlyAccess);
    if (job.provider === 'google' && conn.accountId && !sameAccount('google', conn.accountId, job.accountId)) {
      return failed(S.error.accountMismatch(conn.accountLabel ?? conn.accountId, job.accountId));
    }

    // Destination calendar.
    const own = await calendarsOf(job.provider);
    if (!own.ok) return own.error ? providerError(own.error, 'read') : failed(own.message);
    const cal = own.calendars.find((c) => c.calendarId === job.calendarId) ?? null;
    if (!cal) return review('calendar_not_found');
    if (!cal.canWrite) return review('calendar_read_only');
    if (!cal.canRead) return review('not_checked');
    payload.calendar = cal;

    const category = await repos.categories.get(session.categoryId);
    const categoryName = category?.name ?? payload.categoryName;
    const storeLink = (ev: ExternalEvent, status: 'created' | 'linked', snapshot: ExportSnapshot): Promise<ExportLinkRecord> =>
      repos.exportLinks.upsert({
        sessionId: session.id,
        provider: job.provider,
        accountId: job.accountId,
        calendarId: job.calendarId,
        externalEventId: ev.eventId,
        occurrenceKey: ev.occurrenceKey,
        status,
        opId: job.opId,
        snapshot,
        exportedAt: iso(nowMs()),
      });
    const metaOf = (ev: ExternalEvent): Pick<AppEventMeta, 'timingState' | 'durationSec' | 'durationSource' | 'schedulingPlaceholder'> => {
      if (ev.appMeta) return ev.appMeta;
      const tm = session.timing;
      const known = tm.durationSec != null && tm.durationSec > 0 ? tm.durationSec : null;
      return { timingState: tm.state, durationSec: known, durationSource: known != null ? tm.durationSource : null, schedulingPlaceholder: false };
    };

    // An earlier write may have been applied: look for it before anything else.
    if (mustReconcile) {
      const dates = [session.date, payload.attemptedDate ?? session.date].sort(compareDates);
      let found: ExternalEvent | null;
      try {
        found = await provider.findByOpId(job.calendarId, job.opId, { from: addDays(dates[0], -1), to: addDays(dates[1], 1) });
      } catch (e) {
        return providerError(e, 'read');
      }
      if (found && found.status !== 'cancelled' && found.appMeta?.opId === job.opId) {
        await storeLink(found, 'created', snapshotFromEvent(found, metaOf(found), categoryName));
        return { kind: 'succeeded', attempted: true, eventId: found.eventId };
      }
      mustReconcile = false;
    }

    // Never back into the source calendar (directly or through the other route).
    const provenance = await repos.provenance.listBySession(session.id);
    if (provenance.length) {
      const others = [...new Set(provenance.filter((p) => p.provider !== job.provider).map((p) => p.provider))];
      const lists: Partial<Record<ProviderKind, ExternalCalendar[]>> = { [job.provider]: own.calendars };
      for (const k of others) {
        const r = await calendarsOf(k);
        if (r.ok) lists[k] = r.calendars;
      }
      const sv = sourceVerdict(job, provenance, cal, (p) => findCal(lists[p.provider], p), lists.google);
      if (sv === 'same' || sv === 'equivalent') return { kind: 'cancelled', message: S.cancelled.sourceCalendar };
      if (sv === 'unknown') return review('source_calendar_unknown');
    }

    // "Both": never write the same underlying calendar twice.
    if (payload.pair) {
      const gate = await pairGate(job, payload.pair, cal);
      if (gate) return gate.kind === 'review' ? review(gate.code) : failed(gate.message);
    }

    // Representation approved by the rules (or by an approval from the review)?
    const approval = representationApproval(session.timing.state, payload.representation, payload.approvedSpanMin);
    if (!approval.approved) return { kind: 'review', note: approval.review, attempted: false };
    const res = draftFor(session, categoryName, job.opId, job.provider, payload, approval.startOnlySpanMin);
    if (res.status === 'invalid') return review('invalid_timing', res.representation.disclosure);
    if (res.status === 'pending_representation') return review('start_only_not_approved');
    const draft: EventDraft = res.draft;

    // Duplicate check against the real destination.
    const destLinks = await repos.exportLinks.byDestination(job.provider, job.accountId, job.calendarId);
    const priorLinks = await repos.exportLinks.bySession(session.id);
    const importSources = provenance
      .filter((p) => p.sessionId != null && p.provider === job.provider && p.calendarId === job.calendarId)
      .map((p) => ({ sessionId: p.sessionId as string, externalEventId: p.externalEventId, occurrenceKey: p.occurrenceKey }));
    let events: ExternalEvent[];
    try {
      events = await readDestination(provider, job, draft, destLinks.filter((l) => l.sessionId === session.id));
    } catch (e) {
      return providerError(e, 'read');
    }
    const [check] = classifyDuplicates(
      [{ session, opId: job.opId, draft, finalTitle: res.title.final, baseTitle: res.title.base, date: res.representation.outgoingDate }],
      { categoryName, prefix: payload.title.prefix, suffix: payload.title.suffix, links: destLinks, priorLinks, importSources, events },
    );
    switch (check.class) {
      case 'already_exported':
      case 'linked_changed':
        // Exported earlier under another record; local edits never overwrite calendar events automatically.
        return { kind: 'succeeded', attempted: true, eventId: check.event?.eventId ?? check.link?.externalEventId ?? null };
      case 'recognized':
        if (check.recognizedBy === 'import_source') return { kind: 'cancelled', message: S.cancelled.importSourceEvent };
        if (check.event) {
          await storeLink(check.event, check.recognizedBy === 'op_id' ? 'created' : 'linked', snapshotFromEvent(check.event, metaOf(check.event), categoryName));
          return { kind: 'succeeded', attempted: true, eventId: check.event.eventId };
        }
        return review('possible_duplicate');
      case 'possible_duplicate':
        if (!payload.allowSeparate) return review('possible_duplicate', undefined, check.candidates.map((c) => c.event.eventId));
        break;
      case 'not_checked':
        return review('not_checked');
      case 'new':
        break;
    }

    // Write.
    await repos.exportJobs.update(job.id, { status: 'running', payload: { ...payload, attemptedDate: draft.start.date } });
    payload.attemptedDate = draft.start.date;
    let created: ExternalEvent;
    try {
      created = await provider.createEvent(job.calendarId, draft);
    } catch (e) {
      return providerError(e, 'write');
    }
    try {
      await storeLink(created, 'created', snapshotFromDraft(draft, categoryName));
    } catch {
      return { kind: 'uncertain', message: S.error.storeFailed };
    }
    return { kind: 'succeeded', attempted: true, eventId: created.eventId };
  }

  /**
   * The "Both" rule at write time. Needs a descriptor of the other route's
   * calendar (live, else as last listed by the other job). Without one, writing
   * is still safe while the other route has not written: before it can write,
   * it must pass this same check against this destination.
   */
  async function pairGate(job: ExportJobRecord, pair: JobPair, ownCal: ExternalCalendar): Promise<{ kind: 'review'; code: 'both_equivalent' | 'both_unresolved' } | { kind: 'failed'; message: string } | null> {
    const siblingKind: ProviderKind = job.provider === 'google' ? 'apple' : 'google';
    const siblingRef = siblingKind === 'google' ? pair.google : pair.apple;
    const siblingOp = siblingKind === 'google' ? pair.googleOpId : pair.appleOpId;
    const siblingLink = await repos.exportLinks.byOp(siblingOp);
    const siblingJobs = (jobsByOp.get(siblingOp) ?? []).filter((j) => j.id !== job.id);
    // The other route was dropped by the user (or never queued): nothing to compare with.
    if (!siblingLink && siblingJobs.every((j) => j.status === 'cancelled')) return null;

    const live = await calendarsOf(siblingKind);
    let siblingCal: ExternalCalendar | null = live.ok ? (live.calendars.find((c) => c.calendarId === siblingRef.calendarId) ?? null) : null;
    if (!siblingCal) {
      for (const j of [...siblingJobs].reverse()) {
        const stored = parsePayload(j.payload)?.calendar;
        if (stored && stored.calendarId === siblingRef.calendarId) {
          siblingCal = stored;
          break;
        }
      }
    }
    const resolved = isPairResolved(config, pair.google, pair.apple);
    if (siblingCal) {
      const googleListed = await calendarsOf('google');
      const googleList = googleListed.ok ? googleListed.calendars : undefined;
      const [g, a] = job.provider === 'google' ? [ownCal, siblingCal] : [siblingCal, ownCal];
      const gate = gateBothDestinations(g, a, resolved ? 'resolved_distinct' : null, { googleCalendars: googleList });
      if (gate.allowed) return null;
      return { kind: 'review', code: gate.code === 'equivalent' ? 'both_equivalent' : 'both_unresolved' };
    }
    if (!siblingLink || resolved) return null;
    // The other route already wrote and its calendar cannot be described now.
    if (!live.ok && live.retryable) return { kind: 'failed', message: live.message };
    return { kind: 'review', code: 'both_unresolved' };
  }

  async function readDestination(provider: CalendarProvider, job: ExportJobRecord, draft: EventDraft, sessionLinks: readonly ExportLinkRecord[]): Promise<ExternalEvent[]> {
    const last = compareDates(draft.end.date, draft.start.date) > 0 ? draft.end.date : draft.start.date;
    const listed = await provider.listEvents({ calendarIds: [job.calendarId], from: addDays(draft.start.date, -1), to: addDays(last, 1) });
    const events = listed.filter((e) => e.status !== 'cancelled' && e.calendarId === job.calendarId);
    // Linked events of this session that moved outside the window are not stale links.
    for (const l of sessionLinks) {
      if (events.some((e) => e.eventId === l.externalEventId && (e.occurrenceKey ?? null) === (l.occurrenceKey ?? null))) continue;
      const ev = await provider.getEvent(job.calendarId, l.externalEventId, l.occurrenceKey);
      if (ev && ev.status !== 'cancelled') events.push(ev);
    }
    return events;
  }

  async function apply(job: ExportJobRecord, payload: AutoJobPayload | null, o: Outcome): Promise<ExportJobStatus> {
    const now = nowMs();
    const base: AutoJobPayload | null = payload ? { ...payload, deferred: null } : null;
    const withPayload = <T extends object>(patch: T, p: AutoJobPayload | null) => (p ? { ...patch, payload: p } : patch);
    switch (o.kind) {
      case 'succeeded':
        await repos.exportJobs.update(
          job.id,
          withPayload({ status: 'succeeded' as const, attempts: job.attempts + (o.attempted ? 1 : 0), lastError: null, reviewReason: null, nextAttemptAt: null }, base && { ...base, review: null }),
        );
        return 'succeeded';
      case 'review':
        await repos.exportJobs.update(
          job.id,
          withPayload(
            { status: 'needs_review' as const, attempts: job.attempts + (o.attempted ? 1 : 0), lastError: null, reviewReason: o.note.message, nextAttemptAt: null },
            base && { ...base, review: { code: o.note.code, eventIds: o.eventIds ?? [] } },
          ),
        );
        return 'needs_review';
      case 'failed': {
        const attempts = job.attempts + 1;
        const status: ExportJobStatus = o.keepUncertain ? 'uncertain' : 'failed';
        await repos.exportJobs.update(job.id, withPayload({ status, attempts, lastError: o.message, reviewReason: null, nextAttemptAt: iso(now + backoffDelayMs(attempts, o.retryAfterMs)) }, base));
        return status;
      }
      case 'uncertain': {
        const attempts = job.attempts + 1;
        await repos.exportJobs.update(job.id, withPayload({ status: 'uncertain' as const, attempts, lastError: o.message, reviewReason: null, nextAttemptAt: iso(now + backoffDelayMs(attempts)) }, base));
        return 'uncertain';
      }
      case 'offline': {
        const status: ExportJobStatus = o.keepUncertain ? 'uncertain' : 'pending';
        await repos.exportJobs.update(job.id, withPayload({ status, lastError: o.message, nextAttemptAt: iso(now + OFFLINE_RECHECK_MS) }, payload && { ...payload, deferred: 'offline' as const }));
        return status;
      }
      case 'deferred': {
        // Not attempted (the provider is rate limited in this run): keep the status, wait for the window.
        const status: ExportJobStatus = job.status === 'running' ? 'pending' : job.status;
        await repos.exportJobs.update(job.id, withPayload({ status, lastError: o.message, nextAttemptAt: iso(o.untilMs) }, payload && { ...payload, deferred: 'rate_limit' as const }));
        return status;
      }
      case 'cancelled':
        await repos.exportJobs.update(job.id, { status: 'cancelled', reviewReason: o.message, nextAttemptAt: null });
        return 'cancelled';
    }
  }
}

// ─── review actions ──────────────────────────────────────────────────────────

export type ReviewAction =
  /** Do not export this item (safe default for duplicates; "choose one route" for equivalent destinations). */
  | { kind: 'skip' }
  /** Re-evaluate, optionally with the current configuration's title/content/representation rules. */
  | { kind: 'retry'; config?: AutoExportConfig }
  /** Approve an export-only scheduling span for this start-only session. */
  | { kind: 'approve_span'; minutes: number }
  /** Possible duplicate: deliberately create a separate event. */
  | { kind: 'create_separate' }
  /** Link an existing event in the job's destination without changing it. */
  | { kind: 'link'; event: ExternalEvent };

/** Apply the user's decision on an open automatic job. Never deletes or edits calendar events. */
export async function resolveReviewJob(repos: Repositories, jobId: string, action: ReviewAction, opts: { now?: () => Date } = {}): Promise<ExportJobRecord> {
  const now = () => (opts.now ? opts.now() : new Date()).toISOString();
  const find = async () => (await repos.exportJobs.list()).find((j) => j.id === jobId) ?? null;
  const job = await find();
  if (!job) throw new DomainError('job_missing', jobId);
  if (job.kind !== 'auto') throw new DomainError('not_auto_job', jobId);
  if (job.status === 'running' || job.status === 'succeeded' || job.status === 'cancelled') throw new DomainError('job_not_open', jobId);
  const payload = parsePayload(job.payload);
  // A retry keeps the reconciliation duty of an uncertain job.
  const reopen = job.status === 'uncertain' ? ('uncertain' as const) : ('pending' as const);
  const cleared = { reviewReason: null, lastError: null, nextAttemptAt: null };

  switch (action.kind) {
    case 'skip':
      await repos.exportJobs.update(job.id, { status: 'cancelled', reviewReason: AUTO_EXPORT_STRINGS.cancelled.userSkipped, nextAttemptAt: null });
      break;
    case 'retry': {
      if (!payload) throw new DomainError('invalid_payload', jobId);
      let next: AutoJobPayload = { ...payload, review: null, deferred: null };
      if (action.config) {
        const c = normalizeConfig(action.config);
        const set = destinationsFor(c, payload.categoryId);
        const labelId = job.provider === 'google' && set.google?.calendarId === job.calendarId ? set.google.labelId : payload.labelId;
        next = { ...next, ...settingsFrom(c), labelId };
      }
      await repos.exportJobs.update(job.id, { status: reopen, ...cleared, payload: next });
      break;
    }
    case 'approve_span': {
      if (!payload) throw new DomainError('invalid_payload', jobId);
      const m = validSpanMin(action.minutes);
      if (m == null) throw new DomainError('invalid_span', String(action.minutes));
      await repos.exportJobs.update(job.id, { status: reopen, ...cleared, payload: { ...payload, approvedSpanMin: m, review: null, deferred: null } });
      break;
    }
    case 'create_separate': {
      if (!payload) throw new DomainError('invalid_payload', jobId);
      if (payload.review?.code !== 'possible_duplicate') throw new DomainError('action_not_allowed', 'create_separate');
      await repos.exportJobs.update(job.id, { status: reopen, ...cleared, payload: { ...payload, allowSeparate: true, review: null, deferred: null } });
      break;
    }
    case 'link': {
      const ev = action.event;
      if (ev.provider !== job.provider || ev.calendarId !== job.calendarId || ev.status === 'cancelled') throw new DomainError('invalid_link_target', ev.eventId);
      const session = await repos.sessions.get(job.sessionId);
      if (!session) throw new DomainError('session_missing', job.sessionId);
      const category = await repos.categories.get(session.categoryId);
      const tm = session.timing;
      const known = tm.durationSec != null && tm.durationSec > 0 ? tm.durationSec : null;
      await repos.exportLinks.upsert({
        sessionId: session.id,
        provider: job.provider,
        accountId: job.accountId,
        calendarId: job.calendarId,
        externalEventId: ev.eventId,
        occurrenceKey: ev.occurrenceKey,
        status: 'linked',
        opId: job.opId,
        snapshot: snapshotFromEvent(
          ev,
          { timingState: tm.state, durationSec: known, durationSource: known != null ? tm.durationSource : null, schedulingPlaceholder: ev.appMeta?.schedulingPlaceholder ?? false },
          category?.name ?? payload?.categoryName ?? '',
        ),
        exportedAt: now(),
      });
      await repos.exportJobs.update(job.id, { status: 'succeeded', ...cleared });
      break;
    }
  }
  return (await find()) as ExportJobRecord;
}

// ─── disable ─────────────────────────────────────────────────────────────────

/**
 * Turn automatic export off: no new jobs are queued from now on. With
 * `cancelPending`, open automatic jobs are cancelled; otherwise they stay
 * visible and are still processed (they were queued while it was on).
 * Exported events are never deleted or modified.
 */
export async function disableAutoExport(repos: Repositories, opts: { cancelPending: boolean }): Promise<{ config: AutoExportConfig; cancelled: number }> {
  const config = await saveConfig(repos, { ...(await loadConfig(repos)), enabled: false });
  const cancelled = opts.cancelPending ? await repos.exportJobs.cancelOpen({ kind: 'auto' }) : 0;
  return { config, cancelled };
}

// ─── summary for badges ──────────────────────────────────────────────────────

export interface JobsSummary {
  total: number;
  counts: Record<ExportJobStatus, number>;
  /** pending + running + failed + uncertain + needs_review */
  open: number;
  needsReview: number;
  /** failed + uncertain (will be retried / reconciled). */
  retrying: number;
  /** pending + running */
  waiting: number;
  byProvider: Record<ProviderKind, { open: number; needsReview: number; succeeded: number }>;
  badge: { tone: 'review' | 'pending' | 'none'; count: number; label: string | null };
}

export function summarizeJobs(jobs: readonly Pick<ExportJobRecord, 'status' | 'provider'>[]): JobsSummary {
  const counts: Record<ExportJobStatus, number> = { pending: 0, running: 0, succeeded: 0, failed: 0, uncertain: 0, needs_review: 0, cancelled: 0 };
  const byProvider: JobsSummary['byProvider'] = { google: { open: 0, needsReview: 0, succeeded: 0 }, apple: { open: 0, needsReview: 0, succeeded: 0 } };
  for (const j of jobs) {
    if (!(j.status in counts)) continue;
    counts[j.status]++;
    const p = byProvider[j.provider];
    if (!p) continue;
    if (OPEN_JOB_STATUSES.includes(j.status)) p.open++;
    if (j.status === 'needs_review') p.needsReview++;
    if (j.status === 'succeeded') p.succeeded++;
  }
  const open = counts.pending + counts.running + counts.failed + counts.uncertain + counts.needs_review;
  const badge: JobsSummary['badge'] =
    counts.needs_review > 0
      ? { tone: 'review', count: counts.needs_review, label: AUTO_EXPORT_STRINGS.badgeReview(counts.needs_review) }
      : open > 0
        ? { tone: 'pending', count: open, label: AUTO_EXPORT_STRINGS.badgePending(open) }
        : { tone: 'none', count: 0, label: null };
  return {
    total: jobs.length,
    counts,
    open,
    needsReview: counts.needs_review,
    retrying: counts.failed + counts.uncertain,
    waiting: counts.pending + counts.running,
    byProvider,
    badge,
  };
}
