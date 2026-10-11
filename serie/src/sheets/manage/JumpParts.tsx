/**
 * "Vai a…" parts: a strip of years on a line (the chosen one carries a crest
 * dot, like Segmented) and a 12-month grid with truthful session counts.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { fonts, palette, surfaces, HIT } from '@/ui/theme';
import { T } from '@/ui/T';
import { MONTHS_TITLE, t } from '@/i18n/it';
import { useMotionReduced } from '@/state/selectors';
import { Caret } from './parts';

const S = surfaces.night;

export function YearStrip({ years, value, counts, accent, onChange, onEarlier }: { years: number[]; value: number; counts: Map<number, number>; accent: string; onChange: (y: number) => void; onEarlier: () => void }) {
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
}

export function MonthGrid({ year, cells, accent, onPick }: { year: number; cells: MonthCell[]; accent: string; onPick: (m: number) => void }) {
  return (
    <View style={styles.grid} testID="jump-months">
      {cells.map((c) => {
        const label = `${MONTHS_TITLE[c.m - 1]} ${year}`;
        return (
          <View key={c.m} style={styles.cellWrap}>
            <Pressable
              onPress={() => onPick(c.m)}
              disabled={c.future}
              accessibilityRole="button"
              aria-disabled={c.future} aria-selected={c.viewing}
              accessibilityLabel={t.manage.monthA11y(label, c.count, c)}
              testID={`jump-month-${c.m}`}
              style={({ pressed }) => [styles.cell, { opacity: c.future ? 0.26 : pressed ? 0.66 : 1 }]}
            >
              <View style={[styles.cellLine, c.viewing ? { backgroundColor: accent, height: 2 } : c.current ? { backgroundColor: palette.foam } : null]} />
              {c.viewing ? <View style={[styles.crest, { backgroundColor: accent }]} /> : null}
              <T variant="heading" color={c.viewing || c.current ? S.fg : 'rgba(238,232,218,0.82)'} style={c.viewing ? null : styles.light} numberOfLines={1} adjustsFontSizeToFit>
                {MONTHS_TITLE[c.m - 1]}
              </T>
              {/* One fact per line: a count and the OGGI marker never squeeze each other into broken wraps. */}
              <View style={styles.cellMeta}>
                {c.count > 0 ? (
                  <T variant="label" color={c.viewing ? accent : S.mute} numberOfLines={1}>
                    {t.sessions(c.count)}
                  </T>
                ) : null}
                {c.current ? (
                  <T variant="labelStrong" color={S.fg} numberOfLines={1}>
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

const styles = StyleSheet.create({
  strip: { alignItems: 'flex-end', borderBottomWidth: 1.2, borderBottomColor: 'rgba(238,232,218,0.3)', minWidth: '100%' },
  earlier: { minWidth: HIT, minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 2, paddingRight: 12, marginBottom: 24 },
  years: { flexDirection: 'row' },
  year: { minWidth: 72, minHeight: 70, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 8, paddingBottom: 8, gap: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, marginBottom: 4 },
  light: { fontFamily: fonts.displayCondensed },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -12 },
  cellWrap: { width: '33.333%', paddingRight: 12, paddingBottom: 8 },
  cell: { minHeight: 66, paddingTop: 10, gap: 0 },
  cellLine: { position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth * 2, backgroundColor: 'rgba(238,232,218,0.22)' },
  crest: { position: 'absolute', top: -3, left: 0, width: 8, height: 8, borderRadius: 4 },
  cellMeta: { alignItems: 'flex-start', gap: 2, minHeight: 15 },
});
