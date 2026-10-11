/**
 * The Lineup's single Skia canvas: the identity disc, the week-lines and
 * their crests, the Save liquid, the breaking wave and the history handle.
 * Every path is rebuilt on the UI thread from the water model.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Group, Path, Circle, RoundedRect, Skia, BlurMask, DashPathEffect, usePathValue } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { palette } from '@/ui/theme';
import { clamp01, mix, easeFlow, smooth } from '@/motion/grammar';
import { discStripes } from '@/graphics/disc';
import type { LineupLayout } from './layout';
import { lineDisp, pillSurface, rowYw, type Water } from './water';
import { skin, addLayer, layerPoint, layerEnd, waveCamera, applyCam, phase, LAYERS, type WaveFrame } from './breakWave';

export interface DiscTarget {
  x: number;
  y: number;
  r: number;
}

interface Props {
  L: LineupLayout;
  w: Water;
  /** 1 for days of the viewed month that can be selected, 0 otherwise. */
  inMonth: number[];
  /** break timeline (1 = idle) */
  brk: SharedValue<number>;
  /** cells of the saved dates at the moment of saving */
  breakCells: SharedValue<number[]>;
  /** switcher progress 0..1 */
  sw: SharedValue<number>;
  /** re-unfold after switching activity, 0..1 (1 = idle) */
  unfold: SharedValue<number>;
  /** where the active disc sits when the switcher is open */
  discTarget: DiscTarget;
  pattern: number;
  color: string;
  /** history handle: x positions (0..1) and heights of recent session days */
  handleBumps: number[];
}

const ROW_LAYER = (r: number) => {
  'worklet';
  return Math.max(0, 10 - 2 * r);
};

function WaterCanvasImpl({ L, w, inMonth, brk, breakCells, sw, unfold, discTarget, pattern, color, handleBumps }: Props) {
  const s = L.W / 1080;
  const frame: WaveFrame = { s, y0: L.bandBottom, xStart: -1400 * s };
  const bandGap = 14 * s * 2.2;
  const N = 56;

  // ── identity disc (header ⇄ switcher) ──
  const disc = useDerivedValue(() => {
    const k = easeFlow(sw.value);
    return { x: mix(L.discX, discTarget.x, k), y: mix(L.discY, discTarget.y, k), r: mix(L.discR, discTarget.r, k) };
  });
  const discClip = usePathValue((b) => {
    'worklet';
    const d = disc.value;
    b.addCircle(d.x, d.y, d.r);
  });
  const discPath = usePathValue((b) => {
    'worklet';
    const d = disc.value;
    discStripes(b, pattern, d.x, d.y, d.r, w.clock.value * (0.35 + 0.65 * w.ambient.value), 7);
  });
  const discDotR = useDerivedValue(() => Math.max(2.5, disc.value.r * 0.203));
  const discDotX = useDerivedValue(() => disc.value.x + Math.cos(-Math.PI / 4) * (disc.value.r + discDotR.value + 2.5));
  const discDotY = useDerivedValue(() => disc.value.y + Math.sin(-Math.PI / 4) * (disc.value.r + discDotR.value + 2.5));

  // ── week-lines ──
  const lineY = (r: number, x: number, u: number) => {
    'worklet';
    const base = rowYw(w, r);
    let y = base;
    const un = unfold.value;
    if (un < 1) {
      const ur = clamp01((un - r * 0.07) / 0.62);
      y = mix(disc.value.y, base, easeFlow(ur));
    }
    if (u < 1) {
      const q = phase.drawback(u);
      if (u < 0.5) y = mix(y, L.bandBottom - ROW_LAYER(r) * bandGap, q);
      else y = base + phase.returnOffset(u) * (L.bandBottom - base + 30);
    }
    y += smooth(sw.value) * (L.H * 0.16 + r * 7);
    return y;
  };
  const dispScale = (u: number) => {
    'worklet';
    const q = u < 0.5 ? phase.drawback(u) : 0;
    return (1 - q) * (1 - 0.6 * smooth(sw.value));
  };
  const extent = (r: number, u: number) => {
    'worklet';
    let x0 = L.lineX0;
    let x1 = L.lineX1;
    const un = unfold.value;
    if (un < 1) {
      const ur = clamp01((un - r * 0.07) / 0.62);
      x0 = mix(disc.value.x, L.lineX0, easeFlow(ur));
      x1 = mix(disc.value.x + disc.value.r, L.lineX1, easeFlow(clamp01(ur * 1.3)));
    }
    if (u < 0.5) {
      const q = phase.drawback(u);
      x0 = mix(x0, -24, q);
      x1 = mix(x1, L.W + 24, q);
    }
    return [x0, x1];
  };

  const rideArc = (u: number, k: number, s0: number, S: ReturnType<typeof skin>, layer: number) => {
    'worklet';
    const e = clamp01((u - 0.2 - k * 0.015) / (0.36 + k * 0.005));
    const ee = e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2;
    return mix(s0, layerEnd(S, layer) + 26 * s * 2.2, ee);
  };

  /** [x, y, scale] per saved cell. */
  const dotPositions = (u: number, cells: number[]) => {
    'worklet';
    const out: number[] = [];
    if (u < 0.2) {
      for (let k = 0; k < cells.length; k++) {
        const r = Math.floor(cells[k] / 7);
        const c = cells[k] % 7;
        const x = L.colX[c];
        out.push(x, lineY(r, x, u) + lineDisp(w, L.colX, r, x) * dispScale(u), 1);
      }
      return out;
    }
    const uu = Math.min(u, 0.6);
    const S = skin(uu, frame);
    const cam = waveCamera(uu, L.W, L.bandBottom);
    for (let k = 0; k < cells.length; k++) {
      const r = Math.floor(cells[k] / 7);
      const c = cells[k] % 7;
      const layer = ROW_LAYER(r);
      const sA = rideArc(uu, k, L.colX[c] - frame.xStart, S, layer);
      const end = layerEnd(S, layer);
      let p: number[];
      if (sA <= end) p = layerPoint(S, layer, sA);
      else {
        const tip = layerPoint(S, layer, end);
        const over = sA - end;
        p = [tip[0] + Math.cos(tip[2]) * over, tip[1] + Math.sin(tip[2]) * over, tip[2]];
      }
      const sp = applyCam(cam, p[0], p[1]);
      if (u <= 0.6) {
        out.push(sp[0], sp[1], 1);
        continue;
      }
      // flight into the history handle
      const f = clamp01((u - 0.6 - k * 0.025) / 0.24);
      const e = 1 - Math.pow(1 - f, 3);
      const hx = L.W / 2 + (k - (cells.length - 1) / 2) * 14;
      const hy = L.handleY - 12;
      const cx = sp[0];
      const cy = Math.min(sp[1], hy) - 140;
      const x = (1 - e) * (1 - e) * sp[0] + 2 * (1 - e) * e * cx + e * e * hx;
      const y = (1 - e) * (1 - e) * sp[1] + 2 * (1 - e) * e * cy + e * e * hy;
      out.push(x, y, 1 - smooth((f - 0.85) / 0.15) * 0.9);
    }
    return out;
  };

  const lines = usePathValue((b) => {
    'worklet';
    const u = brk.value;
    if (u > 0.2 && u < 0.78) return;
    const nW = w.weeks.value;
    const ds = dispScale(u);
    for (let r = 0; r < nW; r++) {
      const ex = extent(r, u);
      if (ex[1] - ex[0] < 1) continue;
      for (let i = 0; i <= N; i++) {
        const x = mix(ex[0], ex[1], i / N);
        const y = lineY(r, x, u) + lineDisp(w, L.colX, r, x) * ds;
        if (i === 0) b.moveTo(x, y);
        else b.lineTo(x, y);
      }
    }
  });
  const linesAlpha = useDerivedValue(() => {
    const u = brk.value;
    return (u < 1 ? phase.calendarAlpha(u) : 1) * (1 - 0.82 * smooth(sw.value)) * (unfold.value < 1 ? 0.35 + 0.65 * unfold.value : 1);
  });

  // ticks, recorded rings and crest dots follow the same displacement
  const marks = usePathValue((b) => {
    'worklet';
    const u = brk.value;
    if (u < 1 || unfold.value < 1) return;
    const nW = w.weeks.value;
    const pos = w.crest.value;
    const rec = w.recorded.value;
    const ds = dispScale(u);
    for (let r = 0; r < nW; r++) {
      for (let c = 0; c < 7; c++) {
        const i = r * 7 + c;
        if (!inMonth[i] || pos[i] > 0.3 || rec[i] > 0) continue;
        const x = L.colX[c];
        const y = lineY(r, x, u) + lineDisp(w, L.colX, r, x) * ds;
        b.moveTo(x, y - 5);
        b.lineTo(x, y + 5);
      }
    }
  });
  const rings = usePathValue((b) => {
    'worklet';
    const u = brk.value;
    if (unfold.value < 1) return;
    if (u > 0.2 && u < 0.85) return;
    const nW = w.weeks.value;
    const rec = w.recorded.value;
    const ds = dispScale(u);
    for (let r = 0; r < nW; r++) {
      for (let c = 0; c < 7; c++) {
        const i = r * 7 + c;
        const n = rec[i];
        if (n <= 0) continue;
        const x = L.colX[c];
        const y = lineY(r, x, u) + lineDisp(w, L.colX, r, x) * ds;
        for (let k = 0; k < Math.min(n, 3); k++) b.addCircle(x, y, 5 + k * 3.6);
      }
    }
  });
  const dots = usePathValue((b) => {
    'worklet';
    const u = brk.value;
    if (u < 1 || unfold.value < 1) return;
    const nW = w.weeks.value;
    const pos = w.crest.value;
    for (let r = 0; r < nW; r++) {
      for (let c = 0; c < 7; c++) {
        const i = r * 7 + c;
        if (pos[i] < 0.02) continue;
        const x = L.colX[c];
        const y = lineY(r, x, u) + lineDisp(w, L.colX, r, x) * dispScale(u);
        b.addCircle(x, y, 6.5 * clamp01(pos[i] * 1.4));
      }
    }
  });
  const marksAlpha = useDerivedValue(() => 1 - smooth(sw.value));
  // the active pattern shapes the lines themselves: stride dashes, grain dots, pulse breath
  const dashPhase = useDerivedValue(() => -w.clock.value * (pattern === 1 ? 14 : 3) * w.ambient.value);
  const lineWidth = useDerivedValue(() => (pattern === 2 ? 2 + 0.55 * Math.sin(w.clock.value * 2.6) * w.ambient.value : pattern === 5 ? 2.6 : 2));

  // ── Save liquid ──
  const pillClip = Skia.RRectXY(Skia.XYWHRect(L.pillCX - L.pillW / 2, L.pillCY - L.pillH / 2, L.pillW, L.pillH), L.pillH / 2, L.pillH / 2);
  const liquid = usePathValue((b) => {
    'worklet';
    const p = w.pill.value;
    const level = clamp01(p[0]);
    if (level <= 0.002) return;
    const left = L.pillCX - L.pillW / 2;
    const bottom = L.pillCY + L.pillH / 2;
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const x = left + (L.pillW * i) / steps;
      const y = bottom - level * L.pillH + pillSurface(w, x);
      if (i === 0) b.moveTo(x, y);
      else b.lineTo(x, y);
    }
    b.lineTo(left + L.pillW, bottom + 4);
    b.lineTo(left, bottom + 4);
    b.close();
  });
  const pillAlpha = useDerivedValue(() => 1 - 0.75 * smooth(sw.value));

  // ── the break ──
  const wave = usePathValue((b) => {
    'worklet';
    const u = brk.value;
    if (u < 0.17 || u > 0.86) return;
    const S = skin(u, frame);
    const cam = waveCamera(u, L.W, L.bandBottom);
    for (let i = LAYERS - 1; i >= 1; i--) {
      const isCal = i % 2 === 0 && i <= 10;
      if (!isCal && u < 0.24 && (u - 0.17) / 0.07 < (i % 3) / 3) continue;
      addLayer(b, S, i);
    }
    b.transform([cam[0], 0, (1 - cam[0]) * cam[3] + cam[1], 0, cam[0], (1 - cam[0]) * cam[4] + cam[2], 0, 0, 1]);
  });
  const skinPath = usePathValue((b) => {
    'worklet';
    const u = brk.value;
    if (u < 0.17 || u > 0.86) return;
    const S = skin(u, frame);
    const cam = waveCamera(u, L.W, L.bandBottom);
    addLayer(b, S, 0);
    b.transform([cam[0], 0, (1 - cam[0]) * cam[3] + cam[1], 0, cam[0], (1 - cam[0]) * cam[4] + cam[2], 0, 0, 1]);
  });
  const waveAlpha = useDerivedValue(() => phase.waveAlpha(brk.value));

  // saved dots ride the outer layers, then fly into history
  const breakDots = usePathValue((b) => {
    'worklet';
    const u = brk.value;
    if (u >= 1) return;
    const cells = breakCells.value;
    if (!cells.length) return;
    const pts = dotPositions(u, cells);
    for (let k = 0; k < pts.length; k += 3) if (pts[k + 2] > 0.05) b.addCircle(pts[k], pts[k + 1], 6.5 * pts[k + 2]);
  });
  const trails = usePathValue((b) => {
    'worklet';
    const u = brk.value;
    if (u < 0.2 || u > 0.6) return;
    const cells = breakCells.value;
    const S = skin(u, frame);
    const cam = waveCamera(u, L.W, L.bandBottom);
    for (let k = 0; k < cells.length; k++) {
      const r = Math.floor(cells[k] / 7);
      const c = cells[k] % 7;
      const layer = ROW_LAYER(r);
      const sA = rideArc(u, k, L.colX[c] - frame.xStart, S, layer);
      const end = Math.min(sA, layerEnd(S, layer));
      addLayer(b, S, layer, Math.max(0, end - 90 * s * 2.2), end);
    }
    b.transform([cam[0], 0, (1 - cam[0]) * cam[3] + cam[1], 0, cam[0], (1 - cam[0]) * cam[4] + cam[2], 0, 0, 1]);
  });

  // ── history handle: a short swell line of the last weeks ──
  const handle = usePathValue((b) => {
    'worklet';
    const y0 = L.handleY - 12;
    const x0 = L.W / 2 - 64;
    const x1 = L.W / 2 + 64;
    const n = 48;
    const u = brk.value;
    const pulse = u > 0.84 && u < 1 ? Math.sin(((u - 0.84) / 0.16) * Math.PI) : 0;
    for (let i = 0; i <= n; i++) {
      const x = mix(x0, x1, i / n);
      let y = y0 + Math.sin(x * 0.08 + w.clock.value * 1.4) * 0.8 * w.ambient.value;
      for (let k = 0; k < handleBumps.length; k += 2) {
        const bx = mix(x0, x1, handleBumps[k]);
        y -= handleBumps[k + 1] * 7 * Math.exp(-((x - bx) * (x - bx)) / 18);
      }
      y -= pulse * 5 * Math.exp(-((x - L.W / 2) * (x - L.W / 2)) / 900);
      if (i === 0) b.moveTo(x, y);
      else b.lineTo(x, y);
    }
  });
  const handleAlpha = useDerivedValue(() => 1 - smooth(sw.value));
  const flash = useDerivedValue(() => {
    const u = brk.value;
    return u > 0.55 && u < 0.8 ? 0.07 * Math.sin(((u - 0.55) / 0.25) * Math.PI) : 0;
  });

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group clip={discClip}>
        <Path path={discPath} color={palette.foam} />
      </Group>
      <Circle cx={discDotX} cy={discDotY} r={discDotR} color={color} />

      <Group opacity={linesAlpha}>
        <Path path={lines} style="stroke" strokeWidth={lineWidth} strokeCap="round" strokeJoin="round" color={palette.foam}>
          {pattern === 1 ? <DashPathEffect intervals={[16, 5]} phase={dashPhase} /> : null}
          {pattern === 5 ? <DashPathEffect intervals={[0.1, 5.5]} phase={dashPhase} /> : null}
        </Path>
      </Group>
      <Group opacity={marksAlpha}>
        <Path path={marks} style="stroke" strokeWidth={1.5} color="rgba(238,232,218,0.38)" />
        <Path path={rings} style="stroke" strokeWidth={1.6} color={palette.foam} />
        <Path path={dots} color={color}>
          <BlurMask blur={0.6} style="solid" />
        </Path>
      </Group>

      <Group opacity={pillAlpha}>
        <RoundedRect x={L.pillCX - L.pillW / 2} y={L.pillCY - L.pillH / 2} width={L.pillW} height={L.pillH} r={L.pillH / 2} style="stroke" strokeWidth={1.5} color="rgba(238,232,218,0.32)" />
        <Group clip={pillClip}>
          <Path path={liquid} color={color} />
        </Group>
      </Group>

      <Group opacity={waveAlpha}>
        <Path path={wave} style="stroke" strokeWidth={1.6} strokeCap="round" strokeJoin="round" color={palette.foam} />
        <Path path={skinPath} style="stroke" strokeWidth={2.6} strokeCap="round" strokeJoin="round" color={color} />
      </Group>
      <Path path={trails} style="stroke" strokeWidth={3} strokeCap="round" color={color} opacity={0.85} />
      <Path path={breakDots} color={color} />

      <Group opacity={handleAlpha}>
        <Path path={handle} style="stroke" strokeWidth={1.6} strokeCap="round" color={palette.foam} />
      </Group>
      <RoundedRect x={0} y={0} width={L.W} height={L.H} r={0} color={palette.bone} opacity={flash} />
    </Canvas>
  );
}

export const WaterCanvas = memo(WaterCanvasImpl);
