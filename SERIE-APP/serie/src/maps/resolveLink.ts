/**
 * Google Maps link → Place.
 *
 *   buildPlaceFromLink(previous, url)   synchronous; no network. Short links come back 'pending'.
 *   resolvePlaceFromLink(url, …)        async; follows short links over the network. Never throws.
 *   resolveShortLink(url, options)      the network step on its own, with a precise outcome.
 *
 * Rules:
 *  - The pasted link is stored as `mapUrl` verbatim (trimmed), never replaced by the long URL.
 *  - Coordinates come only from the link (or the URL a short link redirects to). No geocoding
 *    service is used: a place named by text only stays 'unresolved' and the user can place the
 *    pin by hand.
 *  - A label or address the user typed always wins over the link's; a manual pin survives a new
 *    link that carries no coordinates.
 *  - Offline, timeouts and odd responses produce 'unresolved' with an Italian note; the link and
 *    the session are kept. Nothing here can block saving.
 *  - This module only requests Google-owned hosts (short-link hosts, google.*, consent.google.*),
 *    and requests the URL rebuilt from the parsed parts (https, no user info), so the host that
 *    was checked is the host contacted. When a Location points anywhere else, resolution stops
 *    there without requesting it and the link is reported 'unsupported'. (A fetch that ignores
 *    `redirect: 'manual'` follows the chain itself; this module cannot stop that, it only refuses
 *    to read a non-Google landing page.) Requests omit credentials (no Google cookies).
 *  - No location permission is involved anywhere.
 *
 * Network notes (Expo SDK 57): the global `fetch` is expo/fetch on native unless
 * EXPO_PUBLIC_USE_RN_FETCH is set. It honours `redirect: 'manual'` on iOS (the 3xx response and its
 * Location header come back), so short links are followed hop by hop and resolution stops at the
 * first Google Maps URL. Implementations that ignore 'manual' follow redirects themselves and
 * expose the final `response.url`, which is parsed instead. A browser returns an opaque redirect
 * for 'manual'; that hop is retried with 'follow'. In a browser (Expo web) the cross-origin request
 * to the short-link host normally fails the CORS check outright (even in 'manual' mode the redirect
 * response must carry CORS headers): a rejected request there is reported as 'blocked', not as
 * offline, unless the browser itself says it is offline.
 */
import type { Coordinates, Place } from '@/domain/types';
import { absolutize, inRange, isGoogleOwnedUrl, labelFromLink, parseMapsLink, splitUrl, type MapsLink } from './parseLink';
import { MAPS_STRINGS } from './strings';

export const DEFAULT_RESOLVE_TIMEOUT_MS = 8000;
export const DEFAULT_MAX_REDIRECTS = 8;
const MAX_HTML_CHARS = 300_000;

// ─── fetch seam ──────────────────────────────────────────────────────────────

export interface FetchInitLike {
  method: 'GET';
  redirect: 'manual' | 'follow';
  credentials: 'omit';
  headers: Record<string, string>;
  signal?: AbortSignal;
}

/** The subset of `Response` this module reads. */
export interface FetchResponseLike {
  status: number;
  url?: string;
  type?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

/** Compatible with the global `fetch`. */
export type FetchLike = (url: string, init: FetchInitLike) => Promise<FetchResponseLike>;

export interface ResolveOptions {
  /** Defaults to the global `fetch`. */
  fetchImpl?: FetchLike;
  /** Budget for the whole redirect chain. Default 8 s. */
  timeoutMs?: number;
  /** Default 8. */
  maxRedirects?: number;
}

function globalFetch(): FetchLike | null {
  const f = (globalThis as { fetch?: unknown }).fetch;
  if (typeof f !== 'function') return null;
  // Called through globalThis: an unbound window.fetch throws "Illegal invocation" in browsers.
  return (url, init) => (globalThis as unknown as { fetch: FetchLike }).fetch(url, init);
}

// ─── Short-link resolution ───────────────────────────────────────────────────

export type ShortLinkFailure =
  | 'network_error' // fetch rejected: offline, DNS, TLS
  | 'blocked' // a browser showed the redirect exists but refused to let us read it (CORS on web)
  | 'timeout'
  | 'http_error' // 4xx / 5xx, or a 3xx without Location
  | 'too_many_redirects'
  | 'interstitial' // a page without a readable target
  | 'no_fetch'; // no fetch implementation available

export type ShortLinkResult =
  | { status: 'resolved'; link: Exclude<MapsLink, { kind: 'short' }>; finalUrl: string; hops: string[] }
  | { status: ShortLinkFailure; httpStatus: number | null; lastUrl: string; hops: string[] };

const isRedirectStatus = (s: number) => s === 301 || s === 302 || s === 303 || s === 307 || s === 308;
const toHttps = (u: string) => u.replace(/^http:\/\//i, 'https://');

/**
 * The URL actually requested for `href`: rebuilt from the parsed parts as https on the default
 * port, without user info or fragment. Fetching this (not the raw string) means the host that
 * passed the Google check is the host contacted, whatever quirks the raw text had.
 */
export function requestUrlFor(href: string): string | null {
  const p = splitUrl(href);
  if (!p || (p.scheme !== 'https' && p.scheme !== 'http')) return null;
  return `https://${p.host}${p.path || '/'}${p.query ? `?${p.query}` : ''}`;
}

/** Running in a web browser (Expo web), not React Native: cross-origin reads are subject to CORS there. */
function inBrowser(): boolean {
  const g = globalThis as { document?: unknown; navigator?: { product?: string; onLine?: boolean } };
  return typeof g.document === 'object' && g.document !== null && g.navigator?.product !== 'ReactNative';
}

const browserSaysOffline = () => (globalThis as { navigator?: { onLine?: boolean } }).navigator?.onLine === false;

const finiteOr = (v: number | undefined, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const needsNetwork = (l: MapsLink) => l.kind === 'short' || (l.kind === 'unsupported' && l.reason === 'interstitial');

class Timeout extends Error {
  constructor() {
    super('timeout');
    this.name = 'MapsLinkTimeout';
  }
}

/**
 * Follows a short Google Maps link to the URL it stands for and parses it.
 * Hop by hop with `redirect: 'manual'` where honoured; stops at the first URL
 * that is not a short link or an interstitial, and never requests a
 * non-Google host.
 */
export async function resolveShortLink(url: string, options: ResolveOptions = {}): Promise<ShortLinkResult> {
  const hops: string[] = [];
  let current = (typeof url === 'string' ? url : '').trim();
  let httpStatus: number | null = null;
  const fail = (status: ShortLinkFailure): ShortLinkResult => ({ status, httpStatus, lastUrl: current, hops });

  const first = parseMapsLink(current);
  if (first.kind === 'short') current = first.url;
  else if (first.kind !== 'unsupported' || first.reason !== 'interstitial') return { status: 'resolved', link: first, finalUrl: current, hops };

  const fetchImpl = options.fetchImpl ?? globalFetch();
  if (!fetchImpl) return fail('no_fetch');

  const timeoutMs = Math.max(1, finiteOr(options.timeoutMs, DEFAULT_RESOLVE_TIMEOUT_MS));
  const maxRedirects = Math.max(0, Math.floor(finiteOr(options.maxRedirects, DEFAULT_MAX_REDIRECTS)));
  const deadline = Date.now() + timeoutMs;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timedOut = false;
  let sawOpaqueRedirect = false;

  /** Races one step against the remaining budget of the whole chain. */
  const timed = <T>(p: Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const expire = () => {
        timedOut = true;
        controller?.abort();
        reject(new Timeout());
      };
      const left = deadline - Date.now();
      if (left <= 0) {
        p.catch(() => undefined);
        expire();
        return;
      }
      const timer = setTimeout(expire, left);
      p.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });

  const init = (redirect: 'manual' | 'follow'): FetchInitLike => ({
    method: 'GET',
    redirect,
    credentials: 'omit',
    headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
    ...(controller ? { signal: controller.signal } : {}),
  });

  const fetched = new Set<string>();
  let redirects = 0;
  try {
    for (;;) {
      const link = parseMapsLink(current);
      // A redirect to something that is not even a web link (an app scheme, an intent://…) is still "not Google Maps".
      if (link.kind === 'invalid' && link.reason === 'not_a_url') return { status: 'resolved', link: { kind: 'unsupported', reason: 'not_maps', url: current }, finalUrl: current, hops };
      if (link.kind !== 'short' && !(link.kind === 'unsupported' && link.reason === 'interstitial')) {
        return { status: 'resolved', link, finalUrl: current, hops };
      }
      const target = requestUrlFor(link.url);
      if (!target || !isGoogleOwnedUrl(target)) return { status: 'resolved', link: { kind: 'unsupported', reason: 'not_maps', url: current }, finalUrl: current, hops };
      if (fetched.has(target)) return fail(link.kind === 'short' ? 'too_many_redirects' : 'interstitial');
      fetched.add(target);

      let res = await timed(Promise.resolve().then(() => fetchImpl(target, init('manual'))));
      if (res.type === 'opaqueredirect' || res.status === 0) {
        // Browser semantics for 'manual': the redirect is hidden. Let the platform follow it.
        sawOpaqueRedirect = true;
        res = await timed(Promise.resolve().then(() => fetchImpl(target, init('follow'))));
      }
      httpStatus = res.status;

      let next: string | null = null;
      const location = isRedirectStatus(res.status) ? res.headers?.get?.('location') : null;
      if (location) {
        next = absolutize(location, target);
      } else {
        const landedAt = res.url ? (requestUrlFor(res.url) ?? toHttps(res.url)) : null;
        const landed = res.url && landedAt !== target ? res.url : null; // the platform followed redirects
        if (landedAt) fetched.add(landedAt);
        const here = landed ? parseMapsLink(landed) : link;
        if (needsNetwork(here)) {
          // Still on a short link or consent page, and this response is the end of whatever chain the
          // platform followed: an error status is that page's answer (e.g. 404 for an unknown id).
          if (res.status < 200 || res.status >= 300) return fail('http_error');
          // A 200: the target may be in the HTML; without one there is nothing left to follow.
          const html = await timed(Promise.resolve().then(() => res.text()));
          next = findTargetInHtml(html, landed ?? target);
          if (!next) return fail('interstitial');
        } else {
          next = landed;
        }
      }

      if (!next) return fail(res.status >= 300 || res.status < 200 ? 'http_error' : 'interstitial');
      if (++redirects > maxRedirects) return fail('too_many_redirects');
      hops.push(next);
      current = next;
    }
  } catch {
    // After an opaque redirect the network clearly works: a rejected follow-up is the browser's CORS block.
    // In a browser that says it is online, a rejected cross-origin request is the same block.
    if (timedOut) return fail('timeout');
    return fail(sawOpaqueRedirect || (inBrowser() && !browserSaysOffline()) ? 'blocked' : 'network_error');
  }
}

const JS_ESCAPES: [RegExp, string][] = [
  [/\\u003d/gi, '='],
  [/\\u0026/gi, '&'],
  [/\\x3d/gi, '='],
  [/\\x26/gi, '&'],
  [/\\\//g, '/'],
];

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .replace(/&#x0*3d;|&#0*61;/gi, '=')
    .replace(/&#x0*2f;|&#0*47;/gi, '/');
}

const attr = (tag: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
const attrValue = (m: RegExpExecArray | null) => (m ? decodeEntities(m[1] ?? m[2] ?? m[3] ?? '') : null);

/**
 * The redirect target inside an interstitial page: a meta refresh, a consent
 * form's `continue` field, or a Google Maps URL that parses to a place.
 * Exported for tests.
 */
export function findTargetInHtml(html: string, base: string): string | null {
  let text = (html ?? '').slice(0, MAX_HTML_CHARS);
  for (const [re, to] of JS_ESCAPES) text = text.replace(re, to);

  for (const tag of text.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!/http-equiv\s*=\s*["']?refresh/i.test(tag)) continue;
    const content = attrValue(attr(tag, 'content'));
    const m = content ? /url\s*=\s*['"]?([^'"]+)/i.exec(content) : null;
    if (m) return absolutize(m[1].trim(), base);
  }
  for (const tag of text.match(/<input\b[^>]*>/gi) ?? []) {
    if (attrValue(attr(tag, 'name')) !== 'continue') continue;
    const value = attrValue(attr(tag, 'value'));
    if (value) return absolutize(value, base);
  }
  let seen = 0;
  for (const raw of text.match(/https?:\/\/[^\s"'<>\\]+/g) ?? []) {
    if (++seen > 200) break;
    const u = decodeEntities(raw);
    if (!isGoogleOwnedUrl(u)) continue;
    const p = parseMapsLink(u);
    if (p.kind === 'coords' || p.kind === 'place_query') return u;
  }
  return null;
}

// ─── Place building ──────────────────────────────────────────────────────────

const clean = (s: string | null | undefined): string | null => {
  if (s == null) return null;
  const t = s.trim();
  return t.length ? t : null;
};

const sameText = (a: string, b: string) => a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * The label the user typed, or null. A label equal to the one the previous
 * (long) link suggested was filled from that link, so a new link may replace it.
 */
function typedLabel(prev: Place | null): string | null {
  const label = clean(prev?.label);
  if (!label) return null;
  const derived = labelFromLink(prev?.mapUrl);
  return derived && sameText(derived, label) ? null : label;
}

/**
 * The pin the user placed by hand, if any: coordinates on a 'manual' place, or on a 'pending' one —
 * a short link waiting for the network keeps only a manual pin (see placeFromParsed 'short'), and
 * the session sheet hands that pending place back to resolvePlaceFromLink.
 */
function manualPin(prev: Place | null): Coordinates | null {
  const c = prev?.coords;
  if (!c || (prev.resolution !== 'manual' && prev.resolution !== 'pending') || !inRange(c.lat, c.lng)) return null;
  return { lat: c.lat, lng: c.lng };
}

function base(prev: Place | null, link: string, linkLabel: string | null): Place {
  return {
    label: typedLabel(prev) ?? linkLabel,
    address: clean(prev?.address),
    mapUrl: link,
    coords: null,
    resolution: 'none',
    resolutionNote: null,
  };
}

/** A place whose link gave no position: a manual pin stays (and stays 'manual'); otherwise `fallback` with its note. */
function withoutPosition(prev: Place | null, link: string, linkLabel: string | null, fallback: 'unresolved' | 'unsupported', note: string | null): Place {
  const pin = manualPin(prev);
  const p = base(prev, link, linkLabel);
  return pin ? { ...p, coords: pin, resolution: 'manual' } : { ...p, resolution: fallback, resolutionNote: note };
}

/** Maps a parse result onto a Place, keeping what the user typed. */
function placeFromParsed(prev: Place | null, link: string, parsed: MapsLink, noteOverride?: string): Place {
  switch (parsed.kind) {
    case 'coords':
      return {
        ...base(prev, link, parsed.label),
        coords: { lat: parsed.coords.lat, lng: parsed.coords.lng },
        resolution: 'resolved',
        resolutionNote: parsed.source === 'viewport' ? MAPS_STRINGS.viewportOnly : null,
      };
    case 'short':
      // Network resolution pending; a manual pin is shown meanwhile.
      return { ...base(prev, link, null), coords: manualPin(prev), resolution: 'pending' };
    case 'place_query':
      return withoutPosition(prev, link, parsed.query, 'unresolved', MAPS_STRINGS.nameOnly);
    case 'unsupported':
      switch (parsed.reason) {
        case 'no_location':
          return withoutPosition(prev, link, null, 'unresolved', MAPS_STRINGS.noCoordinates);
        case 'interstitial':
          return withoutPosition(prev, link, null, 'unresolved', MAPS_STRINGS.interstitial);
        case 'directions':
          return withoutPosition(prev, link, null, 'unsupported', MAPS_STRINGS.directions);
        case 'not_a_place':
          return withoutPosition(prev, link, null, 'unsupported', MAPS_STRINGS.notAPlace);
        case 'not_maps':
          return withoutPosition(prev, link, null, 'unsupported', noteOverride ?? null);
      }
      break;
    case 'invalid':
      return withoutPosition(prev, link, null, 'unsupported', parsed.reason === 'out_of_range' ? MAPS_STRINGS.outOfRange : MAPS_STRINGS.notALink);
  }
  return withoutPosition(prev, link, null, 'unsupported', null);
}

function noteForFailure(r: Exclude<ShortLinkResult, { status: 'resolved' }>): string {
  switch (r.status) {
    case 'network_error':
      return MAPS_STRINGS.offline;
    case 'blocked':
      return MAPS_STRINGS.blockedByBrowser;
    case 'timeout':
      return MAPS_STRINGS.timeout;
    case 'http_error':
      return r.httpStatus === 404 || r.httpStatus === 410 ? MAPS_STRINGS.notFound : MAPS_STRINGS.httpError;
    case 'too_many_redirects':
      return MAPS_STRINGS.tooManyRedirects;
    case 'interstitial':
      return MAPS_STRINGS.interstitial;
    case 'no_fetch':
      return MAPS_STRINGS.noNetworkApi;
  }
}

function linkRemoved(prev: Place | null): Place {
  const pin = manualPin(prev);
  return {
    label: clean(prev?.label),
    address: clean(prev?.address),
    mapUrl: null,
    coords: pin,
    resolution: pin ? 'manual' : 'none',
    resolutionNote: null,
  };
}

const isPlace = (x: unknown): x is Place => !!x && typeof x === 'object' && ('resolution' in x || 'mapUrl' in x || 'coords' in x || 'label' in x);

/**
 * Place for a pasted link, synchronously (no network):
 *   coordinates in the link → 'resolved' · short link → 'pending' ·
 *   name only / no position → 'unresolved' · not Google Maps, a route, not a link → 'unsupported'.
 * The user's label and address are preserved; the same link pasted again returns `previous` as is.
 * Both argument orders are accepted: (previous, url) and (url, previous).
 */
export function buildPlaceFromLink(previous: Place | null | undefined, url: string): Place;
export function buildPlaceFromLink(url: string, previous?: Place | null): Place;
export function buildPlaceFromLink(a: Place | string | null | undefined, b?: Place | string | null): Place {
  const [prev, url] = typeof a === 'string' ? [isPlace(b) ? b : null, a] : [a ?? null, typeof b === 'string' ? b : ''];
  const link = url.trim();
  if (!link) return linkRemoved(prev);
  if (prev && clean(prev.mapUrl) === link && prev.resolution !== 'none') return prev;
  return placeFromParsed(prev, link, parseMapsLink(link));
}

/**
 * Place for a link, following short links over the network. Never throws:
 * every failure becomes 'unresolved' (or 'unsupported') with a note, and the
 * link is kept verbatim.
 *
 *   resolvePlaceFromLink(url, { fetchImpl, timeoutMs })
 *   resolvePlaceFromLink(url, previousPlace, { fetchImpl, timeoutMs })
 */
export function resolvePlaceFromLink(url: string, options?: ResolveOptions): Promise<Place>;
export function resolvePlaceFromLink(url: string, previous: Place | null | undefined, options?: ResolveOptions): Promise<Place>;
export async function resolvePlaceFromLink(url: string, a?: ResolveOptions | Place | null, b?: ResolveOptions): Promise<Place> {
  const prev = isPlace(a) ? a : null;
  const options: ResolveOptions = (isPlace(a) || a == null ? b : a) ?? {};
  const link = (typeof url === 'string' ? url : '').trim();
  if (!link) return linkRemoved(prev);
  try {
    const parsed = parseMapsLink(link);
    if (parsed.kind !== 'short') return placeFromParsed(prev, link, parsed);
    const r = await resolveShortLink(parsed.url, options);
    if (r.status === 'resolved') return placeFromParsed(prev, link, r.link, MAPS_STRINGS.shortNotMaps);
    return withoutPosition(prev, link, null, 'unresolved', noteForFailure(r));
  } catch {
    return withoutPosition(prev, link, null, 'unresolved', MAPS_STRINGS.unexpected);
  }
}
