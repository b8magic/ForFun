/**
 * Standalone identity disc (its own small canvas), used in lists and sheets.
 * Inside the Lineup the same geometry is drawn in the main water canvas.
 */
import { memo, useMemo } from 'react';
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

function IdentityDiscImpl({ size, pattern, color, stripe, animated = true, selected = false, ringColor }: Props) {
  const reduced = useMotionReduced();
  const t = useSharedValue(1.3);
  const live = animated && !reduced;
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

export const IdentityDisc = memo(IdentityDiscImpl);
