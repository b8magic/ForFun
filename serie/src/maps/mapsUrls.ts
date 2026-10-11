/**
 * Which URL "Apri in Mappe" opens — pure, no React / Expo imports.
 *
 *  1. The original pasted link, verbatim, when there is one (an http(s) URL).
 *  2. Otherwise coordinates → Apple Maps `http://maps.apple.com/?ll=lat,lng&q=label`
 *     (or a Google Maps search URL when Google is preferred).
 *  3. Otherwise the typed name/address → Apple Maps or Google Maps search by text.
 *  4. Nothing to show → null.
 */
import type { Coordinates, Place } from '@/domain/types';
import { extractLink, inRange } from './parseLink';

export type MapsProvider = 'apple' | 'google';

export interface OpenUrlOptions {
  /** Used only when there is no original link. Default 'apple' (iOS-first). */
  prefer?: MapsProvider;
}

const clean = (s: string | null | undefined): string | null => {
  if (s == null) return null;
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length ? t : null;
};

/** Up to 6 decimals (~10 cm), never exponent notation. */
export function formatCoordinate(n: number): string {
  const r = Math.round(n * 1e6) / 1e6;
  return (r === 0 ? 0 : r).toFixed(6).replace(/\.?0+$/, '');
}

/** Apple Maps link: pin at `ll`, labelled by `q`. */
export function appleMapsUrl(coords: Coordinates, label?: string | null): string {
  const q = clean(label);
  return `http://maps.apple.com/?ll=${formatCoordinate(coords.lat)},${formatCoordinate(coords.lng)}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
}

/** Apple Maps search by text. */
export function appleMapsSearchUrl(text: string): string {
  return `http://maps.apple.com/?q=${encodeURIComponent(text)}`;
}

/** Google Maps URLs API search (`api=1`), by text or "lat,lng". */
export function googleMapsSearchUrl(query: string, placeId?: string | null): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}${placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : ''}`;
}

/** The stored link when it can be opened as is: an http(s) URL (the link inside pasted text otherwise). */
export function originalLinkFor(mapUrl: string | null | undefined): string | null {
  const raw = mapUrl?.trim();
  if (!raw) return null;
  if (/^https?:\/\/\S+$/i.test(raw)) return raw;
  const inner = extractLink(raw);
  return inner && /^https?:\/\//i.test(inner) ? inner : null;
}

function validCoords(c: Coordinates | null | undefined): Coordinates | null {
  return c && inRange(c.lat, c.lng) ? c : null;
}

/** The URL to open for a place; see the module comment for the order. */
export function openUrlFor(place: Place | null | undefined, options: OpenUrlOptions = {}): string | null {
  if (!place) return null;
  const original = originalLinkFor(place.mapUrl);
  if (original) return original;
  const prefer = options.prefer ?? 'apple';
  const label = clean(place.label);
  const address = clean(place.address);
  const c = validCoords(place.coords);
  if (c) {
    return prefer === 'google' ? googleMapsSearchUrl(`${formatCoordinate(c.lat)},${formatCoordinate(c.lng)}`) : appleMapsUrl(c, label ?? address);
  }
  const text = [label, address].filter(Boolean).join(', ');
  if (!text) return null;
  return prefer === 'google' ? googleMapsSearchUrl(text) : appleMapsSearchUrl(text);
}
