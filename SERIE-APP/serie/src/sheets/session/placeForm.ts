/**
 * Place helpers for the editors (pure, unit-tested). Coordinates are only ever
 * read from a link or set by the user's own tap on the map — never guessed.
 */
import type { Coordinates, Place, PlaceResolution } from '@/domain/types';
import { t } from '@/i18n/it';

const s = t.sessionSheets;

export function emptyPlace(): Place {
  return { label: null, address: null, mapUrl: null, coords: null, resolution: 'none', resolutionNote: null };
}

const clean = (v: string | null | undefined) => {
  const x = (v ?? '').trim();
  return x.length ? x : null;
};

/** Trim text fields; a place with nothing in it is no place at all. */
export function compactPlace(p: Place | null | undefined): Place | null {
  if (!p) return null;
  const out: Place = { ...p, label: clean(p.label), address: clean(p.address), mapUrl: clean(p.mapUrl) };
  if (!out.label && !out.address && !out.mapUrl && !out.coords) return null;
  if (!out.mapUrl && out.resolution !== 'manual') {
    out.resolution = out.coords ? 'manual' : 'none';
    out.resolutionNote = null;
  }
  return out;
}

export function samePlace(a: Place | null, b: Place | null): boolean {
  const x = compactPlace(a);
  const y = compactPlace(b);
  if (!x || !y) return x === y;
  return (
    x.label === y.label &&
    x.address === y.address &&
    x.mapUrl === y.mapUrl &&
    x.resolution === y.resolution &&
    (x.coords?.lat ?? null) === (y.coords?.lat ?? null) &&
    (x.coords?.lng ?? null) === (y.coords?.lng ?? null)
  );
}

export type StatusTone = 'ok' | 'pending' | 'warn';

/** The resolution status line shown under the link. */
export function placeStatus(resolution: PlaceResolution): { text: string; tone: StatusTone } | null {
  switch (resolution) {
    case 'resolved':
      return { text: t.mapResolved, tone: 'ok' };
    case 'manual':
      return { text: t.mapManual, tone: 'ok' };
    case 'pending':
      return { text: t.mapPending, tone: 'pending' };
    case 'unresolved':
      return { text: t.mapUnresolved, tone: 'warn' };
    case 'unsupported':
      return { text: t.mapUnsupported, tone: 'warn' };
    case 'none':
      return null;
  }
}

const fmt = (n: number) => Math.abs(n).toFixed(5).replace('.', ',');

/** "43,46210 N · 3,81000 O" — readable, hemisphere explicit (Italian compass letters). */
export function formatCoords(c: Coordinates): string {
  const k = s.compass;
  return `${fmt(c.lat)} ${c.lat >= 0 ? k.n : k.s} · ${fmt(c.lng)} ${c.lng >= 0 ? k.e : k.w}`;
}

/** Spoken form for screen readers. */
export function coordsA11y(c: Coordinates): string {
  return s.coordsA11y(c.lat.toFixed(5), c.lng.toFixed(5));
}

export function placeTitle(p: Place | null): string {
  return p?.label?.trim() || p?.address?.trim() || s.placeUnnamed;
}

/** A manual pin from a map tap; the link (if any) is preserved verbatim. */
export function withManualPin(p: Place | null, c: Coordinates): Place {
  const base = p ?? emptyPlace();
  return { ...base, coords: { lat: c.lat, lng: c.lng }, resolution: 'manual', resolutionNote: null };
}
