/**
 * Static identity discs use native geometry so long lists do not allocate a
 * graphics surface per activity. The animated preview keeps its Skia renderer.
 */
import { memo, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Canvas, Group, Path, Circle, Skia, usePathValue } from '@shopify/react-native-skia';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import type { PatternKind } from '@/domain/types';
import { discStripes, PATTERN_CODES } from './disc';
import { useMotionReduced } from '@/state/selectors';

interface Props {
  size: number;
  pattern: PatternKind;
  color: string;
  stripe: string;
  animated?: boolean;
  selected?: boolean;
  ringColor?: string;
}

/** Geometry of the disc inside its square canvas (shared with the Lineup for exact hand-offs). */
export function discMetrics(size: number) {
  const pad = Math.round(size * 0.22);
  return { r: size / 2 - pad / 2 - 2, cx: size / 2 - pad / 4, cy: size / 2 + pad / 4 };
}

interface Mark {
  style: ViewStyle;
  outline?: boolean;
}

/** A small, bounded set of native marks for each still identity pattern. */
function staticPattern(pattern: PatternKind, diameter: number): Mark[] {
  const gap = diameter / 6;
  const thickness = Math.max(0.65, gap * 0.32);
  if (pattern === 'ripple') {
    return [0.28, 0.58, 0.9].map((scale) => {
      const size = diameter * scale;
      return { outline: true, style: { left: (diameter - size) / 2, top: (diameter - size) / 2, width: size, height: size, borderRadius: size / 2, borderWidth: thickness } };
    });
  }

  const marks: Mark[] = [];
  for (let row = 0; row < 7; row++) {
    const y = (row + 0.15) * gap;
    if (pattern === 'grain') {
      const dot = Math.max(0.8, gap * 0.3);
      for (let column = 0; column < 6; column++) {
        marks.push({ style: { left: (column + (row % 2) * 0.5) * gap, top: y, width: dot, height: dot, borderRadius: dot / 2 } });
      }
    } else if (pattern === 'stride') {
      for (let column = -1; column < 5; column++) {
        marks.push({ style: { left: (column * 1.5 + (row % 2) * 0.7) * gap, top: y, width: gap, height: thickness, borderRadius: thickness / 2 } });
      }
    } else if (pattern === 'swell') {
      const waveY = (x: number) => y + gap * 0.3 * Math.sin((x / diameter * 2 - 1) * 3.2 - 4.16 + row * 0.55);
      for (let column = 0; column < 6; column++) {
        const x = column * diameter / 6;
        const end = (column + 1) * diameter / 6;
        const startY = waveY(x);
        const endY = waveY(end);
        const length = Math.hypot(end - x, endY - startY);
        // Overlapping rounded ends keep adjacent segments continuous at every scale.
        const segmentWidth = length + thickness;
        marks.push({ style: { left: (x + end - segmentWidth) / 2, top: (startY + endY - thickness) / 2, width: segmentWidth, height: thickness, borderRadius: thickness / 2, transform: [{ rotate: `${Math.atan2(endY - startY, end - x)}rad` }] } });
      }
    } else {
      const height = pattern === 'pulse' ? thickness * (0.65 + Math.max(0, Math.sin(7.15 - row * 0.9))) : thickness;
      marks.push({ style: { left: -diameter * 0.3, top: y, width: diameter * 1.6, height, transform: pattern === 'drift' ? [{ rotate: '-28.65deg' }] : undefined } });
    }
  }
  return marks;
}

function StaticIdentityDisc({ size, pattern, color, stripe, selected = false, ringColor }: Props) {
  const { r, cx, cy } = discMetrics(size);
  const diameter = r * 2;
  const marks = useMemo(() => staticPattern(pattern, diameter), [pattern, diameter]);
  const dotR = Math.max(2.5, size * 0.07);
  const dotX = cx + Math.cos(-Math.PI / 4) * (r + dotR + 2.5);
  const dotY = cy + Math.sin(-Math.PI / 4) * (r + dotR + 2.5);
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: cx - r, top: cy - r, width: diameter, height: diameter, borderRadius: r, overflow: 'hidden' }}>
        {marks.map((mark, index) => <View key={index} style={[styles.mark, mark.style, mark.outline ? { borderColor: stripe } : { backgroundColor: stripe }]} />)}
      </View>
      {selected ? <View style={{ position: 'absolute', left: cx - r - 4, top: cy - r - 4, width: (r + 4) * 2, height: (r + 4) * 2, borderRadius: r + 4, borderWidth: 1.5, borderColor: ringColor ?? color }} /> : null}
      <View style={{ position: 'absolute', left: dotX - dotR, top: dotY - dotR, width: dotR * 2, height: dotR * 2, borderRadius: dotR, backgroundColor: color }} />
    </View>
  );
}

function AnimatedIdentityDisc({ size, pattern, color, stripe, selected = false, ringColor }: Props) {
  const reduced = useMotionReduced();
  const t = useSharedValue(1.3);
  const live = !reduced;
  useFrameCallback((f) => {
    t.value = (f.timestamp ?? 0) / 1000;
  }, live);
  const { r, cx, cy } = discMetrics(size);
  const code = PATTERN_CODES[pattern];
  const clip = useMemo(() => Skia.Path.Circle(cx, cy, r), [cx, cy, r]);
  const stripes = usePathValue((b) => {
    'worklet';
    discStripes(b, code, cx, cy, r, t.value, 7);
  });
  const dotR = Math.max(2.5, size * 0.07);
  const dotX = cx + Math.cos(-Math.PI / 4) * (r + dotR + 2.5);
  const dotY = cy + Math.sin(-Math.PI / 4) * (r + dotR + 2.5);
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group clip={clip}>
        <Path path={stripes} color={stripe} />
      </Group>
      {selected ? <Circle cx={cx} cy={cy} r={r + 4} style="stroke" strokeWidth={1.5} color={ringColor ?? color} /> : null}
      <Circle cx={dotX} cy={dotY} r={dotR} color={color} />
    </Canvas>
  );
}

export const IdentityDisc = memo(function IdentityDisc(props: Props) {
  return props.animated === false ? <StaticIdentityDisc {...props} /> : <AnimatedIdentityDisc {...props} />;
});

const styles = StyleSheet.create({ mark: { position: 'absolute' } });
