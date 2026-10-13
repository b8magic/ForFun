import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSurface } from '@/ui/useTheme';
import { palette } from '@/ui/theme';
import { T } from '@/ui/T';
import { softenColor } from '@/ui/calendar/DayMosaic';
import { t } from '@/i18n/it';

interface Props {
  count: number;
  color: string;
  activityName: string;
  busy: boolean;
  error: string | null;
  reduced: boolean;
  visible: boolean;
  celebration: number | null;
  onSave: () => void;
}

/** The water belongs to the control; dates and hit targets never move. */
export function SaveCapsule({ count, color, activityName, busy, error, reduced, visible, celebration, onSave }: Props) {
  const surface = useSurface();
  const [width, setWidth] = useState(320);
  const height = 56;
  const level = useSharedValue(0);
  const phase = useSharedValue(0);
  const frame = useFrameCallback((info) => phase.set(phase.value + (info.timeSincePreviousFrame ?? 16) / 1000), false);
  useEffect(() => {
    frame.setActive(visible && !reduced && count > 0);
  }, [count, reduced, visible, frame]);
  useEffect(() => level.set(withTiming(count ? Math.min(0.94, 0.3 + count * 0.09) : 0, { duration: reduced ? 0 : 260 })), [count, reduced, level]);
  useEffect(() => {
    if (celebration !== null) level.set(reduced ? 0 : withSequence(withTiming(1, { duration: 180 }), withTiming(0, { duration: 720 })));
  }, [celebration, reduced, level]);
  const path = useDerivedValue(() => {
    const builder = Skia.PathBuilder.Make();
    const y = height * (1 - level.value);
    const amplitude = level.value > 0.01 && level.value < 0.99 && !reduced ? 2.8 : 0;
    builder.moveTo(0, height);
    builder.lineTo(0, y);
    for (let i = 0; i <= 32; i++) builder.lineTo(width * i / 32, y + Math.sin(i / 32 * Math.PI * 3 - phase.value * 2.2) * amplitude);
    builder.lineTo(width, height);
    builder.close();
    return builder.detach();
  }, [width, reduced]);
  const clip = Skia.RRectXY(Skia.XYWHRect(0, 0, width, height), height / 2, height / 2);
  return (
    <Pressable onLayout={(event) => setWidth(event.nativeEvent.layout.width)} onPress={onSave} disabled={!count || busy} accessibilityRole="button" accessibilityLabel={count ? `${busy ? t.saving : error ? t.retry : t.save(count)} · ${activityName}` : `Salva · ${activityName}. Nessuna data selezionata`} accessibilityState={{ disabled: !count || busy, busy }} testID="save" style={({ pressed }) => [styles.root, { backgroundColor: count ? softenColor(color, palette.cream, 0.32) : surface.bg, borderColor: count ? color : surface.faint, opacity: pressed ? 0.8 : 1 }]}>
      <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}><Group clip={clip}><Path path={path} color={color} /></Group></Canvas>
      {count ? <T variant="button" color={palette.ink} numberOfLines={1} style={{ backgroundColor: softenColor(color, palette.cream, 0.1), borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }}>{busy ? t.saving : error ? t.retry : t.save(count)}</T> : null}
    </Pressable>
  );
}
const styles = StyleSheet.create({ root: { height: 56, borderRadius: 28, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' } });
