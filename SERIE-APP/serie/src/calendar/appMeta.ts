/**
 * `AppEventMeta`: what Serie writes into the events it exports so they are
 * recognised later (Google: private extended properties; Apple: the URL field
 * or a trailing notes line).
 *
 * One validator for every reader (both providers and the import engine), so
 * an event is recognised, or not, the same way everywhere. One canonical form
 * for every writer, so whatever a provider writes reads back unchanged:
 *
 *   - `v` is 1; `sessionId` and `opId` are non-empty strings;
 *   - `timingState` is one of the five timing states;
 *   - `durationSec` is null or a positive safe integer (seconds);
 *   - `durationSource` is null exactly when `durationSec` is null;
 *   - `schedulingPlaceholder` is a boolean.
 *
 * Anything else is "no metadata": untrusted or damaged metadata never restores
 * timing and never claims an event as Serie's own.
 *
 * Pure: no React, no Expo.
 */
import type { AppEventMeta } from './types';
import type { DurationSource, TimingState } from '@/domain/types';

export const APP_META_VERSION = 1 as const;

export const APP_META_TIMING_STATES: readonly TimingState[] = Object.freeze(['date_only', 'start_only', 'interval', 'duration_only', 'start_duration']);

export const APP_META_DURATION_SOURCES: readonly DurationSource[] = Object.freeze(['interval', 'declared']);

const isDurationSec = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x > 0;

/**
 * Strict shape check shared by every reader. A missing `durationSec` /
 * `durationSource` counts as null; every other field must be present.
 */
export function parseAppMeta(x: unknown): AppEventMeta | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (o.v !== APP_META_VERSION) return null;
  if (typeof o.sessionId !== 'string' || !o.sessionId) return null;
  if (typeof o.opId !== 'string' || !o.opId) return null;
  if (!APP_META_TIMING_STATES.includes(o.timingState as TimingState)) return null;
  const dur = o.durationSec ?? null;
  if (dur !== null && !isDurationSec(dur)) return null;
  const src = o.durationSource ?? null;
  if (src !== null && !APP_META_DURATION_SOURCES.includes(src as DurationSource)) return null;
  if ((dur === null) !== (src === null)) return null;
  if (typeof o.schedulingPlaceholder !== 'boolean') return null;
  return {
    v: APP_META_VERSION,
    sessionId: o.sessionId,
    opId: o.opId,
    timingState: o.timingState as TimingState,
    durationSec: dur as number | null,
    durationSource: src as DurationSource | null,
    schedulingPlaceholder: o.schedulingPlaceholder,
  };
}

/**
 * The form writers serialise. Rounds the duration to whole seconds, drops a
 * duration that is not positive, and fills a missing duration source from the
 * timing state (an interval measures its duration; every other state declares
 * it), so the result always passes `parseAppMeta`.
 */
export function canonicalAppMeta(m: AppEventMeta): AppEventMeta {
  const rounded = typeof m.durationSec === 'number' && Number.isFinite(m.durationSec) ? Math.round(m.durationSec) : null;
  const durationSec = rounded != null && isDurationSec(rounded) ? rounded : null;
  const source = APP_META_DURATION_SOURCES.includes(m.durationSource as DurationSource) ? m.durationSource : null;
  return {
    v: APP_META_VERSION,
    sessionId: m.sessionId,
    opId: m.opId,
    timingState: m.timingState,
    durationSec,
    durationSource: durationSec == null ? null : (source ?? (m.timingState === 'interval' ? 'interval' : 'declared')),
    schedulingPlaceholder: m.schedulingPlaceholder === true,
  };
}

/** Field-by-field equality of two metadata records. */
export function sameAppMeta(a: AppEventMeta | null | undefined, b: AppEventMeta | null | undefined): boolean {
  if (!a || !b) return (a ?? null) === (b ?? null);
  return (
    a.v === b.v &&
    a.sessionId === b.sessionId &&
    a.opId === b.opId &&
    a.timingState === b.timingState &&
    a.durationSec === b.durationSec &&
    a.durationSource === b.durationSource &&
    a.schedulingPlaceholder === b.schedulingPlaceholder
  );
}
