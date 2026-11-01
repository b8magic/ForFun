/**
 * Calendar exchange — the facade the UI uses (`import … from '@/calendar'`).
 *
 *   Providers      getProviders / getProvider: one Google and one Apple
 *                  provider for the app's lifetime, created lazily on first
 *                  use (no OAuth, no permission prompt at launch).
 *   Connections    getConnections (never prompts), connectProvider (prompts:
 *                  call only from a user action), disconnectProvider,
 *                  canReadEvents / canWriteEvents, listCalendarsFor.
 *   Import         loadImportReview (filters → review list) → selection
 *                  helpers → commitImportSelection (one transaction).
 *   Export         loadExportReview (reads every destination, builds the
 *                  plan) → row edits / rebuildExportPlan → executeExport.
 *   Auto-export    get/set/checkAutoExportConfig, enqueueAfterSave,
 *                  runAutoExportNow, startAutoExportRuntime,
 *                  turnOffAutoExport, listExportJobs, resolveExportJob.
 *
 * The async helpers take an optional `deps` ({ repos, providers }); by
 * default they use the app database and the provider registry, both loaded
 * lazily so importing this module loads no native module by itself. The pure
 * engine functions and types are re-exported unchanged.
 *
 * Nothing here deletes or edits calendar events on its own: imports only read
 * the source calendar, exports write only the confirmed selection, automatic
 * export writes only new sessions of a configured activity, and turning it off
 * never touches exported events.
 */
import type { Category, Session } from '@/domain/types';
import type { ExportJobRecord, ExportLinkRecord, ProvenanceRecord, Repositories } from '@/data/repositories';
import { deviceTimeZone } from '@/domain/zoned';
import { ProviderError, type CalendarProvider, type Connection, type ExternalCalendar, type LabelOption, type ProviderKind } from './types';
import { buildReview, commitImport, selectedItems, type CommitImportResult, type ImportFilters, type ImportSelection, type ReviewItem } from './importEngine';
import {
  EXPORT_STRINGS,
  buildExportPlan,
  eventsOf,
  executePlan,
  loadAllDestinationEvents,
  mergeChoices,
  type DestinationRead,
  type ExecuteResult,
  type ExportDestinationInput,
  type ExportOptions,
  type ExportPlan,
} from './exportEngine';
import type { ExportOverride } from './representation';
import {
  disableAutoExport,
  loadConfig,
  resolveReviewJob,
  saveConfig,
  summarizeJobs,
  validateConfig,
  type AutoExportConfig,
  type ConfigValidation,
  type JobsSummary,
  type ReviewAction,
} from './autoExport';

// ─── re-exports: contracts ───────────────────────────────────────────────────

export { ProviderError, refKey } from './types';
export type {
  AccessRole,
  AppEventMeta,
  CalendarProvider,
  CalendarRef,
  Connection,
  ConnectionStatus,
  EventDraft,
  EventTime,
  ExternalCalendar,
  ExternalEvent,
  LabelOption,
  ListEventsQuery,
  ProviderKind,
} from './types';
export { destinationKey, exportOpId, isExportOpId } from './opId';
export { parseAppMeta } from './appMeta';

// ─── re-exports: import (pure) ───────────────────────────────────────────────

export {
  IMPORT_STRINGS,
  defaultSelection,
  deselectAll,
  labelFilterApplies,
  reconcileSelection,
  scopeAll,
  scopeKeys,
  scopeStatus,
  selectAll,
  selectedItems,
  selectionCounts,
  setSelected,
  toggleSelected,
} from './importEngine';
export type { CommitImportResult, ImportFilters, ImportSelection, ImportStatus, ReviewItem, ReviewScope, SelectionCounts as ImportSelectionCounts } from './importEngine';

// ─── re-exports: export (pure) ───────────────────────────────────────────────

export {
  EXPORT_STRINGS,
  canCheckDestination,
  canWriteDestination,
  mergeChoices,
  setRowChoice,
  setSelection,
  selectionCounts as exportSelectionCounts,
} from './exportEngine';
export type {
  DestinationRead,
  DestinationResult,
  ExecuteResult,
  ExportAction,
  ExportCounts,
  ExportDestinationInput,
  ExportOptions,
  ExportPlan,
  ExportPlanRow,
  PlanDestination,
  RowOutcome,
  RowStatus,
} from './exportEngine';
export { durationLabel, overrideToSessionPatch, REPR_STRINGS } from './representation';
export type { ApplyField, ApplyResult, ExportOverride, OutgoingTime, TimeRepresentation } from './representation';
export { resolveTitle } from './titles';
export { calendarDetails, gateBothDestinations, pairKey, sameUnderlyingCalendar } from './equivalence';
export type { BothGate, BothResolution, EquivalenceVerdict } from './equivalence';

// ─── re-exports: automatic export (pure) ─────────────────────────────────────

export {
  AUTO_EXPORT_STRINGS,
  DEFAULT_REPRESENTATION,
  JOB_STATUS_LABELS,
  appleRef,
  defaultConfig,
  googleRef,
  normalizeConfig,
  parsePayload,
  summarizeJobs,
  validateConfig,
  withBothResolved,
  withoutBothResolution,
} from './autoExport';
export type { AutoExportConfig, AutoJobPayload, ConfigIssue, ConfigValidation, DestinationSet, JobsSummary, RepresentationRules, ReviewAction } from './autoExport';

// ─── dependencies ────────────────────────────────────────────────────────────

/** Optional dependencies of the async helpers (tests, previews). Defaults: app database + provider registry. */
export interface CalendarDeps {
  repos?: Repositories;
  providers?: Partial<Record<ProviderKind, CalendarProvider>>;
}

/** Providers in display order. */
export const PROVIDER_KINDS: readonly ProviderKind[] = Object.freeze(['google', 'apple']);

/*
 * Lazy loaders (inline requires, React Native's way of deferring a module):
 * importing this facade loads none of them; each loads on first use.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const loadDatabase = (): typeof import('@/data/database') => require('@/data/database');
const loadRegistry = (): typeof import('./registry') => require('./registry');
const loadRuntime = (): typeof import('./autoRuntime') => require('./autoRuntime');
const loadIds = (): typeof import('@/platform/ids') => require('@/platform/ids');
/* eslint-enable @typescript-eslint/no-require-imports */

async function reposOf(deps?: CalendarDeps): Promise<Repositories> {
  return deps?.repos ?? loadDatabase().getRepositories();
}

async function providersOf(deps?: CalendarDeps): Promise<Partial<Record<ProviderKind, CalendarProvider>>> {
  return deps?.providers ?? loadRegistry().getProviders();
}

const errText = (e: unknown): string => (e instanceof Error && e.message ? e.message : EXPORT_STRINGS.connectionUnavailable);

// ─── providers & connections ─────────────────────────────────────────────────

/**
 * The provider registry: `{ google, apple }`, created on first call and kept
 * for the app's lifetime. Building it loads expo-auth-session / expo-calendar
 * but asks for nothing: no OAuth, no permission prompt.
 */
export async function getProviders(): Promise<Record<ProviderKind, CalendarProvider>> {
  return loadRegistry().getProviders();
}

/** One provider; throws ProviderError('unavailable') when this build has none for `kind`. */
export async function getProvider(kind: ProviderKind, deps?: CalendarDeps): Promise<CalendarProvider> {
  const p = (await providersOf(deps))[kind];
  if (!p) throw new ProviderError('unavailable', EXPORT_STRINGS.noProvider);
  return p;
}

const unavailable = (provider: ProviderKind, detail: string): Connection => ({ provider, status: 'unavailable', accountId: null, accountLabel: null, canRead: false, canWrite: false, detail });

/**
 * Current connection of every provider. Never prompts. A provider that is
 * missing or fails to answer is reported as 'unavailable' with its reason,
 * never as connected.
 */
export async function getConnections(deps?: CalendarDeps): Promise<Record<ProviderKind, Connection>> {
  const providers = await providersOf(deps);
  const entries = await Promise.all(
    PROVIDER_KINDS.map(async (k): Promise<[ProviderKind, Connection]> => {
      const p = providers[k];
      if (!p) return [k, unavailable(k, EXPORT_STRINGS.noProvider)];
      try {
        return [k, await p.getConnection()];
      } catch (e) {
        return [k, unavailable(k, errText(e))];
      }
    }),
  );
  return Object.fromEntries(entries) as Record<ProviderKind, Connection>;
}

/**
 * Interactive: Google OAuth consent or the iOS calendar permission. Call only
 * from an explicit user action ("Collega"). `read` is enough for import;
 * export needs `readwrite` (write-only access cannot check duplicates).
 */
export async function connectProvider(kind: ProviderKind, access: 'read' | 'readwrite', deps?: CalendarDeps): Promise<Connection> {
  return (await getProvider(kind, deps)).connect(access);
}

/** Forget the connection in Serie (revokes the Google grant). Calendar events are untouched. */
export async function disconnectProvider(kind: ProviderKind, deps?: CalendarDeps): Promise<Connection> {
  const p = await getProvider(kind, deps);
  await p.disconnect();
  return p.getConnection();
}

/** The connection can read events: import, inspection and duplicate checks. */
export function canReadEvents(conn: Connection | null | undefined): boolean {
  return conn?.status === 'connected' && conn.canRead;
}

/** The connection can write events (a write-only connection can, but never counts as checked). */
export function canWriteEvents(conn: Connection | null | undefined): boolean {
  return (conn?.status === 'connected' || conn?.status === 'write_only') && !!conn.canWrite;
}

export interface CalendarListing {
  connections: Record<ProviderKind, Connection>;
  /** Calendars of every provider whose connection allows `need`, Google first. */
  calendars: ExternalCalendar[];
  byProvider: Partial<Record<ProviderKind, ExternalCalendar[]>>;
  /** Google colour labels (EventKit has none: see `labelsSupported`). */
  labels: LabelOption[];
  labelsSupported: Record<ProviderKind, boolean>;
  /** Italian reason per provider whose calendars could not be listed. */
  errors: Partial<Record<ProviderKind, string>>;
}

/**
 * Calendars usable for `need` ('read' for import sources, 'write' for export
 * destinations; each calendar's own `canRead` / `canWrite` still applies).
 * Never prompts: providers that are not connected are skipped.
 */
export async function listCalendarsFor(need: 'read' | 'write', deps?: CalendarDeps): Promise<CalendarListing> {
  const providers = await providersOf(deps);
  const connections = await getConnections({ ...deps, providers });
  const out: CalendarListing = { connections, calendars: [], byProvider: {}, labels: [], labelsSupported: { google: false, apple: false }, errors: {} };
  for (const k of PROVIDER_KINDS) {
    const p = providers[k];
    if (!p) continue;
    out.labelsSupported[k] = p.capabilities.eventLabels;
    const conn = connections[k];
    if (!(need === 'read' ? canReadEvents(conn) : canWriteEvents(conn))) continue;
    try {
      const cals = await p.listCalendars();
      out.byProvider[k] = cals;
      out.calendars.push(...cals);
    } catch (e) {
      out.errors[k] = errText(e);
      continue;
    }
    // Labels are optional extras: a refusal (e.g. write-only consent) leaves the list empty.
    if (p.capabilities.eventLabels && canReadEvents(conn)) out.labels = await p.listLabels().catch(() => []);
  }
  return out;
}

// ─── import ──────────────────────────────────────────────────────────────────

export interface ImportReviewRequest {
  /** The one connection this import reads from. */
  provider: ProviderKind;
  /** Destination activity: every selected event becomes a session of it. */
  category: Pick<Category, 'id' | 'name'>;
  /** Source calendars, inclusive date range, "title contains" and label filters. */
  filters: Omit<ImportFilters, 'provider'>;
  /** Listed calendars of the provider (source labels on the rows). */
  calendars?: readonly ExternalCalendar[];
  /** Defaults to the device zone. */
  deviceTimeZone?: string;
  signal?: AbortSignal;
  onProgress?: (fetched: number) => void;
}

/**
 * Read the source calendars (every page of every chunk, cancelled occurrences
 * included so they can be shown as excluded) and build the review list against
 * local sessions, import provenance and export links. Read-only.
 */
export async function loadImportReview(req: ImportReviewRequest, deps?: CalendarDeps): Promise<ReviewItem[]> {
  const filters: ImportFilters = { ...req.filters, provider: req.provider };
  if (!filters.calendarIds.length) return [];
  const provider = await getProvider(req.provider, deps);
  const repos = await reposOf(deps);
  const events = await provider.listEvents({ calendarIds: filters.calendarIds, from: filters.from, to: filters.to, includeCancelled: true, signal: req.signal, onProgress: req.onProgress });
  // Provenance of the selected calendars, per account (an event moved between calendars is matched by time only).
  const byAccount = new Map<string, Set<string>>();
  const add = (accountId: string, calendarId: string) => byAccount.set(accountId, (byAccount.get(accountId) ?? new Set<string>()).add(calendarId));
  for (const c of req.calendars ?? []) if (c.provider === req.provider && filters.calendarIds.includes(c.calendarId)) add(c.accountId, c.calendarId);
  for (const e of events) if (e.provider === req.provider) add(e.accountId, e.calendarId);
  const provenance = (await Promise.all([...byAccount].map(([a, ids]) => repos.provenance.listForCalendars(req.provider, a, [...ids])))).flat();
  const [localSessions, exportLinks] = await Promise.all([repos.sessions.listAll(), repos.exportLinks.all()]);
  return buildReview({
    events,
    filters,
    capabilities: provider.capabilities,
    calendars: req.calendars ?? [],
    provenance,
    localSessions,
    exportLinks,
    category: req.category,
    deviceTimeZone: req.deviceTimeZone ?? deviceTimeZone(),
  });
}

export interface ImportCommitRequest {
  category: Pick<Category, 'id'>;
  items: readonly ReviewItem[];
  selection: ImportSelection;
  /** One id per confirmed import, reused by a retried confirmation (no duplicate sessions). */
  batchId: string;
  now?: string;
  newId?: () => string;
}

/**
 * Create sessions + provenance for the selected, selectable items in one
 * transaction (idempotent per batch id). Afterwards pass `result.sessions` to
 * `enqueueAfterSave` (the app's post-commit hook does this): automatic export
 * skips imported sessions unless forwarding is on.
 */
export async function commitImportSelection(req: ImportCommitRequest, deps?: CalendarDeps): Promise<CommitImportResult> {
  const repos = await reposOf(deps);
  const newId = req.newId ?? loadIds().newId;
  return commitImport(repos, { category: req.category, items: selectedItems(req.items, req.selection), batchId: req.batchId, now: req.now ?? new Date().toISOString(), newId });
}

// ─── manual export ───────────────────────────────────────────────────────────

export interface ExportReviewRequest {
  /** Sessions of ONE activity. */
  sessions: readonly Session[];
  category: Pick<Category, 'id' | 'name'>;
  /** One or two destinations (the "Both" gate is the caller's: see `gateBothDestinations`). */
  destinations: readonly ExportDestinationInput[];
  options: ExportOptions;
  signal?: AbortSignal;
}

/** What a review was built from; kept to rebuild the plan after option changes without reading again. */
export interface ExportReviewData {
  links: ExportLinkRecord[];
  provenance: ProvenanceRecord[];
  /** Per `destinationKey`: events read for the duplicate check, or null + reason when not checked. */
  reads: Record<string, DestinationRead>;
}

export interface ExportReview {
  plan: ExportPlan;
  data: ExportReviewData;
}

function overridesFor(batch: Readonly<Record<string, ExportOverride>>, dest: Readonly<Record<string, ExportOverride>> | undefined): Record<string, ExportOverride> {
  const out: Record<string, ExportOverride> = { ...batch };
  for (const [sid, o] of Object.entries(dest ?? {})) out[sid] = { ...(batch[sid] ?? {}), ...Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined)) };
  return out;
}

/**
 * Read every destination for the duplicate check (each independently, with
 * its own outgoing dates; linked and import-source events outside the window
 * are fetched individually) and build the review plan.
 */
export async function loadExportReview(req: ExportReviewRequest, deps?: CalendarDeps): Promise<ExportReview> {
  const repos = await reposOf(deps);
  const providers = await providersOf(deps);
  const links = await repos.exportLinks.all();
  const sessionIds = [...new Set(req.sessions.map((s) => s.id))];
  // Every provenance record of these sessions: source calendars (never re-created there) and original titles.
  const provenance = (await Promise.all(sessionIds.map((id) => repos.provenance.listBySession(id)))).flat();
  const reads: Record<string, DestinationRead> = {};
  for (const d of req.destinations) {
    const overrides = overridesFor(req.options.overrides, d.options?.overrides);
    Object.assign(reads, await loadAllDestinationEvents(providers, [d], req.sessions, links, { overrides, signal: req.signal, provenance }));
  }
  const data: ExportReviewData = { links, provenance, reads };
  return { plan: rebuildExportPlan(null, req, data), data };
}

/**
 * Rebuild the plan after a settings change (prefix, notes, overrides, span…)
 * from the data already read, keeping the user's row choices while each row's
 * situation is unchanged (`mergeChoices`). Pure.
 */
export function rebuildExportPlan(prev: ExportPlan | null, req: Omit<ExportReviewRequest, 'signal'>, data: ExportReviewData): ExportPlan {
  const next = buildExportPlan({
    sessions: req.sessions,
    category: req.category,
    destinations: req.destinations,
    options: req.options,
    links: data.links,
    destinationEvents: eventsOf(data.reads),
    provenance: data.provenance,
  });
  return prev ? mergeChoices(prev, next) : next;
}

/**
 * Write the confirmed selection, destination by destination, idempotently
 * (op ids; uncertain writes are looked up before any retry). Serialised with
 * automatic export. Results per destination: created, linked, updated,
 * skipped, failed, pending.
 */
export async function executeExport(
  plan: ExportPlan,
  opts: { signal?: AbortSignal; onProgress?: (p: { destinationKey: string; done: number; total: number }) => void; now?: () => string } = {},
  deps?: CalendarDeps,
): Promise<ExecuteResult> {
  const [repos, providers] = await Promise.all([reposOf(deps), providersOf(deps)]);
  return executePlan({ plan, providers, repos, signal: opts.signal, onProgress: opts.onProgress, now: opts.now });
}

// ─── automatic export ────────────────────────────────────────────────────────

/** Stored configuration (off by default; unreadable values fall back to the conservative default). */
export async function getAutoExportConfig(deps?: CalendarDeps): Promise<AutoExportConfig> {
  return loadConfig(await reposOf(deps));
}

/** Save a configuration (sanitised). Check it first with `checkAutoExportConfig`. */
export async function setAutoExportConfig(config: AutoExportConfig, deps?: CalendarDeps): Promise<AutoExportConfig> {
  return saveConfig(await reposOf(deps), config);
}

/**
 * Validate a configuration against the calendars the providers list now
 * (writable destinations, account match, "Both" equivalence) and the
 * existing activities. Never prompts.
 */
export async function checkAutoExportConfig(config: AutoExportConfig, deps?: CalendarDeps): Promise<ConfigValidation> {
  const repos = await reposOf(deps);
  const [listing, categories] = await Promise.all([listCalendarsFor('write', { ...deps, repos }), repos.categories.list()]);
  return validateConfig(config, listing.calendars, { categories });
}

/**
 * Turn automatic export off: nothing new is queued. With `cancelPending`, open
 * automatic jobs are cancelled; otherwise they stay visible and still run.
 * Exported events are never deleted or modified.
 */
export async function turnOffAutoExport(opts: { cancelPending: boolean }, deps?: CalendarDeps): Promise<{ config: AutoExportConfig; cancelled: number }> {
  return disableAutoExport(await reposOf(deps), opts);
}

/**
 * After a local commit (save or import): queue automatic export when it is on
 * and schedule a run after the "Annulla" window. Never throws into the save.
 * App runtime (autoRuntime.ts); in tests call the engine (`enqueueForSessions`).
 */
export async function enqueueAfterSave(sessions: readonly Session[]): Promise<void> {
  try {
    await loadRuntime().enqueueAfterCommit([...sessions]);
  } catch (e) {
    console.warn('calendar auto export enqueue failed', e);
  }
}

/** Process due automatic jobs now (no-op when nothing is open). */
export async function runAutoExportNow(): Promise<void> {
  await loadRuntime().runAutoExportNow();
}

/** Start the automatic export runtime (commit hook, foreground / network / periodic runs). Returns a stop function. */
export async function startAutoExportRuntime(): Promise<() => void> {
  return loadRuntime().startAutoExportRuntime();
}

/** Every export job (manual and automatic) with the summary used by badges. */
export async function listExportJobs(deps?: CalendarDeps): Promise<{ jobs: ExportJobRecord[]; summary: JobsSummary }> {
  const jobs = await (await reposOf(deps)).exportJobs.list();
  return { jobs, summary: summarizeJobs(jobs) };
}

/** Apply the user's decision on an automatic job in "Da rivedere" (skip, retry, approve a span, create separately, link). */
export async function resolveExportJob(jobId: string, action: ReviewAction, deps?: CalendarDeps): Promise<ExportJobRecord> {
  return resolveReviewJob(await reposOf(deps), jobId, action);
}
