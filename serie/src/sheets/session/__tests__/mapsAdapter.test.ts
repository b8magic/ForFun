/**
 * Rules the session sheets keep regardless of the maps module (src/maps):
 * the pasted link stays verbatim, the user's own name/address win, nothing
 * the module returns is trusted blindly, and failures never block saving.
 * The maps module is replaced by fakes through the adapter's dependency seam.
 */
import type { Place } from '@/domain/types';
import { makeMapsAdapter } from '../mapsAdapterCore';
import { emptyPlace } from '../placeForm';

const mockBuild = jest.fn();
const mockResolve = jest.fn();
const mockOpenUrl = jest.fn();
const { placeWithLink, resolvePending, mapsTarget } = makeMapsAdapter({ buildPlaceFromLink: mockBuild, resolvePlaceFromLink: mockResolve, openUrlFor: mockOpenUrl });

const URL = 'https://www.google.com/maps/place/La+Fuente/@43.4621,-3.81,15z';

beforeEach(() => {
  mockBuild.mockReset();
  mockResolve.mockReset();
  mockOpenUrl.mockReset();
});

describe('maps adapter', () => {
  it('keeps the link as pasted and lets the module decide the label', () => {
    mockBuild.mockReturnValue({ label: 'La Fuente', address: null, coords: { lat: 43.4621, lng: -3.81 }, resolution: 'resolved' });
    const p = placeWithLink({ ...emptyPlace(), label: 'La Fuente' }, `  ${URL} `);
    expect(p.mapUrl).toBe(URL);
    expect(p.label).toBe('La Fuente');
    expect(p.resolution).toBe('resolved');
    expect(p.coords).toEqual({ lat: 43.4621, lng: -3.81 });
    // a module that says nothing about label/address leaves ours alone
    mockBuild.mockReturnValue({ coords: null, resolution: 'unsupported' });
    expect(placeWithLink({ ...emptyPlace(), label: 'Mio', address: 'Via Roma 1' }, 'x')).toMatchObject({ label: 'Mio', address: 'Via Roma 1' });
  });

  it('accepts a manual pin the module kept, but never a "manual" without coordinates', () => {
    mockBuild.mockReturnValue({ coords: { lat: 1, lng: 2 }, resolution: 'manual' });
    expect(placeWithLink(null, 'https://example.com')).toMatchObject({ coords: { lat: 1, lng: 2 }, resolution: 'manual' });
    mockBuild.mockReturnValue({ coords: null, resolution: 'manual' });
    expect(placeWithLink(null, 'https://example.com')).toMatchObject({ coords: null, resolution: 'unresolved' });
  });

  it('never claims "resolved" without real coordinates', () => {
    mockBuild.mockReturnValue({ coords: null, resolution: 'resolved' });
    expect(placeWithLink(null, URL)).toMatchObject({ coords: null, resolution: 'unresolved' });
    mockBuild.mockReturnValue({ coords: { lat: 200, lng: 0 }, resolution: 'resolved' });
    expect(placeWithLink(null, URL)).toMatchObject({ coords: null, resolution: 'unresolved' });
  });

  it('treats a throwing parser as an unsupported link, kept as typed', () => {
    mockBuild.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(placeWithLink(null, 'qualcosa')).toMatchObject({ mapUrl: 'qualcosa', coords: null, resolution: 'unsupported' });
  });

  it('removing the link drops link coordinates but keeps a manual pin', () => {
    const linked: Place = { ...emptyPlace(), mapUrl: URL, coords: { lat: 1, lng: 2 }, resolution: 'resolved' };
    expect(placeWithLink(linked, '')).toMatchObject({ mapUrl: null, coords: null, resolution: 'none' });
    const pinned: Place = { ...linked, resolution: 'manual' };
    expect(placeWithLink(pinned, '')).toMatchObject({ mapUrl: null, coords: { lat: 1, lng: 2 }, resolution: 'manual' });
  });

  it('a failed network resolution keeps the link and reports "unresolved"', async () => {
    mockResolve.mockRejectedValue(new Error('offline'));
    const pending: Place = { ...emptyPlace(), mapUrl: 'https://maps.app.goo.gl/x', resolution: 'pending' };
    await expect(resolvePending(pending)).resolves.toMatchObject({ mapUrl: 'https://maps.app.goo.gl/x', coords: null, resolution: 'unresolved' });
  });

  it('"Apri in Mappe" opens the original link verbatim when there is one', () => {
    mockOpenUrl.mockReturnValue('maps://?ll=1,2');
    expect(mapsTarget({ ...emptyPlace(), mapUrl: URL, coords: { lat: 1, lng: 2 }, resolution: 'resolved' })).toBe(URL);
    // narrowed to the link inside pasted share text, never to something that was not pasted
    mockOpenUrl.mockReturnValue('https://maps.app.goo.gl/abc');
    expect(mapsTarget({ ...emptyPlace(), mapUrl: 'La Fuente maps.app.goo.gl/abc', resolution: 'pending' })).toBe('https://maps.app.goo.gl/abc');
    mockOpenUrl.mockReturnValue('https://maps.example.org/other');
    expect(mapsTarget({ ...emptyPlace(), mapUrl: URL, resolution: 'resolved' })).toBe(URL);
    mockOpenUrl.mockReturnValue('maps://?ll=1,2');
    expect(mapsTarget({ ...emptyPlace(), coords: { lat: 1, lng: 2 }, resolution: 'manual' })).toBe('maps://?ll=1,2');
    mockOpenUrl.mockImplementation(() => {
      throw new Error('x');
    });
    expect(mapsTarget({ ...emptyPlace(), label: 'X' })).toBeNull();
  });
});
