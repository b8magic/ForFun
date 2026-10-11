/// <reference types="node" />
/**
 * Regressions found in review of src/maps. Each block names the defect it pins down.
 */
import { URL as WhatwgURL } from 'url';
import type { Place } from '@/domain/types';
import { isGoogleOwnedUrl, labelFromLink, parseMapsLink, splitUrl } from '../parseLink';
import { buildPlaceFromLink, requestUrlFor, resolvePlaceFromLink, resolveShortLink, type FetchInitLike, type FetchLike, type FetchResponseLike } from '../resolveLink';
import { MAPS_STRINGS } from '../strings';

const SHORT = 'https://maps.app.goo.gl/q8Ywc4ZSkx5nBYXn8';
const LONG = 'https://www.google.com/maps/place/La+Fuente/@43.5389612,-5.4021553,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d43.5389573!4d-5.3995804?entry=ttu';
const PIN = { lat: 43.5389573, lng: -5.3995804 };

type Reply = { status: number; location?: string; url?: string; body?: string } | 'network-error';
function fakeFetch(routes: Record<string, Reply>) {
  const calls: { url: string; init: FetchInitLike }[] = [];
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const r = routes[url];
    if (!r) throw new Error(`unexpected request to ${url}`);
    if (r === 'network-error') throw new TypeError('Failed to fetch');
    const res: FetchResponseLike = {
      status: r.status,
      url: r.url ?? url,
      headers: { get: (k: string) => (k.toLowerCase() === 'location' ? (r.location ?? null) : null) },
      text: async () => r.body ?? '',
    };
    return res;
  };
  return { impl, calls };
}

const typed: Place = { label: 'Il mio spot', address: null, mapUrl: null, coords: null, resolution: 'none', resolutionNote: null };
const manual: Place = { ...typed, coords: { lat: 43.54, lng: -5.4 }, resolution: 'manual' };

describe('manual pin through the session sheet flow (build → pending → resolve)', () => {
  // The sheet stores the pending place from buildPlaceFromLink and passes THAT to resolvePlaceFromLink.
  it('survives a failed resolution of the pending place', async () => {
    const pending = buildPlaceFromLink(manual, SHORT);
    expect(pending).toMatchObject({ resolution: 'pending', coords: manual.coords });
    const offline = fakeFetch({ [SHORT]: 'network-error' });
    expect(await resolvePlaceFromLink(SHORT, pending, { fetchImpl: offline.impl })).toMatchObject({ mapUrl: SHORT, coords: manual.coords, resolution: 'manual', label: 'Il mio spot' });
  });

  it('survives a short link that turns out to name a place only by text, or is not found', async () => {
    const pending = buildPlaceFromLink(manual, SHORT);
    const nameOnly = fakeFetch({ [SHORT]: { status: 302, location: 'https://maps.google.com/?q=Playa+de+Rodiles&ftid=0x1:0x2' } });
    expect(await resolvePlaceFromLink(SHORT, pending, { fetchImpl: nameOnly.impl })).toMatchObject({ coords: manual.coords, resolution: 'manual' });
    const gone = fakeFetch({ [SHORT]: { status: 404 } });
    expect(await resolvePlaceFromLink(SHORT, pending, { fetchImpl: gone.impl })).toMatchObject({ coords: manual.coords, resolution: 'manual' });
  });

  it('yields to coordinates the short link resolves to (as a new long link would)', async () => {
    const pending = buildPlaceFromLink(manual, SHORT);
    const ok = fakeFetch({ [SHORT]: { status: 302, location: LONG } });
    expect(await resolvePlaceFromLink(SHORT, pending, { fetchImpl: ok.impl })).toMatchObject({ coords: PIN, resolution: 'resolved' });
  });

  it('a pending place without a pin still ends unresolved, and removing the link keeps the pin', async () => {
    const pending = buildPlaceFromLink(typed, SHORT);
    const offline = fakeFetch({ [SHORT]: 'network-error' });
    expect(await resolvePlaceFromLink(SHORT, pending, { fetchImpl: offline.impl })).toMatchObject({ coords: null, resolution: 'unresolved', resolutionNote: MAPS_STRINGS.offline });
    expect(buildPlaceFromLink(buildPlaceFromLink(manual, SHORT), '')).toMatchObject({ mapUrl: null, coords: manual.coords, resolution: 'manual' });
  });
});

describe('host checks agree with the WHATWG parser fetch() uses', () => {
  const tricky = [
    'https://evil.com\\@maps.app.goo.gl/abc',
    'https://evil.com\\@www.google.com/maps/@1,2,3z',
    'https://maps.app.goo.gl\\@evil.com/abc',
    'https://a@evil.com@maps.app.goo.gl/abc',
    'https://www.google.com@evil.com/maps/@1,2,3z',
    'https://maps.app.goo.gl%2F@evil.com/abc',
    'https://maps.app.goo.gl#@evil.com/abc',
    'https://maps.app.goo.gl?@evil.com/abc',
    'https://consent.google.com\\.evil.com/ml?continue=x',
    'https://x:y@maps.app.goo.gl/abc',
  ];

  it.each(tricky)('%s: a host this module trusts is the host a request reaches', (u) => {
    if (!isGoogleOwnedUrl(u)) return;
    const ours = splitUrl(u)?.host;
    expect(new WhatwgURL(u).hostname).toBe(ours);
    const req = requestUrlFor(u);
    expect(req && new WhatwgURL(req).hostname).toBe(ours);
  });

  it('a backslash ends the authority: the link is not a Google link at all', () => {
    expect(parseMapsLink('https://evil.com\\@maps.app.goo.gl/abc')).toMatchObject({ kind: 'unsupported', reason: 'not_maps' });
    expect(parseMapsLink('https://evil.com\\@www.google.com/maps/@43.46,-3.81,15z')).toMatchObject({ kind: 'unsupported', reason: 'not_maps' });
    expect(isGoogleOwnedUrl('https://evil.com\\@maps.app.goo.gl/abc')).toBe(false);
  });

  it('never requests the host hidden behind a backslash in a redirect', async () => {
    const { impl, calls } = fakeFetch({ [SHORT]: { status: 302, location: 'https://evil.com\\@maps.app.goo.gl/next' } });
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: impl })).toMatchObject({ resolution: 'unsupported', resolutionNote: MAPS_STRINGS.shortNotMaps });
    expect(calls.map((c) => c.url)).toEqual([SHORT]);
  });

  it('requests the URL rebuilt from its parts: https, no user info, no fragment', async () => {
    const { impl, calls } = fakeFetch({ [`${SHORT}?g_st=ic`]: { status: 302, location: LONG } });
    expect(await resolvePlaceFromLink(`http://user:pw@MAPS.APP.GOO.GL/q8Ywc4ZSkx5nBYXn8?g_st=ic#x`, { fetchImpl: impl })).toMatchObject({ coords: PIN, resolution: 'resolved' });
    expect(calls.map((c) => c.url)).toEqual([`${SHORT}?g_st=ic`]);
  });
});

describe('Google Maps pages that are not a place are not read as one', () => {
  it('contributor profiles, My Maps, embeds and static maps → not_a_place (their camera is not a place)', () => {
    for (const url of [
      'https://www.google.com/maps/contrib/108765432109876543210/reviews/@43.4,-3.8,10z/data=!3m1!4b1!4m3!8m2!3m1!1e1',
      'https://www.google.com/maps/d/viewer?mid=1AbCdEfGhIjKlMnOp&ll=43.4,-3.8&z=10',
      'https://www.google.com/maps/d/u/0/edit?mid=1AbCdEfGhIjKlMnOp&ll=43.4%2C-3.8&z=10',
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2900!2d-3.81!3d43.46',
      'https://maps.google.com/maps/api/staticmap?center=43.46,-3.81&zoom=14&size=400x400',
    ]) {
      expect(parseMapsLink(url)).toMatchObject({ kind: 'unsupported', reason: 'not_a_place' });
    }
    expect(buildPlaceFromLink(typed, 'https://www.google.com/maps/d/viewer?mid=1AbC&ll=43.4,-3.8&z=10')).toMatchObject({
      label: 'Il mio spot',
      coords: null,
      resolution: 'unsupported',
      resolutionNote: MAPS_STRINGS.notAPlace,
    });
  });

  it('place, search, preview, map-root and camera pages still parse (also under /maps/u/<n>/)', () => {
    expect(parseMapsLink('https://www.google.com/maps/u/0/place/La+Fuente/@43.5,-5.4,17z/data=!3d43.5389573!4d-5.3995804')).toMatchObject({ kind: 'coords', source: 'pin', label: 'La Fuente' });
    expect(parseMapsLink('https://www.google.com/maps/preview/@43.46,-3.81,15z')).toMatchObject({ kind: 'coords', source: 'viewport' });
    expect(parseMapsLink('https://maps.google.com/maps?q=43.46,-3.81')).toMatchObject({ kind: 'coords', source: 'query' });
    expect(parseMapsLink('https://maps.google.com/?q=43.46,-3.81')).toMatchObject({ kind: 'coords', source: 'query' });
  });
});

describe('short-link outcomes are reported precisely', () => {
  it('a platform-followed chain ending on a short-link page without a target is an interstitial, not a redirect loop', async () => {
    const old = 'https://goo.gl/maps/7uMVcPZ6Dyw9QpRC7';
    const { impl, calls } = fakeFetch({ [old]: { status: 200, url: SHORT, body: '<html><body>Apri nell’app Google Maps</body></html>' } });
    const r = await resolveShortLink(old, { fetchImpl: impl });
    expect(r).toMatchObject({ status: 'interstitial', httpStatus: 200 });
    expect(calls).toHaveLength(1);
    expect(await resolvePlaceFromLink(old, { fetchImpl: impl })).toMatchObject({ resolution: 'unresolved', resolutionNote: MAPS_STRINGS.interstitial });
  });

  it('a platform-followed chain ending on a short link that answers 404 is "not found", not a redirect loop', async () => {
    const old = 'https://goo.gl/maps/7uMVcPZ6Dyw9QpRC7';
    const { impl } = fakeFetch({ [old]: { status: 404, url: SHORT } });
    expect(await resolveShortLink(old, { fetchImpl: impl })).toMatchObject({ status: 'http_error', httpStatus: 404 });
    expect(await resolvePlaceFromLink(old, { fetchImpl: impl })).toMatchObject({ resolution: 'unresolved', resolutionNote: MAPS_STRINGS.notFound });
  });

  it('a platform-followed chain that lands on a Google Maps URL is read even if that page answers an error', async () => {
    const { impl } = fakeFetch({ [SHORT]: { status: 429, url: LONG } });
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: impl })).toMatchObject({ coords: PIN, resolution: 'resolved' });
  });

  it('a redirect to an app scheme is "not Google Maps", not "not a link"', async () => {
    for (const location of ['comgooglemaps://?q=43.46,-3.81&zoom=14', 'intent://maps?q=43.46,-3.81#Intent;scheme=geo;end']) {
      const { impl } = fakeFetch({ [SHORT]: { status: 302, location } });
      expect(await resolvePlaceFromLink(SHORT, { fetchImpl: impl })).toMatchObject({ mapUrl: SHORT, resolution: 'unsupported', resolutionNote: MAPS_STRINGS.shortNotMaps });
    }
  });

  it('non-finite timeout / redirect limits fall back to the defaults (not an instant timeout)', async () => {
    const { impl: quick } = fakeFetch({ [SHORT]: { status: 302, location: LONG } });
    const slowish: FetchLike = (url, init) => new Promise((resolve) => setTimeout(() => resolve(quick(url, init)), 30));
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: slowish, timeoutMs: Number.NaN, maxRedirects: Number.NaN })).toMatchObject({ coords: PIN, resolution: 'resolved' });
  });

  describe('in a browser (Expo web)', () => {
    const g = globalThis as { document?: unknown; navigator?: unknown };
    const realDocument = g.document;
    const realNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    afterEach(() => {
      if (realDocument === undefined) delete g.document;
      else g.document = realDocument;
      if (realNavigator) Object.defineProperty(globalThis, 'navigator', realNavigator);
    });
    const setNavigator = (nav: object) => Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });

    it('a rejected cross-origin request (CORS) is "blocked", not "offline"', async () => {
      g.document = {};
      setNavigator({ onLine: true, product: 'Gecko' });
      const { impl } = fakeFetch({ [SHORT]: 'network-error' });
      expect(await resolvePlaceFromLink(SHORT, { fetchImpl: impl })).toMatchObject({ resolution: 'unresolved', resolutionNote: MAPS_STRINGS.blockedByBrowser });
    });

    it('…unless the browser says it is offline', async () => {
      g.document = {};
      setNavigator({ onLine: false, product: 'Gecko' });
      const { impl } = fakeFetch({ [SHORT]: 'network-error' });
      expect(await resolvePlaceFromLink(SHORT, { fetchImpl: impl })).toMatchObject({ resolution: 'unresolved', resolutionNote: MAPS_STRINGS.offline });
    });
  });
});

describe('labels', () => {
  it('a long label is cut without splitting an emoji', () => {
    const name = `${'a'.repeat(199)}%F0%9F%8F%84surf`; // 199 letters, then a surfer emoji straddling the 200-char limit
    const label = labelFromLink(`https://www.google.com/maps/place/${name}/@43.46,-3.81,17z`);
    expect(label).toBe('a'.repeat(199));
    expect(label && /[\uD800-\uDBFF]$/.test(label)).toBe(false);
  });
});

describe('pasted text', () => {
  it('invisible marks and a trailing ellipsis are not part of the link', () => {
    expect(parseMapsLink(`\u200E${SHORT}\u200F`)).toEqual({ kind: 'short', url: SHORT });
    expect(parseMapsLink(`Guarda qui:\u200B${SHORT}\uFEFF`)).toEqual({ kind: 'short', url: SHORT });
    expect(parseMapsLink(`Ci vediamo qui ${SHORT}…`)).toEqual({ kind: 'short', url: SHORT });
  });
});
