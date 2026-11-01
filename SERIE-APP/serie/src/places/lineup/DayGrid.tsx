/**
 * Day cells: accessible buttons whose numerals ride the crest of their
 * week-line. The tap toggles the date; press-in dips the line (resistance).
 */
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, runOnUI, runOnJS, type SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { LocalDate } from '@/domain/types';
import { parseDate, compareDates , weekdayMon0 } from '@/domain/dates';
import { palette, fonts, surfaces } from '@/ui/theme';
import { T } from '@/ui/T';
import { MONTHS, WEEKDAYS, t } from '@/i18n/it';
import { smooth } from '@/motion/grammar';
import type { LineupLayout } from './layout';
import { lineDisp, type Water } from './water';
import { setPressed } from './useWater';
import { phase } from './breakWave';

interface Props {
  L: LineupLayout;
  w: Water;
  weeks: LocalDate[][];
  month: { y: number; m: number };
  selection: Set<LocalDate>;
  counts: Map<string, number>;
  today: LocalDate;
  brk: SharedValue<number>;
  sw: SharedValue<number>;
  unfold: SharedValue<number>;
  onToggle: (d: LocalDate) => void;
  onSwipe: (dir: 1 | -1) => void;
  disabled: boolean;
}

function DayGridImpl({ L, w, weeks, month, selection, counts, today, brk, sw, unfold, onToggle, onSwipe, disabled }: Props) {
  const pan = Gesture.Pan()
    .activeOffsetX([-22, 22])
    .failOffsetY([-14, 14])
    .onEnd((e) => {
      'worklet';
      if (e.translationX < -48 || e.velocityX < -500) runOnJS(onSwipe)(1);
      else if (e.translationX > 48 || e.velocityX > 500) runOnJS(onSwipe)(-1);
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {weeks.map((wk, r) =>
          wk.map((d, c) => {
            const i = r * 7 + c;
            const ymd = parseDate(d);
            const inMonth = ymd.m === month.m && ymd.y === month.y;
            const future = compareDates(d, today) > 0;
            return (
              <Cell
                key={d}
                L={L}
                w={w}
                r={r}
                c={c}
                i={i}
                date={d}
                day={ymd.d}
                inMonth={inMonth}
                future={future}
                selected={selection.has(d)}
                count={counts.get(d) ?? 0}
                isToday={d === today}
                brk={brk}
                sw={sw}
                unfold={unfold}
                onToggle={onToggle}
                disabled={disabled}
              />
            );
          }),
        )}
      </View>
    </GestureDetector>
  );
}

interface CellProps {
  L: LineupLayout;
  w: Water;
  r: number;
  c: number;
  i: number;
  date: LocalDate;
  day: number;
  inMonth: boolean;
  future: boolean;
  selected: boolean;
  count: number;
  isToday: boolean;
  brk: SharedValue<number>;
  sw: SharedValue<number>;
  unfold: SharedValue<number>;
  onToggle: (d: LocalDate) => void;
  disabled: boolean;
}

const Cell = memo(function Cell({ L, w, r, c, i, date, day, inMonth, future, selected, count, isToday, brk, sw, unfold, onToggle, disabled }: CellProps) {
  const x = L.colX[c];
  const y = L.firstLineY + r * L.lineGap;
  const interactive = inMonth && !future && !disabled;
  const colX = L.colX;

  const numeral = useAnimatedStyle(() => {
    const u = brk.value;
    const d = lineDisp(w, colX, r, x);
    const lift = w.crest.value[i];
    const un = unfold.value;
    const ur = Math.min(1, Math.max(0, (un - r * 0.07 - c * 0.03) / 0.6));
    const alpha = (u < 1 ? phase.contentAlpha(u) : 1) * (1 - smooth(sw.value)) * (un < 1 ? ur : 1);
    return {
      opacity: alpha,
      transform: [{ translateY: d * (1 - 0.6 * smooth(sw.value)) + (1 - (un < 1 ? ur : 1)) * 14 + smooth(sw.value) * 40 }, { scale: 1 + 0.14 * Math.max(0, Math.min(1.2, lift)) }],
    };
  });

  const pressIn = useCallback(() => {
    if (interactive) runOnUI(setPressed)(w, i, true);
  }, [interactive, w, i]);
  const pressOut = useCallback(() => {
    runOnUI(setPressed)(w, i, false);
  }, [w, i]);
  const press = useCallback(() => {
    if (interactive) onToggle(date);
  }, [interactive, onToggle, date]);

  const wd = weekdayMon0(date);
  const label = `${WEEKDAYS[wd]} ${day} ${MONTHS[parseDate(date).m - 1]}`;
  const top = y - L.lineGap * 0.66;
  const h = Math.max(48, L.lineGap * 0.86);
  const dim = !inMonth ? 0.2 : future ? 0.3 : 1;

  return (
    <Pressable
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={press}
      disabled={!interactive}
      accessibilityRole="button"
      accessibilityLabel={inMonth ? t.dayA11y(label, selected, count, isToday) + (future ? `, ${t.futureDay.toLowerCase()}` : '') : undefined}
      aria-selected={selected} aria-disabled={!interactive}
      accessibilityElementsHidden={!inMonth}
      importantForAccessibility={inMonth ? 'yes' : 'no-hide-descendants'}
      style={[styles.cell, { left: x - L.colW / 2, top, width: L.colW, height: h }]}
      hitSlop={2}
      testID={`day-${date}`}
    >
      <Animated.View style={[styles.numeralWrap, { top: y - top - L.numeralOffset - 12 }, numeral]} pointerEvents="none">
        <T variant={selected || isToday ? 'dayStrong' : 'day'} color={palette.foam} style={{ opacity: dim }} align="center">
          {day}
        </T>
        {count > 1 && inMonth ? (
          <T variant="label" color={surfaces.night.mute} style={styles.count}>
            ×{count}
          </T>
        ) : null}
      </Animated.View>
      {isToday ? (
        <View style={[styles.today, { top: y - top + 12 }]} pointerEvents="none">
          <T variant="label" color={surfaces.night.mute} style={{ fontSize: 8.5, letterSpacing: 1.4 }}>
            {t.today}
          </T>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  cell: { position: 'absolute', alignItems: 'center' },
  numeralWrap: { position: 'absolute', left: 0, right: 0, height: 24, alignItems: 'center', justifyContent: 'center' },
  count: { position: 'absolute', right: 2, top: -4, fontSize: 8.5, fontFamily: fonts.mono },
  today: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});

export const DayGrid = memo(DayGridImpl);
