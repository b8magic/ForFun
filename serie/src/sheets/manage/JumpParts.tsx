import { useSurface, useThemedStyles } from '@/ui/useTheme';
/**
 * "Vai a…" parts: a strip of years on a line (the chosen one carries a crest
 * dot, like Segmented) and a 12-month grid with truthful session counts.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { fonts, HIT, type Surface } from '@/ui/theme';
import { T } from '@/ui/T';
import { MONTHS_TITLE, t } from '@/i18n/it';
import { useMotionReduced } from '@/state/selectors';
import { Caret } from './parts';

export function YearStrip({ years, value, counts, accent, onChange, onEarlier }: { years: number[]; value: number; counts: Map<number, number>; accent: string; onChange: (y: number) => void; onEarlier: () => void }) {
  const S = useSurface();
  const styles = useThemedStyles(createStyles);
  const ref = useRef<ScrollView>(null);
  const reduced = useMotionReduced();
  const settled = useRef(false);
  const [rowX, setRowX] = useState(0);
  const [viewW, setViewW] = useState(0);
  const [itemW, setItemW] = useState(0);

  // Keep the chosen year in view (it is the only label saying which year the grid shows):
  // on open, after choosing, and after earlier years are prepended. Positions come from the
  // index (every year cell has the same width): web's onLayout does not fire on moves alone.
  const index = years.indexOf(value);
  useEffect(() => {
    if (index < 0 || !viewW || !itemW) return;
    ref.current?.scrollTo({ x: Math.max(0, rowX + index * itemW + itemW / 2 - viewW / 2), animated: settled.current && !reduced });
    settled.current = true;
  }, [index, viewW, rowX, itemW, reduced]);

  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} onLayout={(e) => setViewW(e.nativeEvent.layout.width)} contentContainerStyle={styles.strip}>
      <Pressable
        onPress={onEarlier}
        accessibilityRole="button"
        accessibilityLabel={`${t.manage.earlierYear}: ${years[0] - 1}`}
        testID="jump-earlier"
        style={({ pressed }) => [styles.earlier, pressed && { opacity: 0.6 }]}
      >
        <Caret dir="left" color={S.mute} size={7} />
        <T variant="label" color={S.mute}>
          {String(years[0] - 1)}
        </T>
      </Pressable>
      <View accessibilityRole="radiogroup" style={styles.years} onLayout={(e) => setRowX(e.nativeEvent.layout.x)}>
        {years.map((y) => {
          const on = y === value;
          const n = counts.get(y) ?? 0;
          return (
            <Pressable
              key={y}
              onPress={() => onChange(y)}
              accessibilityRole="radio"
              aria-checked={on}
              accessibilityLabel={t.manage.yearA11y(y, n, on)}
              testID={`jump-year-${y}`}
              onLayout={y === years[0] ? (e) => setItemW(e.nativeEvent.layout.width) : undefined}
              style={({ pressed }) => [styles.year, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.dot, { backgroundColor: on ? accent : 'transparent' }]} />
              <T variant="heading" color={on ? S.fg : S.mute} style={on ? null : styles.light}>
                {String(y)}
              </T>
              <T variant="label" color={on ? S.fg : S.mute} style={{ opacity: n > 0 ? 1 : 0 }}>
                {String(n)}
              </T>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

export interface MonthCell {
  m: number; // 1–12
  count: number;
  future: boolean;
  current: boolean;
  viewing: boolean;
  /** Empty months are navigable at home, but have no history detail to open. */
  disabled?: boolean;
}

export function MonthGrid({ year, cells, accent, onPick }: { year: number; cells: MonthCell[]; accent: string; onPick: (m: number) => void }) {
  const S = useSurface();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.grid} testID="jump-months">
      {cells.map((c) => {
        const label = `${MONTHS_TITLE[c.m - 1]} ${year}`;
        return (
          <View key={c.m} style={styles.cellWrap}>
            <Pressable
              onPress={() => onPick(c.m)}
              disabled={c.future || c.disabled}
              accessibilityRole="button"
              aria-disabled={c.future || !!c.disabled} aria-selected={c.viewing}
              accessibilityLabel={t.manage.monthA11y(label, c.count, c)}
              testID={`jump-month-${c.m}`}
              style={({ pressed }) => [styles.cell, { opacity: c.future || c.disabled ? 0.3 : pressed ? 0.66 : 1 }, c.viewing && { backgroundColor: S.raised }]}
            >
              {c.viewing ? <View style={[styles.crest, { backgroundColor: accent }]} /> : null}
              <T variant="heading" color={S.fg} style={[styles.monthTitle, c.viewing ? null : styles.light]} numberOfLines={1} adjustsFontSizeToFit>
                {MONTHS_TITLE[c.m - 1]}
              </T>
              <View style={styles.cellMeta}>
                {c.count > 0 ? (
                  <T variant="label" color={S.mute} numberOfLines={1} style={styles.monthMeta}>
                    {String(c.count)}
                  </T>
                ) : null}
                {c.current ? (
                  <T variant="labelStrong" color={S.fg} numberOfLines={1} style={styles.monthMeta}>
                    {t.today}
                  </T>
                ) : null}
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (S: Surface) => StyleSheet.create({
  strip: { alignItems: 'flex-end', minWidth: '100%' },
  earlier: { minWidth: HIT, minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 2, paddingRight: 12, marginBottom: 10 },
  years: { flexDirection: 'row' },
  year: { minWidth: 72, minHeight: 60, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 8, paddingBottom: 4, gap: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, marginBottom: 4 },
  light: { fontFamily: fonts.displayCondensed },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -12 },
  cellWrap: { width: '33.333%', paddingRight: 12, paddingBottom: 8 },
  cell: { minHeight: 60, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10, justifyContent: 'center' },
  crest: { position: 'absolute', top: 8, right: 8, width: 5, height: 5, borderRadius: 2.5 },
  monthTitle: { fontSize: 25, lineHeight: 28 },
  monthMeta: { fontSize: 10, lineHeight: 15, letterSpacing: 0.6 },
  cellMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 15 },
});
