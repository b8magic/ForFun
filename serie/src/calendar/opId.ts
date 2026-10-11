/**
 * Deterministic operation ids for export (session × destination calendar).
 *
 * The same session exported to the same concrete calendar always yields the
 * same op id, so a retry can recognise an earlier write (stored link, job, or
 * the `opId` Serie wrote into the event's metadata) instead of creating a
 * second event. Different destinations of the same session get different ids.
 *
 * Shape: `op1_<session id, sanitised>_<12 hex hash of session + destination>`.
 * Only [A-Za-z0-9_-] is used, so the id survives Google private extended
 * property queries (`serie_op=<id>`) and the Apple metadata URL unchanged.
 * The hash covers the raw session id as well, so two session ids that
 * sanitise to the same text still produce different op ids.
 *
 * Pure: no React, no Expo.
 */
import type { CalendarRef } from '@/domain/types';

const SEP = '\u0000';

function fnv1a32(input: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Final avalanche (murmur3 fmix32) so close inputs spread across all bits. */
function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

const hex8 = (n: number) => n.toString(16).padStart(8, '0');

/**
 * Short, stable, non-cryptographic hash rendered as lowercase hex.
 * Deterministic across JS runtimes (operates on UTF-16 code units).
 * `length` is clamped to 1…16 characters (up to 64 bits).
 */
export function shortHash(input: string, length = 12): string {
  const n = Math.max(1, Math.min(16, Math.floor(length)));
  const a = fmix32(fnv1a32(input, 0x811c9dc5));
  const b = fmix32(fnv1a32(input, 0x9747b28c) ^ a);
  return (hex8(a) + hex8(b)).slice(0, n);
}

/** Identity string of a destination; matches `refKey` in calendar/types. */
export const destinationKey = (ref: CalendarRef) => `${ref.provider}:${ref.accountId}:${ref.calendarId}`;

const OP_PREFIX = 'op1_';
const MAX_SESSION_PART = 64;

/** Deterministic export operation id for (session, destination calendar). */
export function exportOpId(sessionId: string, ref: CalendarRef): string {
  if (!sessionId) throw new Error('exportOpId: sessionId is required');
  const safe = sessionId.replace(/[^A-Za-z0-9-]/g, '-').slice(0, MAX_SESSION_PART);
  const h = shortHash([sessionId, ref.provider, ref.accountId, ref.calendarId].join(SEP), 12);
  return `${OP_PREFIX}${safe}_${h}`;
}

/** True when the string has the shape produced by `exportOpId`. */
export function isExportOpId(s: unknown): s is string {
  return typeof s === 'string' && /^op1_[A-Za-z0-9-]{1,64}_[0-9a-f]{12}$/.test(s);
}
