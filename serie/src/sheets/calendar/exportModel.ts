/**
 * Pure state helpers for the export wizard (kept out of React so they are
 * unit-tested): per-destination settings, the "same settings for both"
 * linkage, override edits and what a row tap should do.
 */
import type { ProviderKind, Session } from '@/domain/types';
import type { ExportOverride } from '@/calendar/representation';
import type { ExportAction, ExportOptions, ExportPlanRow } from '@/calendar/exportEngine';
import { t } from '@/i18n/it';

export interface DestSettings {
  prefix: string;
  suffix: string;
  includeNotes: boolean;
  includeLocation: boolean;
  /** Approved export-only span for start-only sessions; null = not approved (rows stay pending). */
  startOnlySpanMin: number | null;
  overrides: Record<string, ExportOverride>;
}

export const DEFAULT_SETTINGS: DestSettings = { prefix: '', suffix: '', includeNotes: true, includeLocation: true, startOnlySpanMin: null, overrides: {} };

export type SettingsMap = Partial<Record<ProviderKind, DestSettings>>;

export function toOptions(s: DestSettings, defaultTimeZone: string): ExportOptions {
  return { prefix: s.prefix, suffix: s.suffix, includeNotes: s.includeNotes, includeLocation: s.includeLocation, startOnlySpanMin: s.startOnlySpanMin, overrides: s.overrides, defaultTimeZone };
}

/** Apply a settings edit to one destination, or to every chosen destination when linked. */
export function editSettings(map: SettingsMap, chosen: readonly ProviderKind[], target: ProviderKind, linked: boolean, edit: (s: DestSettings) => DestSettings): SettingsMap {
  const next: SettingsMap = { ...map };
  for (const k of linked ? chosen : [target]) next[k] = edit(next[k] ?? DEFAULT_SETTINGS);
  return next;
}

/** When linking is turned on, every destination takes the settings of `from`. */
export function linkSettings(map: SettingsMap, chosen: readonly ProviderKind[], from: ProviderKind): SettingsMap {
  const src = map[from] ?? DEFAULT_SETTINGS;
  const next: SettingsMap = { ...map };
  for (const k of chosen) next[k] = { ...src, overrides: { ...src.overrides } };
  return next;
}

/** Set (or clear with `undefined`) one field of a session's outgoing override; empty overrides are dropped. */
export function setOverride<K extends keyof ExportOverride>(s: DestSettings, sessionId: string, field: K, value: ExportOverride[K] | undefined): DestSettings {
  const cur: ExportOverride = { ...(s.overrides[sessionId] ?? {}) };
  if (value === undefined) delete cur[field];
  else cur[field] = value;
  const overrides = { ...s.overrides };
  if (Object.keys(cur).length) overrides[sessionId] = cur;
  else delete overrides[sessionId];
  return { ...s, overrides };
}

export function clearOverride(s: DestSettings, sessionId: string): DestSettings {
  const overrides = { ...s.overrides };
  delete overrides[sessionId];
  return { ...s, overrides };
}

export function resetAllTitles(s: DestSettings): DestSettings {
  const overrides: Record<string, ExportOverride> = {};
  for (const [id, o] of Object.entries(s.overrides)) {
    const { baseTitle: _b, ...rest } = o;
    if (Object.keys(rest).length) overrides[id] = rest;
  }
  return { ...s, overrides };
}

/**
 * What tapping a row's checkbox does. Rows whose current action is "skip"
 * need an action: when exactly one real action is allowed it is chosen,
 * otherwise the row opens so the user decides (possible duplicates).
 */
export function tapIntent(r: ExportPlanRow): { kind: 'toggle'; selected: boolean } | { kind: 'action'; action: ExportAction } | { kind: 'decide' } {
  if (r.action !== 'skip') return { kind: 'toggle', selected: !r.selected };
  const real = r.allowedActions.filter((a) => a !== 'skip');
  if (real.length === 1) return { kind: 'action', action: real[0] };
  if (real.length === 0) return { kind: 'decide' };
  return { kind: 'decide' };
}

export const ACTION_LABEL: Record<ExportAction, string> = { skip: t.actionSkip, link: t.actionLink, create: t.actionCreate, update: t.actionUpdate };

export type ReviewFilter = 'all' | 'selected' | 'attention';

export function rowNeedsAttention(r: ExportPlanRow): boolean {
  return r.status === 'possible_duplicate' || r.status === 'linked_changed' || r.status === 'pending_representation' || r.status === 'invalid' || r.status === 'not_checked' || r.status === 'not_writable';
}

export const ROW_FILTERS: Record<ReviewFilter, (r: ExportPlanRow) => boolean> = {
  all: () => true,
  selected: (r) => r.selected,
  attention: rowNeedsAttention,
};

export function startOnlyCount(sessions: readonly Session[]): number {
  return sessions.filter((s) => s.timing.state === 'start_only').length;
}

export const SPAN_CHOICES = [30, 60, 90, 120] as const;
