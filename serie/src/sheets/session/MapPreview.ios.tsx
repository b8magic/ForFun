/**
 * Map preview on iOS: Apple Maps through expo-maps (AppleMaps.View, SDK 57
 * types checked in node_modules/expo-maps/build/apple/AppleMaps.types.d.ts).
 * No location permission is requested (isMyLocationEnabled stays false).
 * Tapping the map sets a manual pin. A textual alternative (label +
 * coordinates) always sits under the map.
 */
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppleMaps } from 'expo-maps';
import { palette } from '@/ui/theme';
import { t } from '@/i18n/it';
import { MapCaption } from './MapCaption';
import { coordsA11y } from './placeForm';
import type { MapPreviewProps } from './mapPreview.types';
import { MapReadout } from './MapReadout';
import { APPLE_MAPS_OK } from './mapsAvailable';

const ZOOM = 14;

/** iOS 17+: Apple Maps; iOS 16: the textual readout (expo-maps would render an empty view). */
export function MapPreview(props: MapPreviewProps) {
  return APPLE_MAPS_OK ? <AppleMapPreview {...props} /> : <MapReadout {...props} />;
}

function AppleMapPreview({ coords, label, onPick, accent = palette.flare, testID }: MapPreviewProps) {
  const ref = useRef<AppleMaps.MapView>(null);
  const lat = coords?.lat;
  const lng = coords?.lng;

  // cameraPosition is only the initial camera: follow later coordinate changes imperatively.
  useEffect(() => {
    if (lat == null || lng == null) return;
    ref.current?.setCameraPosition({ coordinates: { latitude: lat, longitude: lng }, zoom: ZOOM });
  }, [lat, lng]);

  const a11y = t.sessionSheets.mapA11y(label, coords ? coordsA11y(coords) : t.sessionSheets.mapNoCoords);
  return (
    <View style={{ gap: 12 }} testID={testID}>
      {/* One VoiceOver element with the textual alternative. onAccessibilityTap swallows the
          VoiceOver double-tap, which would otherwise synthesise a touch at the centre of the map
          and silently turn the pin into a "manual" one. */}
      <View style={styles.frame} accessible accessibilityRole="image" accessibilityLabel={a11y} onAccessibilityTap={() => undefined}>
        <AppleMaps.View
          ref={ref}
          style={StyleSheet.absoluteFill}
          colorScheme={AppleMaps.MapColorScheme.DARK}
          cameraPosition={coords ? { coordinates: { latitude: coords.lat, longitude: coords.lng }, zoom: ZOOM } : undefined}
          markers={coords ? [{ id: 'place', coordinates: { latitude: coords.lat, longitude: coords.lng }, title: label, tintColor: accent }] : []}
          uiSettings={{ compassEnabled: false, myLocationButtonEnabled: false, scaleBarEnabled: false, togglePitchEnabled: false }}
          properties={{ isMyLocationEnabled: false, selectionEnabled: false }}
          onMapClick={
            onPick
              ? (e) => {
                  const { latitude, longitude } = e.coordinates;
                  if (latitude != null && longitude != null) onPick({ lat: latitude, lng: longitude });
                }
              : undefined
          }
        />
      </View>
      <MapCaption label={label} coords={coords} hint={onPick ? t.placePinHint : null} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 184,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(238,232,218,0.28)',
    backgroundColor: palette.ink,
  },
});
