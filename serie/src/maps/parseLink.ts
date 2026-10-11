/**
 * Google Maps link parser — pure, synchronous, no network, no location access.
 *
 * Reads a pasted Google Maps link and says what it contains. Coordinates are
 * only ever *read* from the link itself; a name is never turned into
 * coordinates (no geocoding).
 *
 * Precedence when a link carries several positions:
 *   1. pin       `data=…!3dLAT!4dLNG` — the place itself
 *   2. query     an explicit point: `q=` / `query=` / `/search/<lat,lng>` /
 *                `/place/<lat,lng or DMS>` / a directions destination
 *   3. viewport  the map camera: `@lat,lng,17z`, `ll=`, `center=`,
 *                `viewpoint=`, then `sll=`
 * A viewport is used only when the link does not search for a place by free
 * text (`q=Name`, `query=Name`, `/search/Name`): the camera of a text search
 * is not the place. A `/place/<Name>/@…` page without a pin falls back to its
 * viewport (source 'viewport', so callers can tell it is approximate).
 *
 * The parser does not depend on the global `URL` (React Native, Expo and Node
 * ship different implementations); it splits URLs itself.
 */
import type { Coordinates } from '@/domain/types';

export type CoordsSource = 'pin' | 'query' | 'viewport';

/**
 * Why a link is not a single readable place:
 *  - not_maps      not a Google Maps link at all
 *  - directions    a route (`/maps/dir/`) without a destination coordinate
 *  - no_location   a Google Maps link that names nothing readable (e.g. `?cid=` only)
 *  - interstitial  a Google consent / "sorry" page without a `continue` target
 */
export type UnsupportedReason = 'not_maps' | 'directions' | 'no_location' | 'interstitial';

/** not_a_url: the text is not a link; out_of_range: |lat| > 90 or |lng| > 180. */
export type InvalidReason = 'not_a_url' | 'out_of_range';

export type MapsLink =
  | { kind: 'coords'; coords: Coordinates; label: string | null; source: CoordsSource; placeId: string | null; url: string }
  | { kind: 'place_query'; query: string; placeId: string | null; url: string }
  | { kind: 'short'; url: string }
  | { kind: 'unsupported'; reason: UnsupportedReason; url: string }
  | { kind: 'invalid'; reason: InvalidReason; url: string | null };

export interface UrlParts {
  /** Lower-case, without ':'. */
  scheme: string;
  /** Lower-case, without port or trailing dot. */
  host: string;
  /** Raw (still percent-encoded) path, '' when absent. */
  path: string;
  /** Raw query without '?', '' when absent. */
  query: string;
  /** `scheme://host[:port]`. */
  origin: string;
}

const MAX_LABEL = 200;
const MAX_UNWRAP_DEPTH = 3;

// ─── URL plumbing ────────────────────────────────────────────────────────────

const URL_RE = /^([a-z][a-z0-9+.-]*):\/\/(?:[^@/?#\s]*@)?([^:/?#\s]+)(:\d*)?([^?#\s]*)(?:\?([^#\s]*))?(?:#\S*)?$/i;

/** Splits an absolute URL; null when the text is not one. */
export function splitUrl(href: string): UrlParts | null {
  const m = URL_RE.exec(href.trim());
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  const host = m[2].toLowerCase().replace(/\.$/, '');
  if (!host) return null;
  return { scheme, host, path: m[4] ?? '', query: m[5] ?? '', origin: `${scheme}://${host}${m[3] && m[3].length > 1 ? m[3] : ''}` };
}

/** Percent-decoding that never throws: malformed sequences are kept as typed. */
export function percentDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s.replace(/(?:%[0-9a-f]{2})+/gi, (run) => {
      try {
        return decodeURIComponent(run);
      } catch {
        return run;
      }
    });
  }
}

/** Form-style decoding: '+' is a space, then percent-decoding. */
export function decodeComponent(s: string): string {
  return percentDecode(s.replace(/\+/g, ' '));
}

/** First value wins for repeated keys. */
export function parseQuery(query: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of query.split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const key = decodeComponent(i < 0 ? part : part.slice(0, i));
    if (!out.has(key)) out.set(key, i < 0 ? '' : decodeComponent(part.slice(i + 1)));
  }
  return out;
}

/** Resolves a Location header (absolute, scheme-relative, root-relative or relative) against a base URL. */
export function absolutize(location: string, base: string): string | null {
  const loc = location.trim();
  if (!loc) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(loc)) return loc;
  const b = splitUrl(base);
  if (!b) return null;
  if (loc.startsWith('//')) return `${b.scheme}:${loc}`;
  if (loc.startsWith('/')) return b.origin + loc;
  if (loc.startsWith('?')) return b.origin + (b.path || '/') + loc;
  return b.origin + ((b.path || '/').replace(/[^/]*$/, '') || '/') + loc;
}

// ─── Hosts ───────────────────────────────────────────────────────────────────

const GOOGLE_TLD = String.raw`(?:com|cat|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})`;
const GOOGLE_WWW_RE = new RegExp(`^(?:www\\.)?google\\.${GOOGLE_TLD}$`);
const GOOGLE_MAPS_RE = new RegExp(`^maps\\.google\\.${GOOGLE_TLD}$`);
const GOOGLE_CONSENT_RE = new RegExp(`^consent\\.google\\.${GOOGLE_TLD}$`);

export type GoogleHostKind = 'www' | 'maps' | 'consent';

/** google.com / google.it / google.co.uk … ('www'), maps.google.* ('maps'), consent.google.* ('consent'). */
export function googleHostKind(host: string): GoogleHostKind | null {
  const h = host.toLowerCase();
  if (GOOGLE_WWW_RE.test(h)) return 'www';
  if (GOOGLE_MAPS_RE.test(h)) return 'maps';
  if (GOOGLE_CONSENT_RE.test(h)) return 'consent';
  return null;
}

/** maps.app.goo.gl/<id> and goo.gl/maps/<id>. */
export function isShortMapsLink(parts: UrlParts): boolean {
  if (parts.scheme !== 'https' && parts.scheme !== 'http') return false;
  if (parts.host === 'maps.app.goo.gl') return /^\/[^/]+/.test(parts.path);
  if (parts.host === 'goo.gl' || parts.host === 'www.goo.gl') return /^\/maps\/[^/]+/.test(parts.path);
  return false;
}

/** True for URLs on hosts this module may contact while resolving a short link. */
export function isGoogleOwnedUrl(href: string): boolean {
  const p = splitUrl(href);
  if (!p || (p.scheme !== 'https' && p.scheme !== 'http')) return false;
  return isShortMapsLink(p) || googleHostKind(p.host) !== null;
}

// ─── Extracting the link from pasted text ────────────────────────────────────

const OPENERS = /^[(<[{«"'“‘]+/;
const TRAILERS = /[.,;:!?>\]}»"'”’]+$/;

function trimToken(token: string): string {
  let t = token.replace(OPENERS, '');
  for (;;) {
    const before = t;
    t = t.replace(TRAILERS, '');
    // A trailing ')' belongs to the URL only when it closes a '(' inside it (e.g. q=43.4,-3.8(La+Fuente)).
    if (t.endsWith(')') && (t.match(/\(/g)?.length ?? 0) < (t.match(/\)/g)?.length ?? 0)) t = t.slice(0, -1);
    if (t === before) return t;
  }
}

function withScheme(token: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:\/\/\S/i.test(token)) return token;
  if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i.test(token)) return `https://${token}`;
  return null;
}

function looksLikeMaps(href: string): boolean {
  const p = splitUrl(href);
  return !!p && (isShortMapsLink(p) || googleHostKind(p.host) !== null);
}

/**
 * The link inside pasted text: the text itself when it is one URL, otherwise
 * the first Google Maps URL among its words (share sheets often add the place
 * name before the link), otherwise the first URL. A bare host such as
 * "maps.app.goo.gl/abc" gets https://. Null when there is no link.
 */
export function extractLink(input: string): string | null {
  if (typeof input !== 'string') return null;
  const urls = input
    .trim()
    .split(/\s+/)
    .map(trimToken)
    .map((t) => (t ? withScheme(t) : null))
    .filter((u): u is string => !!u);
  if (urls.length === 0) return null;
  return urls.find(looksLikeMaps) ?? urls[0];
}

// ─── Reading points ──────────────────────────────────────────────────────────

export function inRange(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function cleanLabel(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.length > MAX_LABEL ? t.slice(0, MAX_LABEL).trimEnd() : t;
}

const zero = (n: number) => (n === 0 ? 0 : n); // no -0

type Point =
  | { kind: 'coords'; coords: Coordinates; label: string | null }
  | { kind: 'out_of_range' }
  | { kind: 'text'; text: string }
  | { kind: 'empty' };

function point(lat: number, lng: number, label: string | null = null): Point {
  return inRange(lat, lng) ? { kind: 'coords', coords: { lat: zero(lat), lng: zero(lng) }, label: cleanLabel(label) } : { kind: 'out_of_range' };
}

const NUM = String.raw`[+-]?\d{1,3}(?:\.\d+)?`;
const PAIR_COMMA_RE = new RegExp(String.raw`^(?:loc:\s*)?(${NUM})\s*,\s*(${NUM})\s*(?:\((.*)\))?$`, 'i');
// Space-separated pairs need decimals on both sides, so "Via Roma 12" style text is never read as a point.
const PAIR_SPACE_RE = /^(?:loc:\s*)?([+-]?\d{1,3}\.\d+)\s+([+-]?\d{1,3}\.\d+)\s*(?:\((.*)\))?$/i;
const DMS_PART = String.raw`(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:\.\d+)?)\s*(?:"|″|'')\s*`;
const DMS_RE = new RegExp(String.raw`^${DMS_PART}([NS])[\s,]*${DMS_PART}([EW])$`, 'i');
const DD_HEMI_RE = /^(\d{1,3}(?:\.\d+)?)\s*°?\s*([NS])[\s,]+(\d{1,3}(?:\.\d+)?)\s*°?\s*([EW])$/i;

function dms(d: string, m: string, s: string, hemi: string): number {
  const mm = Number(m);
  const ss = Number(s);
  if (mm >= 60 || ss >= 60) return NaN;
  const v = Number(d) + mm / 60 + ss / 3600;
  return /[SW]/i.test(hemi) ? -v : v;
}

/** Reads "lat,lng", "lat,lng (Label)", "loc:lat lng", DMS (43°27'43.6"N 3°48'36.0"W) or a free-text name. */
function readPoint(raw: string | null | undefined): Point {
  const text = cleanLabel(raw);
  if (!text) return { kind: 'empty' };
  let m = PAIR_COMMA_RE.exec(text) ?? PAIR_SPACE_RE.exec(text);
  if (m) return point(Number(m[1]), Number(m[2]), m[3] ?? null);
  m = DMS_RE.exec(text);
  if (m) return point(dms(m[1], m[2], m[3], m[4]), dms(m[5], m[6], m[7], m[8]));
  m = DD_HEMI_RE.exec(text);
  if (m) return point(/S/i.test(m[2]) ? -Number(m[1]) : Number(m[1]), /W/i.test(m[4]) ? -Number(m[3]) : Number(m[3]));
  return { kind: 'text', text };
}

const PIN_RE = /!3d([+-]?\d+(?:\.\d+)?)!4d([+-]?\d+(?:\.\d+)?)/g;
const AT_RE = /^@([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)(?:,|$)/;

/** The last `!3d…!4d…` pair in the data blob: the selected place. */
function readPin(data: string): Point {
  let last: RegExpExecArray | null = null;
  for (let m = PIN_RE.exec(data); m; m = PIN_RE.exec(data)) last = m;
  PIN_RE.lastIndex = 0;
  return last ? point(Number(last[1]), Number(last[2])) : { kind: 'empty' };
}

function readAt(segment: string | undefined): Point {
  const m = segment ? AT_RE.exec(segment) : null;
  return m ? point(Number(m[1]), Number(m[2])) : { kind: 'empty' };
}

const isMeta = (s: string) => s === '' || s.startsWith('@') || s.startsWith('data=') || s === 'am=t';
const decodeSegment = (s: string) => decodeComponent(s);

// ─── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Parses a pasted Google Maps link (or text containing one).
 *
 *  coords       a readable position (+ label from `/place/<Name>` or `(Label)`)
 *  place_query  a place named by text only (`?q=Name`, `query=Name&query_place_id=…`)
 *  short        maps.app.goo.gl / goo.gl/maps — needs network resolution
 *  unsupported  a URL that is not a single readable Google Maps place
 *  invalid      not a link, or coordinates out of range
 */
export function parseMapsLink(input: string): MapsLink {
  return parseAt(input, 0);
}

function parseAt(input: string, depth: number): MapsLink {
  if (typeof input !== 'string' || !input.trim()) return { kind: 'invalid', reason: 'not_a_url', url: null };
  const href = extractLink(input);
  if (!href) {
    const t = input.trim();
    // Other URI schemes (geo:, maps:, mailto:) are links, just not Google Maps web links.
    return /^[a-z][a-z0-9+.-]*:\S+$/i.test(t) ? { kind: 'unsupported', reason: 'not_maps', url: t } : { kind: 'invalid', reason: 'not_a_url', url: null };
  }
  const parts = splitUrl(href);
  if (!parts) return { kind: 'invalid', reason: 'not_a_url', url: null };
  if (parts.scheme !== 'https' && parts.scheme !== 'http') return { kind: 'unsupported', reason: 'not_maps', url: href };
  if (isShortMapsLink(parts)) return { kind: 'short', url: href };

  const host = googleHostKind(parts.host);
  if (!host) return { kind: 'unsupported', reason: 'not_maps', url: href };
  const params = parseQuery(parts.query);
  if (host === 'consent') return unwrap(params.get('continue'), depth, href, 'interstitial');

  let segs = parts.path.split('/').slice(1); // raw segments, empties kept (they matter for /dir/)
  if (host === 'www') {
    if (segs[0] === 'url') return unwrap(params.get('q') || params.get('url'), depth, href, 'not_maps');
    if (segs[0] === 'sorry') return unwrap(params.get('continue'), depth, href, 'interstitial');
    if (segs[0] !== 'maps') return { kind: 'unsupported', reason: 'not_maps', url: href }; // e.g. google.com/search
    segs = segs.slice(1);
  } else if (segs[0] === 'maps') {
    segs = segs.slice(1);
  }
  if (segs[0] === 'dir' || params.has('daddr')) return parseDirections(segs, params, href);
  return parsePlace(segs, params, href);
}

/** Consent pages, "sorry" pages and google.com/url wrappers carry the real target in a parameter. */
function unwrap(target: string | undefined, depth: number, href: string, otherwise: UnsupportedReason): MapsLink {
  if (target && depth < MAX_UNWRAP_DEPTH) {
    // The value was form-decoded: a space stands for a '+' the inner URL needs (e.g. /place/La+Fuente).
    const inner = parseAt(target.trim().replace(/\s/g, '+'), depth + 1);
    if (inner.kind !== 'invalid' || inner.reason === 'out_of_range') return inner;
  }
  return { kind: 'unsupported', reason: otherwise, url: href };
}

function parsePlace(segs: string[], params: Map<string, string>, href: string): MapsLink {
  const first = segs[0] ?? '';
  const placeId = cleanLabel(params.get('query_place_id'));
  // Mutable state in an object: closures assigning plain `let`s defeat TypeScript's narrowing.
  const st: { name: string | null; search: string | null; explicit: { coords: Coordinates; label: string | null } | null; outOfRange: boolean } = {
    name: null, // /place/<Name>
    search: null, // free-text search
    explicit: null, // an explicit point given by the link
    outOfRange: false,
  };

  const take = (raw: string | null | undefined, role: 'place' | 'search') => {
    const p = readPoint(raw);
    if (p.kind === 'coords') st.explicit ??= { coords: p.coords, label: p.label };
    else if (p.kind === 'out_of_range') st.outOfRange = true;
    else if (p.kind === 'text') {
      if (role === 'place') st.name ??= p.text;
      else st.search ??= p.text;
    }
  };

  if ((first === 'place' || first === 'search') && segs[1] !== undefined && !isMeta(segs[1])) {
    take(decodeSegment(segs[1]), first === 'place' ? 'place' : 'search');
  }
  take(params.get('q'), 'search');
  take(params.get('query'), 'search');
  const { name, search, explicit } = st;

  const pin = readPin(segs.filter((s) => s.startsWith('data=')).map(percentDecode).join(''));
  if (pin.kind === 'out_of_range') st.outOfRange = true;
  if (pin.kind === 'coords') return coords(pin.coords, name ?? explicit?.label ?? search, 'pin', placeId, href);
  if (explicit) return coords(explicit.coords, explicit.label ?? name, 'query', placeId, href);
  if (search) return { kind: 'place_query', query: search, placeId, url: href };

  const viewports = [readAt(segs.find((s) => s.startsWith('@'))), readPoint(params.get('ll')), readPoint(params.get('center')), readPoint(params.get('viewpoint')), readPoint(params.get('sll'))];
  for (const v of viewports) {
    if (v.kind === 'coords') return coords(v.coords, name, 'viewport', placeId, href);
    if (v.kind === 'out_of_range') st.outOfRange = true;
  }
  if (name) return { kind: 'place_query', query: name, placeId, url: href };
  if (st.outOfRange) return { kind: 'invalid', reason: 'out_of_range', url: href };
  return { kind: 'unsupported', reason: 'no_location', url: href };
}

/**
 * A route names a single place only through a destination coordinate:
 * `destination=lat,lng` (api=1), classic `daddr=lat,lng` (last " to:" stop),
 * or the last waypoint of `/maps/dir/<from>/<to>/` when it is a coordinate.
 */
function parseDirections(segs: string[], params: Map<string, string>, href: string): MapsLink {
  const candidates: string[] = [];
  const destination = params.get('destination');
  if (destination) candidates.push(destination);
  const daddr = params.get('daddr');
  if (daddr) candidates.push(daddr.split(/\s+to:/i).pop() ?? daddr);
  if (segs[0] === 'dir') {
    const waypoints: string[] = [];
    let stoppedAtMeta = false;
    for (const s of segs.slice(1)) {
      if (s !== '' && isMeta(s)) {
        stoppedAtMeta = true;
        break;
      }
      waypoints.push(s);
    }
    // One trailing '' is just the path's trailing slash; an empty slot before metadata is an empty destination.
    if (!stoppedAtMeta && waypoints.length && waypoints[waypoints.length - 1] === '') waypoints.pop();
    if (waypoints.length >= 2) candidates.push(decodeSegment(waypoints[waypoints.length - 1]));
  }
  for (const c of candidates) {
    const p = readPoint(c);
    if (p.kind === 'coords') return coords(p.coords, p.label, 'query', null, href);
    if (p.kind === 'out_of_range') return { kind: 'invalid', reason: 'out_of_range', url: href };
  }
  return { kind: 'unsupported', reason: 'directions', url: href };
}

function coords(c: Coordinates, label: string | null, source: CoordsSource, placeId: string | null, url: string): MapsLink {
  return { kind: 'coords', coords: c, label: cleanLabel(label), source, placeId, url };
}

/** The label a link itself suggests (place name, or the searched text); null when none. */
export function labelFromLink(input: string | null | undefined): string | null {
  if (!input) return null;
  const p = parseMapsLink(input);
  if (p.kind === 'coords') return p.label;
  if (p.kind === 'place_query') return p.query;
  return null;
}
