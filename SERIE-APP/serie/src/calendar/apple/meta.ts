/**
 * App metadata (`AppEventMeta`) for EventKit events. Pure: no React, no Expo.
 *
 * EventKit has no extended/private properties, so Serie stores its metadata in
 * the event's URL field (iOS only, exposed by expo-calendar as `event.url`):
 *
 *     serie://export?m=<base64url(JSON)>
 *
 * The URL field is used only when it is empty or already holds Serie
 * metadata. When an event the user created carries their own URL (possible
 * after an explicit "update linked event"), that URL is preserved and the same
 * string is written instead as a clearly delimited trailing line of the notes:
 *
 *     <notes>
 *     <blank line>
 *     serie://export?m=<base64url(JSON)>
 *
 * Reading accepts both places (URL first) and strips the trailing line from
 * the notes handed to the engines, so previews never show the payload.
 *
 * Base64url (RFC 4648 §5, no padding) is implemented here because the
 * characters [A-Za-z0-9_-] survive `URL(string:)` on write and
 * `removingPercentEncoding` on read unchanged, and so the module does not
 * depend on `Buffer`, `btoa` or `TextEncoder` being present in the runtime.
 */
import type { AppEventMeta } from '../types';
import { canonicalAppMeta, parseAppMeta } from '../appMeta';

export const META_URL_PREFIX = 'serie://export?m=';
const META_URL_RE = /^serie:\/\/export\?(?:[^#]*&)?m=([A-Za-z0-9_-]+)(?:[&#].*)?$/;
const META_LINE_RE = /^serie:\/\/export\?m=[A-Za-z0-9_-]+$/;

// ─── UTF-8 + base64url ───────────────────────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_INDEX: Record<string, number> = Object.fromEntries([...B64].map((c, i) => [c, i]));

function utf8Bytes(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return out;
}

function utf8String(bytes: number[]): string | null {
  let s = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let cp: number;
    let n: number;
    if (b < 0x80) {
      cp = b;
      n = 1;
    } else if (b >= 0xc2 && b < 0xe0) {
      cp = b & 0x1f;
      n = 2;
    } else if (b >= 0xe0 && b < 0xf0) {
      cp = b & 0x0f;
      n = 3;
    } else if (b >= 0xf0 && b < 0xf5) {
      cp = b & 0x07;
      n = 4;
    } else return null;
    if (i + n > bytes.length) return null;
    for (let k = 1; k < n; k++) {
      const c = bytes[i + k];
      if ((c & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (c & 0x3f);
    }
    if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return null;
    s += String.fromCodePoint(cp);
    i += n;
  }
  return s;
}

export function base64UrlEncode(text: string): string {
  const b = utf8Bytes(text);
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < b.length) out += B64[(n >> 6) & 63];
    if (i + 2 < b.length) out += B64[n & 63];
  }
  return out;
}

export function base64UrlDecode(encoded: string): string | null {
  const s = encoded.replace(/=+$/, '');
  if (s.length % 4 === 1) return null;
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i += 4) {
    const chunk = s.slice(i, i + 4);
    let n = 0;
    for (let k = 0; k < 4; k++) {
      const c = chunk[k];
      const v = c === undefined ? 0 : B64_INDEX[c];
      if (v === undefined) return null;
      n = (n << 6) | v;
    }
    bytes.push((n >> 16) & 255);
    if (chunk.length > 2) bytes.push((n >> 8) & 255);
    if (chunk.length > 3) bytes.push(n & 255);
  }
  return utf8String(bytes);
}

// ─── AppEventMeta ────────────────────────────────────────────────────────────

/**
 * Strict shape check; anything unexpected is treated as "no metadata". The
 * same validator as the Google provider and the import engine (`parseAppMeta`).
 */
export function validateMeta(x: unknown): AppEventMeta | null {
  return parseAppMeta(x);
}

export function encodeMeta(meta: AppEventMeta): string {
  // Canonical values (they always read back) in a fixed key order (deterministic payload).
  const m = canonicalAppMeta(meta);
  const ordered: AppEventMeta = {
    v: 1,
    sessionId: m.sessionId,
    opId: m.opId,
    timingState: m.timingState,
    durationSec: m.durationSec,
    durationSource: m.durationSource,
    schedulingPlaceholder: m.schedulingPlaceholder,
  };
  return base64UrlEncode(JSON.stringify(ordered));
}

export function decodeMeta(payload: string): AppEventMeta | null {
  const json = base64UrlDecode(payload);
  if (json == null) return null;
  try {
    return validateMeta(JSON.parse(json));
  } catch {
    return null;
  }
}

export function metaToUrl(meta: AppEventMeta): string {
  return META_URL_PREFIX + encodeMeta(meta);
}

/** True when the string is a Serie metadata URL (whatever its payload). */
export function isSerieMetaUrl(url: string | null | undefined): boolean {
  return !!url && META_URL_RE.test(url.trim());
}

export function metaFromUrl(url: string | null | undefined): AppEventMeta | null {
  if (!url) return null;
  const m = META_URL_RE.exec(url.trim());
  return m ? decodeMeta(m[1]) : null;
}

/** Notes with the metadata appended as a delimited trailing line. */
export function notesWithMeta(notes: string | null, meta: AppEventMeta): string {
  const clean = splitNotesMeta(notes).notes;
  const line = metaToUrl(meta);
  return clean ? `${clean}\n\n${line}` : line;
}

/**
 * Separates user notes from a trailing Serie metadata line. Any trailing
 * Serie line is removed from the notes even when its payload is unreadable,
 * so a corrupt payload never leaks into previews or re-exports.
 */
export function splitNotesMeta(notes: string | null | undefined): { notes: string | null; meta: AppEventMeta | null } {
  if (!notes) return { notes: null, meta: null };
  const lines = notes.replace(/\r\n?/g, '\n').split('\n');
  let last = lines.length - 1;
  while (last >= 0 && lines[last].trim() === '') last--;
  if (last < 0) return { notes: null, meta: null };
  const candidate = lines[last].trim();
  if (!META_LINE_RE.test(candidate)) return { notes, meta: null };
  const meta = metaFromUrl(candidate);
  const rest = lines.slice(0, last).join('\n').replace(/\s+$/, '');
  return { notes: rest || null, meta };
}

/** Metadata read from an event: URL field first, then the notes trailer. */
export function readEventMeta(url: string | null | undefined, notes: string | null | undefined): { meta: AppEventMeta | null; notes: string | null; source: 'url' | 'notes' | null } {
  const split = splitNotesMeta(notes);
  const fromUrl = metaFromUrl(url);
  if (fromUrl) return { meta: fromUrl, notes: split.notes, source: 'url' };
  if (split.meta) return { meta: split.meta, notes: split.notes, source: 'notes' };
  return { meta: null, notes: split.notes, source: null };
}
