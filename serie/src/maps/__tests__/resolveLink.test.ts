import type { Place } from '@/domain/types';
import {
  buildPlaceFromLink,
  findTargetInHtml,
  resolvePlaceFromLink,
  resolveShortLink,
  type FetchInitLike,
  type FetchLike,
  type FetchResponseLike,
} from '../resolveLink';
import { MAPS_STRINGS } from '../strings';

// Example links follow the formats Google Maps produces today; ids and hashes are made up.
const SHORT = 'https://maps.app.goo.gl/q8Ywc4ZSkx5nBYXn8';
const OLD_SHORT = 'https://goo.gl/maps/7uMVcPZ6Dyw9QpRC7';
const LONG =
  'https://www.google.com/maps/place/La+Fuente,+33314+Villaviciosa,+Asturias/@43.5389612,-5.4021553,17z/data=!3m1!4b1!4m6!3m5!1s0xd367d0c2b6a3c1b:0x8f2b1e4a5c3d2e1f!8m2!3d43.5389573!4d-5.3995804!16s%2Fg%2F11c5r8zq2w?entry=ttu&g_st=ic';
const CONSENT = `https://consent.google.com/ml?continue=${encodeURIComponent(LONG)}&gl=IT&m=0&pc=m&uxe=eomtm&cm=2&hl=it&src=1`;
const PIN = { lat: 43.5389573, lng: -5.3995804 };

type Reply = { status: number; location?: string; url?: string; body?: string; type?: string } | 'network-error' | 'hang';
type Route = Reply | ((init: FetchInitLike) => Reply);

function fakeFetch(routes: Record<string, Route>) {
  const calls: { url: string; init: FetchInitLike }[] = [];
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const route = routes[url];
    if (!route) throw new Error(`unexpected request to ${url}`);
    const r = typeof route === 'function' ? route(init) : route;
    if (r === 'network-error') throw new TypeError('Network request failed');
    if (r === 'hang') {
      return new Promise<FetchResponseLike>((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
      });
    }
    return {
      status: r.status,
      url: r.url ?? url,
      type: r.type ?? 'default',
      headers: { get: (k: string) => (k.toLowerCase() === 'location' ? (r.location ?? null) : null) },
      text: async () => r.body ?? '',
    };
  };
  return { impl, calls };
}

const typed: Place = { label: 'Il mio spot', address: 'Playa de La Fuente, Villaviciosa', mapUrl: null, coords: null, resolution: 'none', resolutionNote: null };

describe('resolvePlaceFromLink — short links', () => {
  it('follows a redirect chain hop by hop and stops at the first Google Maps URL', async () => {
    const { impl, calls } = fakeFetch({
      [OLD_SHORT]: { status: 301, location: SHORT },
      [SHORT]: { status: 302, location: LONG },
    });
    const place = await resolvePlaceFromLink(OLD_SHORT, { fetchImpl: impl });
    expect(place).toEqual({
      label: 'La Fuente, 33314 Villaviciosa, Asturias',
      address: null,
      mapUrl: OLD_SHORT,
      coords: PIN,
      resolution: 'resolved',
      resolutionNote: null,
    });
    expect(calls.map((c) => c.url)).toEqual([OLD_SHORT, SHORT]); // the heavy Maps page is never downloaded
    for (const c of calls) expect(c.init).toMatchObject({ method: 'GET', redirect: 'manual', credentials: 'omit' });
  });

  it('keeps the label and address the user typed, and the pasted link verbatim', async () => {
    const pasted = `  ${SHORT}?g_st=ic `;
    const { impl } = fakeFetch({ [`${SHORT}?g_st=ic`]: { status: 302, location: LONG } });
    const place = await resolvePlaceFromLink(pasted, typed, { fetchImpl: impl });
    expect(place).toMatchObject({ label: 'Il mio spot', address: 'Playa de La Fuente, Villaviciosa', mapUrl: `${SHORT}?g_st=ic`, coords: PIN, resolution: 'resolved' });
  });

  it('reads response.url when the platform follows redirects itself (redirect: manual ignored)', async () => {
    const { impl, calls } = fakeFetch({ [SHORT]: { status: 200, url: LONG, body: '<html>…maps page…</html>' } });
    const place = await resolvePlaceFromLink(SHORT, { fetchImpl: impl });
    expect(place).toMatchObject({ coords: PIN, resolution: 'resolved' });
    expect(calls).toHaveLength(1);
  });

  it('extracts the continue= target from a consent page reached by following redirects', async () => {
    const { impl } = fakeFetch({ [SHORT]: { status: 200, url: CONSENT, body: '<html>Prima di continuare su Google</html>' } });
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: impl })).toMatchObject({ coords: PIN, resolution: 'resolved', label: 'La Fuente, 33314 Villaviciosa, Asturias' });
  });

  it('extracts the continue= target from a consent Location without requesting the consent page', async () => {
    const { impl, calls } = fakeFetch({ [SHORT]: { status: 302, location: CONSENT } });
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: impl })).toMatchObject({ coords: PIN, resolution: 'resolved' });
    expect(calls.map((c) => c.url)).toEqual([SHORT]);
  });

  it('reads the consent form when the consent URL has no continue parameter', async () => {
    const consentNoParam = 'https://consent.google.com/ml?gl=IT&hl=it';
    const form = `<form action="https://consent.google.com/save" method="POST"><input type="hidden" name="gl" value="IT"><input type="hidden" name="continue" value="https://www.google.com/maps/place/La+Fuente/@43.53,-5.40,17z/data=!3d43.5389573!4d-5.3995804?entry=ttu&amp;hl=it"><button>Accetta tutto</button></form>`;
    const { impl, calls } = fakeFetch({
      [SHORT]: { status: 302, location: consentNoParam },
      [consentNoParam]: { status: 200, body: form },
    });
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: impl })).toMatchObject({ coords: PIN, label: 'La Fuente', resolution: 'resolved' });
    expect(calls.map((c) => c.url)).toEqual([SHORT, consentNoParam]);
  });

  it('follows a meta refresh on a 200 short-link page, and relative Location headers', async () => {
    const { impl } = fakeFetch({
      [SHORT]: { status: 200, body: '<html><head><meta http-equiv="refresh" content="0; url=/maps/x"></head></html>' },
      'https://maps.app.goo.gl/maps/x': { status: 302, location: '//www.google.com/maps/@43.4623,-3.8099,15z' },
    });
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: impl })).toMatchObject({
      coords: { lat: 43.4623, lng: -3.8099 },
      resolution: 'resolved',
      resolutionNote: MAPS_STRINGS.viewportOnly,
    });
  });

  it('retries a browser opaque redirect with redirect: follow', async () => {
    const { impl, calls } = fakeFetch({
      [SHORT]: (init) => (init.redirect === 'manual' ? { status: 0, type: 'opaqueredirect' } : { status: 200, url: LONG }),
    });
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: impl })).toMatchObject({ coords: PIN, resolution: 'resolved' });
    expect(calls.map((c) => c.init.redirect)).toEqual(['manual', 'follow']);
  });

  it('a browser that hides the redirect and then blocks the read (CORS) is not reported as offline', async () => {
    const { impl } = fakeFetch({
      [SHORT]: (init) => (init.redirect === 'manual' ? { status: 0, type: 'opaqueredirect' } : 'network-error'),
    });
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: impl })).toMatchObject({ resolution: 'unresolved', resolutionNote: MAPS_STRINGS.blockedByBrowser });
  });

  it('fetches http:// short links over https', async () => {
    const { impl, calls } = fakeFetch({ [SHORT]: { status: 302, location: LONG } });
    const place = await resolvePlaceFromLink(SHORT.replace('https://', 'http://'), { fetchImpl: impl });
    expect(place).toMatchObject({ resolution: 'resolved', mapUrl: SHORT.replace('https://', 'http://') });
    expect(calls[0].url).toBe(SHORT);
  });

  it('timeout → unresolved with a note; link, label and address kept', async () => {
    const { impl } = fakeFetch({ [SHORT]: 'hang' });
    const place = await resolvePlaceFromLink(SHORT, typed, { fetchImpl: impl, timeoutMs: 25 });
    expect(place).toEqual({ ...typed, mapUrl: SHORT, coords: null, resolution: 'unresolved', resolutionNote: MAPS_STRINGS.timeout });
  });

  it('a fetch that ignores the abort signal still times out', async () => {
    const impl: FetchLike = () => new Promise<FetchResponseLike>(() => undefined);
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: impl, timeoutMs: 20 })).toMatchObject({ resolution: 'unresolved', resolutionNote: MAPS_STRINGS.timeout });
  });

  it('offline → unresolved with a note', async () => {
    const { impl } = fakeFetch({ [SHORT]: 'network-error' });
    expect(await resolvePlaceFromLink(SHORT, typed, { fetchImpl: impl })).toMatchObject({
      label: 'Il mio spot',
      mapUrl: SHORT,
      coords: null,
      resolution: 'unresolved',
      resolutionNote: MAPS_STRINGS.offline,
    });
  });

  it('a final URL outside Google Maps → unsupported, and that host is never requested', async () => {
    const { impl, calls } = fakeFetch({ [SHORT]: { status: 302, location: 'https://example.com/promo?utm=1' } });
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: impl })).toMatchObject({
      mapUrl: SHORT,
      coords: null,
      resolution: 'unsupported',
      resolutionNote: MAPS_STRINGS.shortNotMaps,
    });
    expect(calls.map((c) => c.url)).toEqual([SHORT]);
  });

  it('a platform-followed chain landing outside Google Maps → unsupported', async () => {
    const { impl } = fakeFetch({ [SHORT]: { status: 200, url: 'https://example.com/landing', body: '<a href="https://www.google.com/maps/@1,2,3z">x</a>' } });
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: impl })).toMatchObject({ resolution: 'unsupported', resolutionNote: MAPS_STRINGS.shortNotMaps });
  });

  it('a place named only by text → unresolved; the user can place the pin (no geocoding)', async () => {
    const final = 'https://maps.google.com/?q=Playa+de+Rodiles&ftid=0xd3675b6f3a2e2f3d:0x8f0a0b0c0d0e0f10';
    const { impl, calls } = fakeFetch({ [SHORT]: { status: 302, location: final } });
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: impl })).toEqual({
      label: 'Playa de Rodiles',
      address: null,
      mapUrl: SHORT,
      coords: null,
      resolution: 'unresolved',
      resolutionNote: MAPS_STRINGS.nameOnly,
    });
    expect(calls).toHaveLength(1);
    expect(await resolvePlaceFromLink(SHORT, typed, { fetchImpl: impl })).toMatchObject({ label: 'Il mio spot', resolution: 'unresolved' });
  });

  it('HTTP errors → unresolved with the reason', async () => {
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: fakeFetch({ [SHORT]: { status: 404 } }).impl })).toMatchObject({ resolution: 'unresolved', resolutionNote: MAPS_STRINGS.notFound });
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: fakeFetch({ [SHORT]: { status: 503 } }).impl })).toMatchObject({ resolution: 'unresolved', resolutionNote: MAPS_STRINGS.httpError });
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: fakeFetch({ [SHORT]: { status: 302 } }).impl })).toMatchObject({ resolution: 'unresolved', resolutionNote: MAPS_STRINGS.httpError });
  });

  it('a 200 short-link page without any target → unresolved (interstitial)', async () => {
    const { impl } = fakeFetch({ [SHORT]: { status: 200, body: '<html><body>Apri nell’app</body></html>' } });
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: impl })).toMatchObject({ resolution: 'unresolved', resolutionNote: MAPS_STRINGS.interstitial });
  });

  it('redirect loops and over-long chains stop', async () => {
    const other = 'https://goo.gl/maps/loop';
    const loop = fakeFetch({ [SHORT]: { status: 302, location: other }, [other]: { status: 302, location: SHORT } });
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: loop.impl })).toMatchObject({ resolution: 'unresolved', resolutionNote: MAPS_STRINGS.tooManyRedirects });
    expect(loop.calls).toHaveLength(2);

    const long = fakeFetch({ [SHORT]: { status: 302, location: OLD_SHORT }, [OLD_SHORT]: { status: 302, location: LONG } });
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: long.impl, maxRedirects: 1 })).toMatchObject({ resolution: 'unresolved', resolutionNote: MAPS_STRINGS.tooManyRedirects });
  });

  it('a manual pin survives a failed resolution', async () => {
    const manual: Place = { ...typed, coords: { lat: 43.54, lng: -5.4 }, resolution: 'manual' };
    const { impl } = fakeFetch({ [SHORT]: 'network-error' });
    expect(await resolvePlaceFromLink(SHORT, manual, { fetchImpl: impl })).toMatchObject({ mapUrl: SHORT, coords: { lat: 43.54, lng: -5.4 }, resolution: 'manual' });
  });

  it('never throws, even if the fetch implementation throws synchronously', async () => {
    const impl = (() => {
      throw new Error('boom');
    }) as unknown as FetchLike;
    expect(await resolvePlaceFromLink(SHORT, { fetchImpl: impl })).toMatchObject({ resolution: 'unresolved', resolutionNote: MAPS_STRINGS.offline });
  });
});

describe('resolvePlaceFromLink — global fetch and the session sheet call shape', () => {
  const realFetch = (globalThis as { fetch?: unknown }).fetch;
  afterEach(() => {
    (globalThis as { fetch?: unknown }).fetch = realFetch;
  });

  it('uses the global fetch by default, called through globalThis', async () => {
    const { impl, calls } = fakeFetch({ [SHORT]: { status: 302, location: LONG } });
    (globalThis as { fetch?: unknown }).fetch = jest.fn(function (this: unknown, url: string, init: FetchInitLike) {
      expect(this === undefined || this === globalThis).toBe(true);
      return impl(url, init);
    });
    // The session sheet calls resolvePlaceFromLink(url, pendingPlace).
    const pending = buildPlaceFromLink(SHORT, typed);
    expect(pending.resolution).toBe('pending');
    expect(await resolvePlaceFromLink(SHORT, pending)).toMatchObject({ label: 'Il mio spot', coords: PIN, resolution: 'resolved' });
    expect(calls).toHaveLength(1);
  });

  it('without any fetch implementation → unresolved, honestly reported', async () => {
    delete (globalThis as { fetch?: unknown }).fetch;
    expect(await resolvePlaceFromLink(SHORT)).toMatchObject({ resolution: 'unresolved', resolutionNote: MAPS_STRINGS.noNetworkApi, mapUrl: SHORT });
  });

  it('links that are not short never touch the network', async () => {
    const spy = jest.fn();
    (globalThis as { fetch?: unknown }).fetch = spy;
    expect(await resolvePlaceFromLink(LONG)).toMatchObject({ coords: PIN, resolution: 'resolved' });
    expect(await resolvePlaceFromLink('https://example.com/x')).toMatchObject({ resolution: 'unsupported' });
    expect(await resolvePlaceFromLink('https://maps.google.com/?q=Playa+de+Rodiles')).toMatchObject({ resolution: 'unresolved', resolutionNote: MAPS_STRINGS.nameOnly });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('resolveShortLink', () => {
  it('reports hops and the final URL', async () => {
    const { impl } = fakeFetch({ [OLD_SHORT]: { status: 301, location: SHORT }, [SHORT]: { status: 302, location: LONG } });
    const r = await resolveShortLink(OLD_SHORT, { fetchImpl: impl });
    expect(r).toMatchObject({ status: 'resolved', finalUrl: LONG, hops: [SHORT, LONG], link: { kind: 'coords', source: 'pin' } });
  });

  it('reports the failure kind and HTTP status', async () => {
    const r = await resolveShortLink(SHORT, { fetchImpl: fakeFetch({ [SHORT]: { status: 404 } }).impl });
    expect(r).toMatchObject({ status: 'http_error', httpStatus: 404, lastUrl: SHORT });
  });
});

describe('findTargetInHtml', () => {
  it('finds JS-escaped Google Maps URLs but ignores unrelated Google links', () => {
    const html = `<a href="https://policies.google.com/privacy?hl=it">Privacy</a><script>var u="https:\\/\\/www.google.com\\/maps\\/place\\/X\\/@43.46,-3.81,17z\\/data\\u003d!3d43.4621!4d-3.81";</script>`;
    expect(findTargetInHtml(html, SHORT)).toBe('https://www.google.com/maps/place/X/@43.46,-3.81,17z/data=!3d43.4621!4d-3.81');
    expect(findTargetInHtml('<a href="https://example.com/maps/@1,2,3z">x</a>', SHORT)).toBeNull();
  });
});

describe('buildPlaceFromLink', () => {
  it('accepts (previous, url) and (url, previous)', () => {
    expect(buildPlaceFromLink(typed, LONG)).toEqual(buildPlaceFromLink(LONG, typed));
    expect(buildPlaceFromLink(null, LONG)).toEqual(buildPlaceFromLink(LONG));
  });

  it('coordinates in the link → resolved; typed label and address win', () => {
    expect(buildPlaceFromLink(typed, LONG)).toEqual({ ...typed, mapUrl: LONG, coords: PIN, resolution: 'resolved', resolutionNote: null });
    expect(buildPlaceFromLink(null, LONG)).toMatchObject({ label: 'La Fuente, 33314 Villaviciosa, Asturias', address: null });
  });

  it('a label filled from the previous link is replaced by the new link’s', () => {
    const fromOld = buildPlaceFromLink(null, LONG);
    const next = buildPlaceFromLink(fromOld, 'https://www.google.com/maps/place/Playa+de+Rodiles/@43.52,-5.40,14z/data=!3d43.5321!4d-5.3727');
    expect(next).toMatchObject({ label: 'Playa de Rodiles', coords: { lat: 43.5321, lng: -5.3727 } });
  });

  it('the same link again returns the previous place untouched (e.g. after a manual correction)', () => {
    const corrected: Place = { ...buildPlaceFromLink(typed, LONG), coords: { lat: 43.539, lng: -5.4 }, resolution: 'manual' };
    expect(buildPlaceFromLink(corrected, ` ${LONG} `)).toBe(corrected);
  });

  it('short link → pending, no coordinates guessed', () => {
    expect(buildPlaceFromLink(typed, SHORT)).toEqual({ ...typed, mapUrl: SHORT, coords: null, resolution: 'pending', resolutionNote: null });
  });

  it('name only → unresolved with the manual-pin note, label from the link if none typed', () => {
    expect(buildPlaceFromLink(null, 'https://maps.google.com/?q=Playa+de+Rodiles')).toMatchObject({
      label: 'Playa de Rodiles',
      coords: null,
      resolution: 'unresolved',
      resolutionNote: MAPS_STRINGS.nameOnly,
    });
  });

  it('viewport-only → resolved, flagged as the map centre', () => {
    expect(buildPlaceFromLink(null, 'https://www.google.com/maps/@43.4623052,-3.8099803,15z')).toMatchObject({ resolution: 'resolved', resolutionNote: MAPS_STRINGS.viewportOnly });
  });

  it('unsupported, directions and invalid links are kept with a reason', () => {
    expect(buildPlaceFromLink(typed, 'https://example.com/x')).toMatchObject({ mapUrl: 'https://example.com/x', resolution: 'unsupported', resolutionNote: null, label: 'Il mio spot' });
    expect(buildPlaceFromLink(null, 'https://www.google.com/maps/dir/Madrid/Oviedo/')).toMatchObject({ resolution: 'unsupported', resolutionNote: MAPS_STRINGS.directions });
    expect(buildPlaceFromLink(null, 'qui al faro')).toMatchObject({ mapUrl: 'qui al faro', resolution: 'unsupported', resolutionNote: MAPS_STRINGS.notALink });
    expect(buildPlaceFromLink(null, 'https://www.google.com/maps/@95,10,15z')).toMatchObject({ resolution: 'unsupported', resolutionNote: MAPS_STRINGS.outOfRange, coords: null });
    expect(buildPlaceFromLink(null, 'https://maps.google.com/?cid=10281119596374313554')).toMatchObject({ resolution: 'unresolved', resolutionNote: MAPS_STRINGS.noCoordinates });
  });

  it('a manual pin survives links without coordinates and yields to links with coordinates', () => {
    const manual: Place = { ...typed, coords: { lat: 43.54, lng: -5.4 }, resolution: 'manual' };
    expect(buildPlaceFromLink(manual, 'https://maps.google.com/?q=Playa+de+Rodiles')).toMatchObject({ coords: { lat: 43.54, lng: -5.4 }, resolution: 'manual', resolutionNote: null });
    expect(buildPlaceFromLink(manual, SHORT)).toMatchObject({ coords: { lat: 43.54, lng: -5.4 }, resolution: 'pending' });
    expect(buildPlaceFromLink(manual, LONG)).toMatchObject({ coords: PIN, resolution: 'resolved' });
  });

  it('removing the link keeps a manual pin and drops link-derived coordinates', () => {
    expect(buildPlaceFromLink({ ...typed, mapUrl: LONG, coords: PIN, resolution: 'resolved' }, '  ')).toEqual({ ...typed, mapUrl: null, coords: null, resolution: 'none', resolutionNote: null });
    expect(buildPlaceFromLink({ ...typed, mapUrl: LONG, coords: { lat: 1, lng: 2 }, resolution: 'manual' }, '')).toMatchObject({ mapUrl: null, coords: { lat: 1, lng: 2 }, resolution: 'manual' });
  });
});
