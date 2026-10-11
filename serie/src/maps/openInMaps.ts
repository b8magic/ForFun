/**
 * "Apri in Mappe" — platform adapter around the pure URL choice in ./mapsUrls.
 *
 * Opens the original link verbatim when there is one (Google Maps app or
 * Safari handle it via universal links), otherwise Apple Maps on iOS and a
 * Google Maps search elsewhere. Uses expo-linking's `openURL`; no location
 * permission is requested.
 */
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import type { Place } from '@/domain/types';
import { openUrlFor, type MapsProvider } from './mapsUrls';

export { appleMapsSearchUrl, appleMapsUrl, formatCoordinate, googleMapsSearchUrl, openUrlFor, originalLinkFor } from './mapsUrls';
export type { MapsProvider, OpenUrlOptions } from './mapsUrls';

export const OPEN_IN_MAPS_STRINGS = {
  nothingToOpen: 'Nessun luogo da aprire.',
  openFailed: 'Mappe non si è aperta su questo dispositivo.',
} as const;

export type OpenInMapsResult =
  | { opened: true; url: string }
  | { opened: false; url: string | null; reason: 'nothing_to_open' | 'open_failed'; message: string };

export interface OpenInMapsDeps {
  /** Defaults to expo-linking `openURL`. */
  openURL?: (url: string) => Promise<unknown>;
  /** Defaults to 'apple' on iOS, 'google' elsewhere. */
  prefer?: MapsProvider;
}

/** Opens the place in Maps. Resolves with what happened; never throws. */
export async function openPlaceInMaps(place: Place | null | undefined, deps: OpenInMapsDeps = {}): Promise<OpenInMapsResult> {
  const prefer = deps.prefer ?? (Platform.OS === 'ios' ? 'apple' : 'google');
  const url = openUrlFor(place, { prefer });
  if (!url) return { opened: false, url: null, reason: 'nothing_to_open', message: OPEN_IN_MAPS_STRINGS.nothingToOpen };
  try {
    await (deps.openURL ?? Linking.openURL)(url);
    return { opened: true, url };
  } catch {
    return { opened: false, url, reason: 'open_failed', message: OPEN_IN_MAPS_STRINGS.openFailed };
  }
}
