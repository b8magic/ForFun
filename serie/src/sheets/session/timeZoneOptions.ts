import { isValidTimeZone } from '@/domain/zoned';
import { IANA_TIME_ZONES } from './ianaTimeZones';

let supportedZones: readonly string[] | undefined;

/** Load once, without assuming Hermes implements supportedValuesOf. */
export function supportedTimeZones(): readonly string[] {
  if (supportedZones) return supportedZones;
  try {
    const supportedValuesOf = (Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] }).supportedValuesOf;
    const zones = supportedValuesOf?.('timeZone');
    if (zones?.length) {
      supportedZones = zones;
      return zones;
    }
  } catch {
    // Some mobile runtimes provide Intl without this optional enumeration API.
  }
  // Use temporary formatters here: retaining hundreds in the domain cache wastes memory.
  supportedZones = IANA_TIME_ZONES.filter((timeZone) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone }).format(0);
      return true;
    } catch {
      return false;
    }
  });
  return supportedZones;
}

const ITALIAN_CITIES: Readonly<Record<string, string>> = {
  'Europe/Rome': 'Roma',
  'Europe/London': 'Londra',
  'Europe/Paris': 'Parigi',
  'Europe/Berlin': 'Berlino',
  'Europe/Athens': 'Atene',
  'Europe/Brussels': 'Bruxelles',
  'Europe/Lisbon': 'Lisbona',
  'Europe/Moscow': 'Mosca',
  'Europe/Prague': 'Praga',
  'Europe/Warsaw': 'Varsavia',
  'Europe/Vienna': 'Vienna',
  'Asia/Calcutta': 'Kolkata',
  'Asia/Saigon': 'Ho Chi Minh',
  'Asia/Shanghai': 'Shanghai',
  'Asia/Tokyo': 'Tokyo',
};

export interface TimeZoneOption {
  id: string;
  city: string;
  search: string;
}

function searchable(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_/]+/g, ' ').toLowerCase();
}

/** Keep valid saved aliases as selectable options, even when the runtime enumerates another name. */
export function timeZoneOptions(deviceZone: string, currentZone: string, zones: readonly string[] = supportedTimeZones()): TimeZoneOption[] {
  const ids = new Set(zones);
  ids.add('UTC');
  for (const zone of [deviceZone, currentZone]) if (isValidTimeZone(zone)) ids.add(zone);
  return Array.from(ids)
    .sort((a, b) => a === 'UTC' ? -1 : b === 'UTC' ? 1 : a.localeCompare(b))
    .map((id) => {
      const city = ITALIAN_CITIES[id] ?? id.split('/').at(-1)!.replace(/_/g, ' ');
      return { id, city, search: searchable(`${city} ${id}`) };
    });
}

export function filterTimeZoneOptions(options: readonly TimeZoneOption[], query: string): TimeZoneOption[] {
  const words = searchable(query).trim().split(/\s+/).filter(Boolean);
  return options.filter((option) => words.every((word) => option.search.includes(word)));
}
