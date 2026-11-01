/**
 * The only file in the session sheets that talks to the maps module
 * (src/maps). Everything the editors need from it goes through here, so the
 * contract lives in one place:
 *
 *   buildPlaceFromLink(url, base)  sync: place for a pasted link
 *                                  (resolved / pending / unsupported)
 *   resolvePlaceFromLink(url, base) async: network resolution of short links
 *                                  (resolved / unresolved), never throws to the UI
 *   openUrlFor(place)              URL to open the place in Maps
 *
 * The rules applied to the module's results live in mapsAdapterCore.ts
 * (unit-tested): link kept verbatim, user's name/address win, coordinates
 * validated, failures degrade to an honest status, no location permission.
 */
import { buildPlaceFromLink, resolvePlaceFromLink } from '@/maps/resolveLink';
import { openUrlFor } from '@/maps/openInMaps';
import { makeMapsAdapter } from './mapsAdapterCore';

export const { placeWithLink, resolvePending, mapsTarget } = makeMapsAdapter({ buildPlaceFromLink, resolvePlaceFromLink, openUrlFor });
