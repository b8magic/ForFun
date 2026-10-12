import { useSurface, useThemedStyles } from '@/ui/useTheme';
/**
 * Position readout — the map fallback for web, Android (no Google Maps key in
 * this build) and iOS 16 (expo-maps' Apple Maps view needs iOS 17). It does not
 * pretend to be a map: place label + coordinates as text, with an explicit
 * "preview not available" line.
 */
import { StyleSheet, View } from 'react-native';
import { type Surface } from '@/ui/theme';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { coordsA11y, formatCoords } from './placeForm';
import type { MapPreviewProps } from './mapPreview.types';

export function MapReadout({ coords, label, accent: accentProp, testID }: MapPreviewProps) {
  const S = useSurface();
  const accent = accentProp ?? S.accent;
  const styles = useThemedStyles(createStyles);
  const a11y = `${label}, ${coords ? coordsA11y(coords) : t.sessionSheets.mapNoCoords}. ${t.mapUnavailable}`;
  return (
    <View style={{ gap: 10 }} testID={testID}>
      <View style={styles.panel} accessible accessibilityLabel={a11y} testID="map-readout">
        {/* surveyor's ticks at the edges: a position readout, not a map */}
        <View style={[styles.tickH, { left: 0 }]} />
        <View style={[styles.tickH, { right: 0 }]} />
        <View style={[styles.tickV, { top: 0 }]} />
        <View style={[styles.tickV, { bottom: 0 }]} />
        <View style={styles.readout}>
          <View style={[styles.dot, coords ? { backgroundColor: accent } : styles.dotEmpty]} />
          <View style={{ flexShrink: 1, gap: 2 }}>
            <T variant="bodyStrong" color={S.fg} numberOfLines={2}>
              {label}
            </T>
            <T variant="data" color={coords ? S.fg : S.mute}>
              {coords ? formatCoords(coords) : t.sessionSheets.mapNoCoords}
            </T>
          </View>
        </View>
      </View>
      <T variant="small" color={S.mute} testID="map-unavailable">
        {t.mapUnavailable} {t.sessionSheets.mapUnavailableHint}
      </T>
    </View>
  );
}

const createStyles = (S: Surface) => StyleSheet.create({
  panel: {
    minHeight: 104,
    paddingHorizontal: 26,
    paddingVertical: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: S.faint,
    borderRadius: 4,
    justifyContent: 'center',
    backgroundColor: S.bg,
    overflow: 'hidden',
  },
  tickH: { position: 'absolute', top: '50%', width: 12, height: 1, backgroundColor: S.faint },
  tickV: { position: 'absolute', left: '50%', width: 1, height: 12, backgroundColor: S.faint },
  readout: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotEmpty: { borderWidth: 1.2, borderColor: S.mute },
});
