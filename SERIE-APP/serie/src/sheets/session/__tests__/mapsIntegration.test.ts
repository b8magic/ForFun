/**
 * The adapter bound to the real maps module (src/maps): the rules the session
 * sheets rely on hold end to end. No network: short links stay 'pending'
 * synchronously, and resolution gets a fetch that fails.
 */
import type { Place } from '@/domain/types';
import { buildPlaceFromLink, resolvePlaceFromLink } from '@/maps/resolveLink';
import { openUrlFor } from '@/maps/openInMaps';
import { makeMapsAdapter } from '../mapsAdapterCore';
import { emptyPlace } from '../placeForm';

const offline = () => Promise.reject(new Error('offline'));
const { placeWithLink, resolvePending, mapsTarget } = makeMapsAdapter({
  buildPlaceFromLink,
  resolvePlaceFromLink: (url, base) => resolvePlaceFromLink(url, base, { fetchImpl: offline }),
  openUrlFor,
});

describe('session sheets × maps module', () => {
  it('reads coordinates from a long link and keeps the typed name', () => {
    const p = placeWithLink({ ...emptyPlace(), label: 'Il mio spot' }, 'https://www.google.com/maps/place/La+Fuente/@43.4621,-3.81,15z');
    expect(p.label).toBe('Il mio spot');
    expect(p.mapUrl).toBe('https://www.google.com/maps/place/La+Fuente/@43.4621,-3.81,15z');
    expect(p.coords?.lat).toBeCloseTo(43.4621);
    expect(p.resolution).toBe('resolved');
  });

  it('a short link is pending, then unresolved offline with the link kept', async () => {
    const p = placeWithLink(null, 'https://maps.app.goo.gl/AbCdEf123');
    expect(p.resolution).toBe('pending');
    const r = await resolvePending(p);
    expect(r).toMatchObject({ mapUrl: 'https://maps.app.goo.gl/AbCdEf123', coords: null, resolution: 'unresolved' });
    expect(r.resolutionNote).toBeTruthy();
  });

  it('a manual pin survives a new link without coordinates', () => {
    const pinned: Place = { ...emptyPlace(), coords: { lat: 43.1, lng: -3.2 }, resolution: 'manual' };
    expect(placeWithLink(pinned, 'https://example.com/spiaggia')).toMatchObject({ coords: { lat: 43.1, lng: -3.2 }, resolution: 'manual' });
  });

  it('opens the original link, or the link inside pasted share text', () => {
    expect(mapsTarget(placeWithLink(null, 'https://maps.app.goo.gl/AbCdEf123'))).toBe('https://maps.app.goo.gl/AbCdEf123');
    const shared = placeWithLink(null, 'La Fuente https://maps.app.goo.gl/AbCdEf123');
    expect(shared.mapUrl).toBe('La Fuente https://maps.app.goo.gl/AbCdEf123');
    expect(mapsTarget(shared)).toBe('https://maps.app.goo.gl/AbCdEf123');
  });
});
