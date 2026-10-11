/** Textual alternative under every map preview: place name + coordinates (or an honest "not known yet"). */
import { View } from 'react-native';
import type { Coordinates } from '@/domain/types';
import { surfaces } from '@/ui/theme';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { coordsA11y, formatCoords } from './placeForm';

const S = surfaces.night;

export function MapCaption({ label, coords, hint }: { label: string; coords: Coordinates | null; hint?: string | null }) {
  const a11y = `${label}, ${coords ? coordsA11y(coords) : t.sessionSheets.mapNoCoords}`;
  return (
    <View style={{ gap: 2 }} accessible accessibilityLabel={a11y} testID="map-caption">
      <T variant="bodyStrong" color={S.fg} numberOfLines={2}>
        {label}
      </T>
      <T variant="data" color={coords ? S.fg : S.mute}>
        {coords ? formatCoords(coords) : t.sessionSheets.mapNoCoords}
      </T>
      {hint ? (
        <T variant="small" color={S.mute}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}
