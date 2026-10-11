/**
 * Creates the Lineup's shared values, runs the simulation on the UI thread,
 * and keeps it in sync with React state (selection, recorded sessions, month).
 * The frame loop pauses when the app is not active.
 */
import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { useFrameCallback, useSharedValue, withTiming, Easing, runOnUI } from 'react-native-reanimated';
import type { LocalDate } from '@/domain/types';
import { CELLS, type LineupLayout } from './layout';
import { stepWater, zeros, addRipple, type Water } from './water';

export function useWater(L: LineupLayout, weeks: LocalDate[][], selection: LocalDate[], counts: Map<string, number>, reduced: boolean, month: string, visible = true, kind = 0): Water {
  const w: Water = {
    clock: useSharedValue(0),
    crest: useSharedValue(zeros()),
    crestVel: useSharedValue(zeros()),
    target: useSharedValue(zeros()),
    press: useSharedValue(zeros()),
    pressTarget: useSharedValue(zeros()),
    recorded: useSharedValue(zeros()),
    ripples: useSharedValue<number[]>([]),
    tension: useSharedValue(0),
    tensionTarget: useSharedValue(0),
    pill: useSharedValue([0, 0, 0, 0]),
    swell: useSharedValue([-10, 1]),
    ambient: useSharedValue(reduced ? 0 : 1),
    firstLineY: useSharedValue(L.firstLineY),
    lineGap: useSharedValue(L.lineGap),
    weeks: useSharedValue(weeks.length),
    kind: useSharedValue(kind),
    centerX: useSharedValue(L.W / 2),
  };
  useEffect(() => {
    w.kind.set(kind);
    w.centerX.set(L.W / 2);
  }, [kind, L.W]); // eslint-disable-line react-hooks/exhaustive-deps

  const frame = useFrameCallback((f) => {
    'worklet';
    const dt = Math.min(1 / 30, Math.max(0, (f.timeSincePreviousFrame ?? 16) / 1000));
    w.clock.set(w.clock.get() + dt);
    stepWater(w, dt);
  }, true);

  // pause rendering work when the app is backgrounded
  useEffect(() => {
    frame.setActive(visible && AppState.currentState !== 'background');
    const sub = AppState.addEventListener('change', (s) => frame.setActive(s === 'active' && visible));
    return () => sub.remove();
  }, [frame, visible]);

  useEffect(() => {
    w.ambient.set(withTiming(reduced ? 0 : 1, { duration: 300 }));
  }, [reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  // layout changes (rotation, months with 5 vs 6 weeks) glide rather than jump
  useEffect(() => {
    const cfg = { duration: reduced ? 0 : 420, easing: Easing.bezier(0.22, 1, 0.36, 1) };
    w.firstLineY.set(withTiming(L.firstLineY, cfg));
    w.lineGap.set(withTiming(L.lineGap, cfg));
    w.weeks.set(weeks.length);
  }, [L.firstLineY, L.lineGap, weeks.length, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  // selection → crest targets (+ ripple for newly lifted crests)
  const prevSel = useRef<Set<string>>(new Set());
  const prevMonth = useRef(month);
  useEffect(() => {
    const sel = new Set(selection);
    const tgt = zeros();
    const ripples: number[] = [];
    weeks.forEach((wk, r) =>
      wk.forEach((d, c) => {
        const i = r * 7 + c;
        if (sel.has(d)) {
          tgt[i] = 1;
          if (!prevSel.current.has(d) && prevMonth.current === month) ripples.push(L.colX[c], L.firstLineY + r * L.lineGap);
        }
      }),
    );
    const monthChanged = prevMonth.current !== month;
    prevSel.current = sel;
    prevMonth.current = month;
    const n = selection.length;
    const level = n === 0 ? 0 : Math.min(0.96, 0.58 + 0.12 * n);
    const red = reduced;
    runOnUI(() => {
      'worklet';
      w.target.set(tgt);
      if (red || monthChanged) {
        // reduced motion or a new grid: crests settle without a spring sweep
        w.crest.set(tgt.slice());
        w.crestVel.set(zeros(tgt.length));
      }
      for (let k = 0; k < ripples.length; k += 2) addRipple(w, ripples[k], ripples[k + 1]);
      w.tensionTarget.set(n);
      const p = w.pill.value.slice();
      if (p[2] !== level) p[3] = Math.min(1.6, p[3] + 0.9);
      p[2] = level;
      if (red) {
        p[0] = level;
        p[1] = 0;
      }
      w.pill.set(p);
    })();
  }, [selection, weeks, month, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  // recorded sessions per cell
  useEffect(() => {
    const rec = zeros();
    weeks.forEach((wk, r) => wk.forEach((d, c) => (rec[r * 7 + c] = counts.get(d) ?? 0)));
    w.recorded.set(rec);
  }, [weeks, counts]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => w, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export function setPressed(w: Water, index: number, on: boolean) {
  'worklet';
  const p = w.pressTarget.value.slice();
  p[index] = on ? 1 : 0;
  w.pressTarget.set(p);
}

export function triggerSwell(w: Water, dir: number) {
  'worklet';
  w.swell.set([w.clock.get(), dir]);
}

export { CELLS };
