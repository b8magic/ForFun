/**
 * A month as a swell line: each day with sessions lifts a crest whose height
 * follows the number of sessions that day. Peaks rise when the row appears;
 * dates saved a moment ago rise last, in the activity colour.
 */
import { memo, useEffect, useMemo } from 'react';
import { Canvas, Path, usePathValue } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { useMotionReduced } from '@/state/selectors';
import { ridgelineGeometry, ridgelineY } from './ridgelineGeometry';

interface Props {
  width: number;
  height: number;
  /** sessions per day, index 1..31 */
  perDay: number[];
  color: string;
  ink: string;
  /** day numbers to highlight (just saved) */
  highlight?: number[];
  strokeWidth?: number;
}

const NO_HIGHLIGHT: number[] = [];

function RidgelineImpl({ width, height, perDay, color, ink, highlight = NO_HIGHLIGHT, strokeWidth = 1.6 }: Props) {
  const reduced = useMotionReduced();
  const grow = useSharedValue(reduced ? 1 : 0);
  const glow = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      grow.value = 1;
      glow.value = 1;
      return;
    }
    grow.value = withTiming(1, { duration: 700, easing: Easing.bezier(0.22, 1, 0.36, 1) });
    glow.value = withDelay(350, withTiming(1, { duration: 650, easing: Easing.bezier(0.3, 1.45, 0.6, 1) }));
  }, [perDay, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => ridgelineGeometry(width, height, perDay, highlight), [width, height, perDay, highlight]);
  const path = usePathValue((b) => {
    'worklet';
    for (let i = 0; i < geometry.points.length; i++) {
      const point = geometry.points[i];
      const y = ridgelineY(point, geometry.base, grow.value, glow.value);
      if (i === 0) b.moveTo(point.x, y);
      else b.lineTo(point.x, y);
    }
  });
  const dots = usePathValue((b) => {
    'worklet';
    for (const point of geometry.marks) {
      b.addCircle(point.x, ridgelineY(point, geometry.base, grow.value, glow.value), geometry.dotRadius * Math.max(0, Math.min(1, glow.value)));
    }
  });
  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Path path={path} style="stroke" strokeWidth={strokeWidth} strokeJoin="round" strokeCap="round" color={ink} />
      <Path path={dots} color={color} />
    </Canvas>
  );
}

export const Ridgeline = memo(RidgelineImpl);
