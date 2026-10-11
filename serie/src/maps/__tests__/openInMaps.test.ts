import type { Place } from '@/domain/types';

import { appleMapsUrl, formatCoordinate, googleMapsSearchUrl, openPlaceInMaps, openUrlFor, OPEN_IN_MAPS_STRINGS } from '../openInMaps';

const mockOpenURL = jest.fn<Promise<true>, [string]>(async () => true);
jest.mock('expo-linking', () => ({ openURL: (url: string) => mockOpenURL(url) }));

const place = (p: Partial<Place>): Place => ({ label: null, address: null, mapUrl: null, coords: null, resolution: 'none', resolutionNote: null, ...p });
const LONG = 'https://www.google.com/maps/place/La+Fuente/@43.5389612,-5.4021553,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d43.5389573!4d-5.3995804?entry=ttu#x';

describe('openUrlFor', () => {
  it('opens the original link verbatim when there is one', () => {
    expect(openUrlFor(place({ mapUrl: LONG, coords: { lat: 1, lng: 2 }, resolution: 'manual' }))).toBe(LONG);
    expect(openUrlFor(place({ mapUrl: 'https://maps.app.goo.gl/q8Ywc4ZSkx5nBYXn8?g_st=ic', resolution: 'unresolved' }))).toBe('https://maps.app.goo.gl/q8Ywc4ZSkx5nBYXn8?g_st=ic');
    // Unsupported links are still the user's link.
    expect(openUrlFor(place({ mapUrl: 'https://example.com/spot', resolution: 'unsupported' }))).toBe('https://example.com/spot');
  });

  it('uses the link inside pasted text, and never opens non-web schemes', () => {
    expect(openUrlFor(place({ mapUrl: 'La Fuente https://maps.app.goo.gl/q8Ywc4ZSkx5nBYXn8' }))).toBe('https://maps.app.goo.gl/q8Ywc4ZSkx5nBYXn8');
    expect(openUrlFor(place({ mapUrl: 'javascript:alert(1)', coords: { lat: 43.46, lng: -3.81 }, label: 'Faro' }))).toBe('http://maps.apple.com/?ll=43.46,-3.81&q=Faro');
  });

  it('coordinates → Apple Maps with the label (or address) as q', () => {
    expect(openUrlFor(place({ coords: { lat: 43.5389573, lng: -5.3995804 }, label: 'La Fuente & Co' }))).toBe('http://maps.apple.com/?ll=43.538957,-5.39958&q=La%20Fuente%20%26%20Co');
    expect(openUrlFor(place({ coords: { lat: 43.46, lng: -3.81 }, address: 'Villaviciosa' }))).toBe('http://maps.apple.com/?ll=43.46,-3.81&q=Villaviciosa');
    expect(openUrlFor(place({ coords: { lat: 43.46, lng: -3.81 } }))).toBe('http://maps.apple.com/?ll=43.46,-3.81');
  });

  it('coordinates with Google preferred → Google Maps search URL', () => {
    expect(openUrlFor(place({ coords: { lat: 43.46, lng: -3.81 }, label: 'Faro' }), { prefer: 'google' })).toBe('https://www.google.com/maps/search/?api=1&query=43.46%2C-3.81');
  });

  it('text only → search by name and address; nothing → null', () => {
    expect(openUrlFor(place({ label: 'La Fuente', address: 'Villaviciosa, Asturias' }))).toBe('http://maps.apple.com/?q=La%20Fuente%2C%20Villaviciosa%2C%20Asturias');
    expect(openUrlFor(place({ label: 'La Fuente' }), { prefer: 'google' })).toBe('https://www.google.com/maps/search/?api=1&query=La%20Fuente');
    expect(openUrlFor(place({ label: '  ' }))).toBeNull();
    expect(openUrlFor(null)).toBeNull();
    expect(openUrlFor(place({ coords: { lat: 99, lng: 0 } }))).toBeNull();
  });

  it('helpers format coordinates without exponents', () => {
    expect(formatCoordinate(43.53895731234)).toBe('43.538957');
    expect(formatCoordinate(1e-7)).toBe('0');
    expect(formatCoordinate(-0)).toBe('0');
    expect(formatCoordinate(12)).toBe('12');
    expect(appleMapsUrl({ lat: -33.8688, lng: 151.2093 }, 'Bondi')).toBe('http://maps.apple.com/?ll=-33.8688,151.2093&q=Bondi');
    expect(googleMapsSearchUrl('Duomo di Milano', 'ChIJabc')).toBe('https://www.google.com/maps/search/?api=1&query=Duomo%20di%20Milano&query_place_id=ChIJabc');
  });
});

describe('openPlaceInMaps', () => {
  beforeEach(() => mockOpenURL.mockClear());

  it('opens through expo-linking by default', async () => {
    expect(await openPlaceInMaps(place({ mapUrl: LONG }))).toEqual({ opened: true, url: LONG });
    expect(mockOpenURL).toHaveBeenCalledWith(LONG);
  });

  it('honours an injected opener and preference', async () => {
    const openURL = jest.fn(async () => true);
    expect(await openPlaceInMaps(place({ coords: { lat: 43.46, lng: -3.81 } }), { openURL, prefer: 'google' })).toEqual({
      opened: true,
      url: 'https://www.google.com/maps/search/?api=1&query=43.46%2C-3.81',
    });
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it('reports failures instead of throwing', async () => {
    const openURL = jest.fn(async () => {
      throw new Error('no app');
    });
    expect(await openPlaceInMaps(place({ mapUrl: LONG }), { openURL })).toEqual({ opened: false, url: LONG, reason: 'open_failed', message: OPEN_IN_MAPS_STRINGS.openFailed });
    expect(await openPlaceInMaps(place({}))).toEqual({ opened: false, url: null, reason: 'nothing_to_open', message: OPEN_IN_MAPS_STRINGS.nothingToOpen });
  });
});
