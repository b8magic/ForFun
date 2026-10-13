import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { DaySummary } from '@/domain/daySummaries';
import { useSurface } from '@/ui/useTheme';
import { T } from '@/ui/T';

/** Presentation only: stored activity colours are never rewritten. */
export function softenColor(hex: string, background: string, amount: number): string {
  const parse = (value: string) => value.replace('#', '').match(/.{2}/g)?.map((n) => Number.parseInt(n, 16)) ?? [0, 0, 0];
  const a = parse(hex);
  const b = parse(background);
  return `#${a.map((n, i) => Math.round(n * amount + (b[i] ?? 0) * (1 - amount)).toString(16).padStart(2, '0')).join('')}`;
}

interface Props {
  activities: DaySummary['categories'];
  activeId?: string | null;
  size?: number;
  selected?: boolean;
  today?: boolean;
  reduced?: boolean;
  background?: string;
  celebration?: number;
}

const Segment = memo(function Segment({ color, muted, focused, index, count, size, reduced }: {
  color: string; muted: string; focused: boolean; index: number; count: number; size: number; reduced: boolean;
}) {
  const focus = useSharedValue(focused ? 1 : 0);
  useEffect(() => focus.set(withTiming(focused ? 1 : 0, { duration: reduced ? 0 : 240 })), [focused, reduced, focus]);
  const paint = useAnimatedStyle(() => {
    const value = interpolateColor(focus.value, [0, 1], [muted, color]);
    // Reanimated retains omitted animated style properties when a keyed segment
    // changes shape. Clear the old fill so the triangle exposes the other activity.
    return count === 2 && index === 0
      ? { borderTopColor: value, backgroundColor: 'transparent' }
      : { backgroundColor: value, borderTopColor: 'transparent' };
  }, [muted, color, count, index]);
  if (count === 2 && index === 0) return <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, borderTopWidth: size, borderRightWidth: size, borderRightColor: 'transparent', zIndex: 1 }, paint]} />;
  const geometry = count === 2 ? { top: 0, left: 0, width: size, height: size }
    : count === 4 ? { left: index % 2 * size / 2, top: Math.floor(index / 2) * size / 2, width: size / 2, height: size / 2 }
      : { left: index * size / count, top: 0, width: size / count + 0.2, height: size };
  return <Animated.View style={[{ position: 'absolute', ...geometry }, paint]} />;
});

/** Native shapes avoid a GPU surface per day, including in long histories. */
export const DayMosaic = memo(function DayMosaic({ activities, activeId = null, size = 44, selected = false, today = false, reduced = false, background, celebration }: Props) {
  const surface = useSurface();
  const bg = background ?? surface.bg;
  const visible = activities.slice(0, 4);
  const overflow = activities.length - visible.length;
  const activeBeyondPreview = !!activeId && activities.slice(4).some((activity) => activity.categoryId === activeId);
  const wash = useSharedValue(1);
  useEffect(() => {
    if (celebration === undefined || reduced) return;
    wash.set(0);
    wash.set(withTiming(1, { duration: 720 }));
  }, [celebration, reduced, wash]);
  const wave = useAnimatedStyle(() => ({ opacity: reduced ? 0 : Math.sin(wash.value * Math.PI) * 0.42, transform: [{ translateY: size * (1 - wash.value) }, { rotate: '-8deg' }] }), [size, reduced]);
  const radius = Math.max(2, size * 0.18);
  return (
    <View pointerEvents="none" style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
        {visible.map((activity, index) => <Segment key={activity.categoryId} color={activity.color} muted={softenColor(activity.color, bg, activeId ? 0.47 : 0.88)} focused={!activeId || activity.categoryId === activeId} index={index} count={visible.length} size={size} reduced={reduced} />)}
        {visible.length ? <Animated.View style={[{ position: 'absolute', top: 0, left: -size * 0.2, width: size * 1.4, height: size * 1.4, borderTopLeftRadius: size * 0.45, borderTopRightRadius: size * 0.45, backgroundColor: bg, zIndex: 2 }, wave]} /> : null}
      </View>
      {visible.length > 0 || selected ? <View style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: selected ? 2 : 0.7, borderColor: selected ? surface.fg : surface.faint }]} /> : null}
      {selected ? <View style={{ position: 'absolute', right: 3, top: 3, width: 5, height: 5, borderRadius: 3, backgroundColor: surface.fg }} /> : null}
      {overflow > 0 ? <View style={{ position: 'absolute', right: 1, bottom: 1, paddingHorizontal: size > 24 ? 3 : 1, borderRadius: 3, backgroundColor: bg, borderWidth: activeBeyondPreview ? 1 : 0, borderColor: activities.find((activity) => activity.categoryId === activeId)?.color }}><T variant="labelStrong" color={surface.fg} style={{ fontSize: size > 24 ? 8 : 5, lineHeight: size > 24 ? 11 : 6, letterSpacing: 0 }} maxFontSizeMultiplier={1}>{`+${overflow}`}</T></View> : null}
      {today ? <View style={{ position: 'absolute', bottom: -3, left: size * 0.34, width: size * 0.32, height: 2, borderRadius: 1, backgroundColor: surface.fg }} /> : null}
    </View>
  );
});
