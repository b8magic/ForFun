import { absolutize, extractLink, labelFromLink, parseMapsLink, percentDecode, splitUrl } from '../parseLink';

// Example links follow the formats Google Maps produces today; ids and hashes are made up.
const PLACE_WITH_PIN =
  'https://www.google.com/maps/place/La+Fuente,+33314+Villaviciosa,+Asturias/@43.5389612,-5.4021553,17z/data=!3m1!4b1!4m6!3m5!1s0xd367d0c2b6a3c1b:0x8f2b1e4a5c3d2e1f!8m2!3d43.5389573!4d-5.3995804!16s%2Fg%2F11c5r8zq2w?entry=ttu&g_ep=EgoyMDI2MTAwNi4wIKXMDSoASAFQAw%3D%3D';

describe('parseMapsLink — place pages', () => {
  it('reads the !3d!4d pin as the place, with the decoded /place/ name as label', () => {
    expect(parseMapsLink(PLACE_WITH_PIN)).toEqual({
      kind: 'coords',
      coords: { lat: 43.5389573, lng: -5.3995804 },
      label: 'La Fuente, 33314 Villaviciosa, Asturias',
      source: 'pin',
      placeId: null,
      url: PLACE_WITH_PIN,
    });
  });

  it('pin wins over a different @ viewport', () => {
    const url = 'https://www.google.com/maps/place/Playa+de+Rodiles/@43.52,-5.40,14z/data=!4m6!3m5!1s0x0:0x0!8m2!3d43.5321!4d-5.3727';
    const p = parseMapsLink(url);
    expect(p).toMatchObject({ kind: 'coords', source: 'pin', coords: { lat: 43.5321, lng: -5.3727 }, label: 'Playa de Rodiles' });
  });

  it('uses the last pin of the data blob (the selected place)', () => {
    const url = 'https://www.google.com/maps/place/Faro/@43.0,-5.0,15z/data=!4m10!3m5!1s0x1:0x1!8m2!3d43.1!4d-5.1!3m3!8m2!3d43.4865!4d-3.7984';
    expect(parseMapsLink(url)).toMatchObject({ coords: { lat: 43.4865, lng: -3.7984 }, source: 'pin' });
  });

  it('falls back to the viewport of a /place/ page without pin (source viewport, label kept)', () => {
    const p = parseMapsLink('https://www.google.it/maps/place/Caf%C3%A9+del+Mar/@38.9822,1.3010,17z');
    expect(p).toMatchObject({ kind: 'coords', source: 'viewport', coords: { lat: 38.9822, lng: 1.301 }, label: 'Café del Mar' });
  });

  it('decodes labels: + is a space, %2B is a plus, UTF-8, quotes and ampersands; malformed escapes are kept', () => {
    const lbl = (name: string) => labelFromLink(`https://www.google.com/maps/place/${name}/@43.46,-3.81,17z`);
    expect(lbl('Bar+%26+Grill+%22El+Faro%22')).toBe('Bar & Grill "El Faro"');
    expect(lbl('C%2B%2B+Caf%C3%A9')).toBe('C++ Café');
    expect(lbl('Spiaggia+di+Cal%C3%A0+Gonone')).toBe('Spiaggia di Calà Gonone');
    expect(lbl('100%25+Surf+%ZZ')).toBe('100% Surf %ZZ');
  });

  it('a dropped pin named in DMS reads as coordinates, not as a label', () => {
    const dmsOnly = parseMapsLink("https://www.google.com/maps/place/43%C2%B027'43.6%22N+3%C2%B048'36.0%22W");
    expect(dmsOnly).toMatchObject({ kind: 'coords', source: 'query', label: null });
    if (dmsOnly.kind !== 'coords') throw new Error();
    expect(dmsOnly.coords.lat).toBeCloseTo(43.462111, 6);
    expect(dmsOnly.coords.lng).toBeCloseTo(-3.81, 6);

    const withPin = parseMapsLink("https://www.google.com/maps/place/43%C2%B027'43.6%22N+3%C2%B048'36.0%22W/@43.4621111,-3.81,17z/data=!4m4!3m3!8m2!3d43.4621111!4d-3.81");
    expect(withPin).toMatchObject({ kind: 'coords', source: 'pin', coords: { lat: 43.4621111, lng: -3.81 }, label: null });
  });

  it('a /place/ page with no coordinates at all is a place query (no guessing)', () => {
    expect(parseMapsLink('https://www.google.com/maps/place/Playa+de+Rodiles/data=!4m2!3m1!1s0xd3675b6f3a2e2f3d:0x8f0a0b0c0d0e0f10')).toMatchObject({
      kind: 'place_query',
      query: 'Playa de Rodiles',
    });
  });
});

describe('parseMapsLink — viewport, q=, ll=, api=1', () => {
  it('@lat,lng,zoom alone is a viewport', () => {
    expect(parseMapsLink('https://www.google.com/maps/@43.4623052,-3.8099803,15z?entry=ttu')).toMatchObject({
      kind: 'coords',
      source: 'viewport',
      coords: { lat: 43.4623052, lng: -3.8099803 },
      label: null,
    });
    expect(parseMapsLink('https://www.google.com/maps/@41.9027835,12.4963655,1234m/data=!3m1!1e3')).toMatchObject({ source: 'viewport', coords: { lat: 41.9027835, lng: 12.4963655 } });
    expect(parseMapsLink('https://www.google.com/maps/@43.4621,-3.81,3a,75y,90t/data=!3m6!1e1!3m4!1sAF1QipN!2e10!7i8704!8i4352')).toMatchObject({ source: 'viewport' });
  });

  it('?q=lat,lng is an explicit point, in every host spelling', () => {
    for (const url of [
      'https://www.google.com/maps?q=43.4621,-3.8100',
      'https://maps.google.com/?q=43.4621%2C-3.81',
      'https://maps.google.com/maps?q=43.4621,-3.81&z=17&hl=it',
      'http://maps.google.com/?q=43.4621,+-3.81',
      'https://www.google.com/maps?q=loc:43.4621+-3.81',
    ]) {
      expect(parseMapsLink(url)).toMatchObject({ kind: 'coords', source: 'query', coords: { lat: 43.4621, lng: -3.81 } });
    }
  });

  it('?q=lat,lng(Label) keeps the label', () => {
    expect(parseMapsLink('https://maps.google.com/?q=43.5389,-5.3995(La+Fuente)')).toMatchObject({ coords: { lat: 43.5389, lng: -5.3995 }, label: 'La Fuente' });
  });

  it('?q=Name is a place query', () => {
    expect(parseMapsLink('https://maps.google.com/?q=Playa+de+Rodiles,+Villaviciosa')).toEqual({
      kind: 'place_query',
      query: 'Playa de Rodiles, Villaviciosa',
      placeId: null,
      url: 'https://maps.google.com/?q=Playa+de+Rodiles,+Villaviciosa',
    });
  });

  it('api=1 search: query=lat,lng → coords; query=Name keeps query_place_id', () => {
    expect(parseMapsLink('https://www.google.com/maps/search/?api=1&query=47.5951518%2C-122.3316393')).toMatchObject({
      kind: 'coords',
      source: 'query',
      coords: { lat: 47.5951518, lng: -122.3316393 },
    });
    expect(parseMapsLink('https://www.google.com/maps/search/?api=1&query=Centurylink+Field&query_place_id=ChIJKxjxuaNqkFQR3CK6O1HNNqY')).toMatchObject({
      kind: 'place_query',
      query: 'Centurylink Field',
      placeId: 'ChIJKxjxuaNqkFQR3CK6O1HNNqY',
    });
    expect(parseMapsLink('https://www.google.com/maps/search/?api=1&query=43.4621,-3.81&query_place_id=ChIJabc')).toMatchObject({ kind: 'coords', placeId: 'ChIJabc' });
  });

  it('/maps/search/<lat,lng> is a point; /maps/search/<text>/@viewport is only a search', () => {
    expect(parseMapsLink('https://www.google.com/maps/search/43.4621,+-3.8100/@43.46,-3.81,17z')).toMatchObject({ kind: 'coords', source: 'query', coords: { lat: 43.4621, lng: -3.81 } });
    expect(parseMapsLink('https://www.google.com/maps/search/surf+school/@43.46,-3.81,14z')).toMatchObject({ kind: 'place_query', query: 'surf school' });
  });

  it('ll= and sll= are map centres (viewport); a text q= next to them stays a query', () => {
    expect(parseMapsLink('https://maps.google.com/maps?ll=43.4621,-3.81&z=15&t=m')).toMatchObject({ kind: 'coords', source: 'viewport', coords: { lat: 43.4621, lng: -3.81 } });
    expect(parseMapsLink('https://maps.google.com/maps?sll=43.4621,-3.81&sspn=0.01,0.02')).toMatchObject({ kind: 'coords', source: 'viewport' });
    expect(parseMapsLink('https://maps.google.com/maps?q=Playa+de+Rodiles&ll=43.53,-5.37')).toMatchObject({ kind: 'place_query', query: 'Playa de Rodiles' });
    expect(parseMapsLink('https://maps.google.com/maps?ll=43.53,-5.37&q=43.5321,-5.3727')).toMatchObject({ source: 'query', coords: { lat: 43.5321, lng: -5.3727 } });
  });

  it('api=1 map / pano centres are viewports', () => {
    expect(parseMapsLink('https://www.google.com/maps/@?api=1&map_action=map&center=-33.712206,150.311941&zoom=12')).toMatchObject({ source: 'viewport', coords: { lat: -33.712206, lng: 150.311941 } });
    expect(parseMapsLink('https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=48.857832,2.295226')).toMatchObject({ source: 'viewport' });
  });

  it('cid-only links name a place Google knows but carry no position', () => {
    expect(parseMapsLink('https://maps.google.com/?cid=10281119596374313554')).toMatchObject({ kind: 'unsupported', reason: 'no_location' });
    expect(parseMapsLink('https://www.google.com/maps')).toMatchObject({ kind: 'unsupported', reason: 'no_location' });
  });
});

describe('parseMapsLink — directions', () => {
  it('a route between named places is not a single place', () => {
    const url =
      'https://www.google.com/maps/dir/Madrid/Villaviciosa,+Asturias/@41.9,-4.8,7z/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0xd422997800a3c81:0xc436dec1618c2269!2m2!1d-3.7037902!2d40.4167754!1m5!1m1!1s0xd367:0x1!2m2!1d-5.4!2d43.48!3e0';
    expect(parseMapsLink(url)).toEqual({ kind: 'unsupported', reason: 'directions', url });
    expect(parseMapsLink('https://www.google.com/maps/dir/?api=1&origin=Space+Needle+Seattle+WA&destination=Pike+Place+Market+Seattle+WA&travelmode=bicycling')).toMatchObject({
      kind: 'unsupported',
      reason: 'directions',
    });
  });

  it('a destination coordinate makes it a place', () => {
    expect(parseMapsLink('https://www.google.com/maps/dir/Oviedo/43.5389573,-5.3995804/@43.4,-5.6,11z/data=!3m1!4b1')).toMatchObject({ kind: 'coords', source: 'query', coords: { lat: 43.5389573, lng: -5.3995804 } });
    expect(parseMapsLink('https://www.google.com/maps/dir/?api=1&destination=43.5389573%2C-5.3995804&travelmode=driving')).toMatchObject({ kind: 'coords', coords: { lat: 43.5389573, lng: -5.3995804 } });
    expect(parseMapsLink('https://maps.google.com/maps?saddr=Oviedo&daddr=43.5389,-5.3995')).toMatchObject({ kind: 'coords', coords: { lat: 43.5389, lng: -5.3995 } });
    expect(parseMapsLink('https://maps.google.com/maps?saddr=Oviedo&daddr=Gij%C3%B3n+to:43.5389,-5.3995')).toMatchObject({ kind: 'coords', coords: { lat: 43.5389, lng: -5.3995 } });
    expect(parseMapsLink('https://www.google.com/maps/dir//43.5389573,-5.3995804/@43.4,-5.6,11z')).toMatchObject({ kind: 'coords' });
    expect(parseMapsLink('https://www.google.com/maps/dir/Oviedo/43.5389573,-5.3995804/')).toMatchObject({ kind: 'coords' });
  });

  it('an origin coordinate is not a destination', () => {
    expect(parseMapsLink('https://www.google.com/maps/dir/43.5389573,-5.3995804//@43.4,-5.6,11z')).toMatchObject({ kind: 'unsupported', reason: 'directions' });
    expect(parseMapsLink('https://www.google.com/maps/dir/43.5389573,-5.3995804/')).toMatchObject({ kind: 'unsupported', reason: 'directions' });
  });
});

describe('parseMapsLink — hosts, short links, wrappers', () => {
  it('accepts country domains and maps.google.*', () => {
    for (const host of ['www.google.it', 'www.google.es', 'google.fr', 'www.google.co.uk', 'www.google.com.au', 'www.google.cat']) {
      expect(parseMapsLink(`https://${host}/maps/@43.46,-3.81,15z`)).toMatchObject({ kind: 'coords', source: 'viewport' });
    }
    expect(parseMapsLink('https://maps.google.it/maps?q=43.46,-3.81')).toMatchObject({ kind: 'coords', source: 'query' });
    expect(parseMapsLink('HTTPS://WWW.GOOGLE.COM/maps/@43.46,-3.81,15z')).toMatchObject({ kind: 'coords' });
  });

  it('short links need resolution', () => {
    for (const url of ['https://maps.app.goo.gl/q8Ywc4ZSkx5nBYXn8', 'https://maps.app.goo.gl/q8Ywc4ZSkx5nBYXn8?g_st=ic', 'https://goo.gl/maps/7uMVcPZ6Dyw9QpRC7']) {
      expect(parseMapsLink(url)).toEqual({ kind: 'short', url });
    }
    expect(parseMapsLink('maps.app.goo.gl/q8Ywc4ZSkx5nBYXn8')).toEqual({ kind: 'short', url: 'https://maps.app.goo.gl/q8Ywc4ZSkx5nBYXn8' });
  });

  it('finds the link inside share-sheet text and strips prose punctuation', () => {
    expect(parseMapsLink('La Fuente\nhttps://maps.app.goo.gl/q8Ywc4ZSkx5nBYXn8')).toEqual({ kind: 'short', url: 'https://maps.app.goo.gl/q8Ywc4ZSkx5nBYXn8' });
    expect(parseMapsLink('Ci vediamo qui (https://maps.app.goo.gl/q8Ywc4ZSkx5nBYXn8).')).toEqual({ kind: 'short', url: 'https://maps.app.goo.gl/q8Ywc4ZSkx5nBYXn8' });
    expect(parseMapsLink('vedi https://example.com e https://maps.google.com/?q=43.46,-3.81')).toMatchObject({ kind: 'coords' });
    // A ')' that closes a '(' inside the URL stays.
    expect(extractLink('https://maps.google.com/?q=43.5389,-5.3995(La+Fuente)')).toBe('https://maps.google.com/?q=43.5389,-5.3995(La+Fuente)');
  });

  it('consent / sorry pages and google.com/url wrappers are unwrapped through their target', () => {
    const consent =
      'https://consent.google.com/ml?continue=https%3A%2F%2Fwww.google.com%2Fmaps%2Fplace%2FLa%2BFuente%2F%4043.5389612%2C-5.4021553%2C17z%2Fdata%3D!3m1!4b1!4m6!3m5!1s0x0%3A0x0!8m2!3d43.5389573!4d-5.3995804%3Fentry%3Dttu&gl=IT&m=0&pc=m&uxe=eomtm&cm=2&hl=it&src=1';
    expect(parseMapsLink(consent)).toMatchObject({ kind: 'coords', source: 'pin', coords: { lat: 43.5389573, lng: -5.3995804 }, label: 'La Fuente' });
    // Unencoded continue whose '+' became a space during decoding.
    expect(parseMapsLink('https://consent.google.it/ml?continue=https://www.google.com/maps/place/La+Fuente/@43.53,-5.40,17z/data=!3d43.5389573!4d-5.3995804&hl=it')).toMatchObject({
      label: 'La Fuente',
      source: 'pin',
    });
    expect(parseMapsLink('https://www.google.com/sorry/index?continue=https://www.google.com/maps/%4043.46,-3.81,15z&q=EgS')).toMatchObject({ kind: 'coords', source: 'viewport' });
    expect(parseMapsLink('https://www.google.com/url?q=https://maps.app.goo.gl/q8Ywc4ZSkx5nBYXn8&sa=D&source=editors&ust=1760000000000000&usg=AOvVaw0abc')).toEqual({
      kind: 'short',
      url: 'https://maps.app.goo.gl/q8Ywc4ZSkx5nBYXn8',
    });
    expect(parseMapsLink('https://consent.google.com/ml?gl=IT&hl=it')).toMatchObject({ kind: 'unsupported', reason: 'interstitial' });
  });

  it('non-maps URLs are unsupported (including Google web search and plain goo.gl)', () => {
    for (const url of [
      'https://www.google.com/search?q=43.46,-3.81',
      'https://www.google.com/?q=43.46,-3.81',
      'https://goo.gl/abc123',
      'https://example.com/maps/place/La+Fuente/@43.46,-3.81,17z',
      'http://maps.apple.com/?ll=43.46,-3.81&q=La%20Fuente',
      'https://maps.app.goo.gl/',
      'geo:43.46,-3.81',
      'example.com',
    ]) {
      expect(parseMapsLink(url)).toMatchObject({ kind: 'unsupported', reason: 'not_maps' });
    }
  });

  it('text without a link is invalid', () => {
    for (const s of ['', '   ', 'La Fuente', 'Villaviciosa, Asturias', '@43.46,-3.81', '43.46,-3.81']) {
      expect(parseMapsLink(s)).toEqual({ kind: 'invalid', reason: 'not_a_url', url: null });
    }
    expect(parseMapsLink(undefined as unknown as string)).toMatchObject({ kind: 'invalid' });
  });
});

describe('parseMapsLink — ranges', () => {
  it('rejects coordinates outside |lat|≤90, |lng|≤180', () => {
    expect(parseMapsLink('https://www.google.com/maps/@95.0,10.0,15z')).toMatchObject({ kind: 'invalid', reason: 'out_of_range' });
    expect(parseMapsLink('https://maps.google.com/?q=43.0,200.0')).toMatchObject({ kind: 'invalid', reason: 'out_of_range' });
    expect(parseMapsLink('https://maps.google.com/?q=-90.0001,0')).toMatchObject({ kind: 'invalid', reason: 'out_of_range' });
    expect(parseMapsLink('https://www.google.com/maps/dir/?api=1&destination=91,10')).toMatchObject({ kind: 'invalid', reason: 'out_of_range' });
    expect(parseMapsLink("https://www.google.com/maps/place/43%C2%B075'00.0%22N+3%C2%B048'36.0%22W")).toMatchObject({ kind: 'invalid', reason: 'out_of_range' });
  });

  it('accepts the exact limits', () => {
    expect(parseMapsLink('https://maps.google.com/?q=90,180')).toMatchObject({ kind: 'coords', coords: { lat: 90, lng: 180 } });
    expect(parseMapsLink('https://maps.google.com/?q=-90,-180')).toMatchObject({ kind: 'coords', coords: { lat: -90, lng: -180 } });
  });

  it('a broken pin does not hide a valid viewport, and never produces coordinates itself', () => {
    expect(parseMapsLink('https://www.google.com/maps/place/X/@43.46,-3.81,17z/data=!8m2!3d143.5!4d-5.3')).toMatchObject({ kind: 'coords', source: 'viewport', coords: { lat: 43.46, lng: -3.81 } });
  });

  it('never returns -0', () => {
    const p = parseMapsLink('https://maps.google.com/?q=-0.0,-0.0');
    if (p.kind !== 'coords') throw new Error(`expected coords, got ${p.kind}`);
    expect(Object.is(p.coords.lat, -0) || Object.is(p.coords.lng, -0)).toBe(false);
  });
});

describe('helpers', () => {
  it('splitUrl does not depend on the global URL', () => {
    expect(splitUrl('https://User@WWW.Google.COM:443/maps/@1,2,3z?q=a#frag')).toEqual({ scheme: 'https', host: 'www.google.com', path: '/maps/@1,2,3z', query: 'q=a', origin: 'https://www.google.com:443' });
    expect(splitUrl('not a url')).toBeNull();
  });

  it('absolutize handles absolute, scheme-relative, root-relative and relative locations', () => {
    expect(absolutize('https://www.google.com/maps/@1,2,3z', 'https://maps.app.goo.gl/x')).toBe('https://www.google.com/maps/@1,2,3z');
    expect(absolutize('//www.google.com/maps', 'https://maps.app.goo.gl/x')).toBe('https://www.google.com/maps');
    expect(absolutize('/maps/place/X', 'https://www.google.com/url?q=1')).toBe('https://www.google.com/maps/place/X');
    expect(absolutize('b?c=1', 'https://goo.gl/maps/a')).toBe('https://goo.gl/maps/b?c=1');
    expect(absolutize('?x=1', 'https://goo.gl/maps/a')).toBe('https://goo.gl/maps/a?x=1');
    expect(absolutize('  ', 'https://goo.gl/maps/a')).toBeNull();
  });

  it('percentDecode never throws', () => {
    expect(percentDecode('%E0%A4%A')).toBe('%E0%A4%A');
    expect(percentDecode('ok%20%ZZ%C3%A0')).toBe('ok %ZZà');
  });
});
