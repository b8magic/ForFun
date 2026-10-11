import type { Coordinates } from '@/domain/types';

export interface MapPreviewProps {
  coords: Coordinates | null;
  /** Readable place label (name, address, or "Luogo senza nome"). */
  label: string;
  /** Tap on the map → manual pin. Omit to make the preview read-only. */
  onPick?: (c: Coordinates) => void;
  accent?: string;
  testID?: string;
}
