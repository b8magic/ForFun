/**
 * Pure core of the maps adapter (see mapsAdapter.ts): takes the maps module's
 * functions as dependencies so the rules can be unit-tested without src/maps.
 *
 * Rules kept here on top of the maps module (src/maps/resolveLink.ts, which
 * owns the finer ones: a label typed by the user wins, a label that came from
 * the previous link may be replaced, a manual pin survives a link without
 * coordinates):
 *  - the pasted link is stored as typed (trimmed) and is what "Apri in Mappe"
 *    opens — at most narrowed to the link inside pasted share text;
 *  - nothing returned is trusted blindly: coordinates must be real numbers in
 *    range, and "resolved"/"manual" require them;
 *  - a throwing parser or resolver degrades to an honest status, never blocks
 *    saving; no location permission is ever requested.
 */
import type { Coordinates, Place, PlaceResolution } from '@/domain/types';
import { emptyPlace } from './placeForm';

/** Coordinates from the maps module are used only when they are real numbers in range. */
function validCoords(c: unknown): Coordinates | null {
  if (!c || typeof c !== 'object') return null;
  const { lat, lng } = c as Partial<Coordinates>;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

const LINK_STATES: PlaceResolution[] = ['resolved', 'manual', 'pending', 'unresolved', 'unsupported'];
/** States in which coordinates are shown: read from the link, placed by hand, or a manual pin kept while a short link resolves. */
const WITH_COORDS: PlaceResolution[] = ['resolved', 'manual', 'pending'];

const has = <K extends string>(o: object, k: K): o is Record<K, unknown> => Object.prototype.hasOwnProperty.call(o, k);
const textOrNull = (v: unknown, fallback: string | null): string | null => (typeof v === 'string' ? v : v === null ? null : fallback);

export interface MapsModule {
  buildPlaceFromLink: (url: string, base: Place) => Partial<Place> | null | undefined;
  resolvePlaceFromLink: (url: string, base: Place) => Promise<Partial<Place> | null | undefined>;
  openUrlFor: (place: Place) => string | null | undefined;
}

function merge(base: Place, fromLink: Partial<Place> | null | undefined, url: string): Place {
  const f = fromLink ?? {};
  const coords = validCoords(f.coords);
  let resolution: PlaceResolution = f.resolution && LINK_STATES.includes(f.resolution) ? f.resolution : 'unsupported';
  // "Posizione letta dal link" / "impostata a mano" are only true with coordinates; never claim them without.
  if ((resolution === 'resolved' || resolution === 'manual') && !coords) resolution = 'unresolved';
  // The module decides label/address (it knows which label the user typed); without an answer, keep ours.
  return {
    ...base,
    label: has(f, 'label') ? textOrNull(f.label, base.label) : base.label,
    address: has(f, 'address') ? textOrNull(f.address, base.address) : base.address,
    mapUrl: url,
    coords: WITH_COORDS.includes(resolution) ? coords : null,
    resolution,
    resolutionNote: typeof f.resolutionNote === 'string' ? f.resolutionNote : null,
  };
}

/** The editors' view of the maps module, with the rules above applied to whatever it returns. */
export function makeMapsAdapter(maps: MapsModule) {
  /** Place after the user typed or pasted a link (synchronous parse only). */
  function placeWithLink(current: Place | null, link: string): Place {
    const base = current ?? emptyPlace();
    const url = link.trim();
    if (!url) {
      // Link removed: a manual pin survives, link-derived coordinates do not.
      const manual = base.resolution === 'manual' && base.coords;
      return { ...base, mapUrl: null, coords: manual ? base.coords : null, resolution: manual ? 'manual' : 'none', resolutionNote: null };
    }
    if (url === base.mapUrl?.trim() && base.resolution !== 'none') return base;
    try {
      return merge(base, maps.buildPlaceFromLink(url, base), url);
    } catch {
      return { ...base, mapUrl: url, coords: null, resolution: 'unsupported', resolutionNote: null };
    }
  }

  /** Resolve a pending short link. Failure keeps the link and reports "unresolved"; it never blocks saving. */
  async function resolvePending(place: Place): Promise<Place> {
    const url = place.mapUrl?.trim();
    if (!url) return place;
    try {
      const r = await maps.resolvePlaceFromLink(url, place);
      return merge(place, r, url);
    } catch {
      return { ...place, coords: null, resolution: 'unresolved' };
    }
  }

  /**
   * What "Apri in Mappe" opens: the original link when there is one. The maps
   * module may narrow pasted share text ("La Fuente https://maps.app.goo.gl/…")
   * to the link inside it; anything that is not part of what was pasted is ignored.
   */
  function mapsTarget(place: Place | null): string | null {
    if (!place) return null;
    let fromModule: string | null = null;
    try {
      const u = maps.openUrlFor(place);
      fromModule = typeof u === 'string' && u.trim() ? u.trim() : null;
    } catch {
      fromModule = null;
    }
    const original = place.mapUrl?.trim();
    if (!original) return fromModule;
    const bare = fromModule?.replace(/^https?:\/\//i, '') ?? '';
    const partOfPasted = !!fromModule && (original.includes(fromModule) || (bare.length > 3 && original.includes(bare)));
    return partOfPasted ? fromModule : original;
  }

  return { placeWithLink, resolvePending, mapsTarget };
}
