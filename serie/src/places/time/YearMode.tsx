/**
 * Anno — one group per year: exact annual sessions, recorded hours with
 * completeness, and a compact monthly breakdown drawn as a year-long swell.
 * Tapping a month drills into Mese at that month (same activity, same place).
 */
import { memo, useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Canvas, Path, usePathValue, DashPathEffect } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import type { YearGroup } from '@/domain/history';
import { surfaces, space } from '@/ui/theme';
import { T } from '@/ui/T';
import { MONTHS_SHORT, MONTHS_TITLE, t } from '@/i18n/it';
import { focusHistoryMonth } from '@/state/actions';
import { useMotionReduced } from '@/state/selectors';
import { durationLine } from './format';

const C = surfaces.calm;

export function YearMode({ groups, header, accent }: { groups: YearGroup[]; header: React.ReactElement; accent: string }) {
  return (
    <FlatList
      data={groups}
      keyExtractor={(g) => String(g.year)}
      ListHeaderComponent={header}
      renderItem={({ item }) => <YearRow g={item} accent={accent} />}
      contentContainerStyle={{ paddingBottom: 80 }}
      testID="year-list"
    />
  );
}

const YearRow = memo(function YearRow({ g, accent }: { g: YearGroup; accent: string }) {
  const { width } = useWindowDimensions();
  const W = width - 2 * space.gutter;
  const max = Math.max(1, ...g.months.map((m) => m.summary.sessions));
  const dur = durationLine(g.summary.duration);
  return (
    <View style={styles.year} accessibilityLabel={`${g.year}: ${t.sessions(g.summary.sessions)}${dur ? `. ${dur}` : ''}`}>
      <View style={styles.head}>
        <T variant="hero" color={g.summary.sessions ? C.fg : C.mute}>
          {g.year}
        </T>
        <View style={{ alignItems: 'flex-end', paddingBottom: 10 }}>
          <T variant="heading" color={C.fg} style={{ fontVariant: ['tabular-nums'] }}>
            {g.summary.sessions}
          </T>
          <T variant="label" color={C.mute}>
            {g.summary.sessions === 1 ? 'sessione' : 'sessioni'}
          </T>
        </View>
      </View>
      {g.summary.sessions ? (
        <T variant="data" color={C.mute} style={{ marginBottom: 6 }}>
          {t.activeDays(g.summary.activeDays)} · {dur}
        </T>
      ) : (
        <T variant="data" color={C.mute} style={{ marginBottom: 6 }}>
          {t.emptyMonth}
        </T>
      )}
      <YearSwell width={W} counts={g.months.map((m) => (m.future ? -1 : m.summary.sessions))} max={max} accent={accent} />
      <View style={styles.cols}>
        {g.months.map((m) => (
          <Pressable
            key={m.key}
            style={styles.col}
            disabled={m.future}
            onPress={() => focusHistoryMonth(m.key)}
            accessibilityRole="button"
            accessibilityLabel={`${MONTHS_TITLE[m.month.m - 1]} ${g.year}: ${m.future ? 'futuro' : t.sessions(m.summary.sessions)}`}
            aria-disabled={m.future}
            testID={`year-month-${m.key}`}
          >
            <T variant="label" color={C.mute} style={{ fontSize: 9, letterSpacing: 0.6 }}>
              {MONTHS_SHORT[m.month.m - 1][0]}
            </T>
            <T variant={m.summary.sessions ? 'dataStrong' : 'data'} color={m.future ? C.faint : m.summary.sessions ? C.fg : C.mute} style={{ fontSize: 12 }}>
              {m.future ? '—' : m.summary.sessions}
            </T>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

function YearSwell({ width, counts, max, accent }: { width: number; counts: number[]; max: number; accent: string }) {
  const reduced = useMotionReduced();
  const grow = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    grow.value = reduced ? 1 : withTiming(1, { duration: 800, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  }, [counts.join(','), reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  const H = 56;
  const base = H - 4;
  const colW = width / 12;
  const pastEnd = counts.findIndex((c) => c < 0);
  const lastX = pastEnd < 0 ? width : pastEnd * colW;
  const line = usePathValue((b) => {
    'worklet';
    const n = 120;
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * lastX;
      let y = base;
      for (let k = 0; k < 12; k++) {
        const c = counts[k];
        if (c <= 0) continue;
        const dx = x - (k + 0.5) * colW;
        y -= (c / max) * (H - 12) * grow.value * Math.exp(-(dx * dx) / (2 * (colW * 0.32) * (colW * 0.32)));
      }
      if (i === 0) b.moveTo(x, y);
      else b.lineTo(x, y);
    }
  });
  const future = usePathValue((b) => {
    'worklet';
    if (lastX >= width) return;
    b.moveTo(lastX, base);
    b.lineTo(width, base);
  });
  return (
    <Canvas style={{ width, height: H }} pointerEvents="none">
      <Path path={line} style="stroke" strokeWidth={1.8} strokeJoin="round" strokeCap="round" color={C.line} />
      <Path path={future} style="stroke" strokeWidth={1.2} color={C.faint}>
        <DashPathEffect intervals={[3, 5]} />
      </Path>
      <Path path={line} style="stroke" strokeWidth={0} color={accent} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  year: { paddingHorizontal: space.gutter, paddingTop: 18, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.faint },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cols: { flexDirection: 'row', marginTop: 2 },
  col: { flex: 1, alignItems: 'center', minHeight: 44, justifyContent: 'center', gap: 1 },
});
