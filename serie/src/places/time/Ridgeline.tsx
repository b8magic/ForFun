/**
 * A month as a swell line: each day with sessions lifts a crest whose height
 * follows the number of sessions that day. Peaks rise when the row appears;
 * dates saved a moment ago rise last, in the activity colour.
 */
import { memo, useEffect } from 'react';
import { Canvas, Path, usePathValue, Circle } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { useMotionReduced } from '@/state/selectors';

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

function RidgelineImpl({ width, height, perDay, color, ink, highlight = [], strokeWidth = 1.6 }: Props) {
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
  const days = perDay.length - 1;
  const base = height - 4;
  const amp = Math.min(13, (height - 10) / 3.2);
  const sig = Math.max(3, width / days / 2.4);
  const hl = highlight;

  const build = (b: { moveTo: (x: number, y: number) => void; lineTo: (x: number, y: number) => void }, only: number[] | null) => {
    'worklet';
    const n = 96;
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * width;
      let y = base;
      for (let d = 1; d <= days; d++) {
        const c = perDay[d];
        if (!c) continue;
        const isNew = hl.indexOf(d) >= 0;
        const k = isNew ? glow.value : grow.value;
        const dx = x - ((d - 0.5) / days) * width;
        if (dx > sig * 4 || dx < -sig * 4) continue;
        y -= Math.min(c, 4) * amp * k * Math.exp(-(dx * dx) / (2 * sig * sig));
      }
      if (i === 0) b.moveTo(x, y);
      else b.lineTo(x, y);
    }
    return only;
  };
  const path = usePathValue((b) => {
    'worklet';
    build(b, null);
  });
  const dots = usePathValue((b) => {
    'worklet';
    for (let k = 0; k < hl.length; k++) {
      const d = hl[k];
      const c = perDay[d] ?? 0;
      if (!c) continue;
      const x = ((d - 0.5) / days) * width;
      b.addCircle(x, base - Math.min(c, 4) * amp * glow.value, 3.2 * glow.value);
    }
  });
  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Path path={path} style="stroke" strokeWidth={strokeWidth} strokeJoin="round" strokeCap="round" color={ink} />
      <Path path={dots} color={color} />
      <Circle cx={-10} cy={-10} r={0} color={color} />
    </Canvas>
  );
}

export const Ridgeline = memo(RidgelineImpl);
