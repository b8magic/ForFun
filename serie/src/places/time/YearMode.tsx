/** Anno — each recorded year is a grid of twelve miniature calendars. */
import { memo, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { YearGroup } from '@/domain/history';
import type { DaySummary } from '@/domain/daySummaries';
import type { LocalDate } from '@/domain/types';
import { monthWeeks, parseDate } from '@/domain/dates';
import { space, type Surface } from '@/ui/theme';
import { useSurface } from '@/ui/useTheme';
import { T } from '@/ui/T';
import { MONTHS_SHORT, MONTHS_TITLE, t } from '@/i18n/it';
import { focusHistoryMonth } from '@/state/actions';
import { durationLine } from './format';

interface Props {
  groups: YearGroup[];
  days: Map<string, DaySummary>;
  header: React.ReactElement;
  today: LocalDate;
}

export function YearMode({ groups, days, header, today }: Props) {
  return (
    <FlatList
      data={groups}
      keyExtractor={(g) => String(g.year)}
      ListHeaderComponent={header}
      renderItem={({ item }) => <YearRow g={item} days={days} today={today} />}
      initialNumToRender={3}
      windowSize={5}
      contentContainerStyle={{ paddingBottom: 90 }}
      testID="year-list"
    />
  );
}

const YearRow = memo(function YearRow({ g, days, today }: {
  g: YearGroup;
  days: Map<string, DaySummary>;
  today: LocalDate;
}) {
  const C = useSurface();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { width } = useWindowDimensions();
  const columns = width >= 680 ? 4 : 3;
  const tileWidth = (width - 2 * space.gutter - (columns - 1) * 10) / columns;
  const dur = durationLine(g.summary.duration);
  const populated = g.summary.sessions > 0;
  const months = useMemo(() => g.months.slice().reverse(), [g.months]);

  return (
    <View style={styles.year} testID={`year-${g.year}`}>
      <View style={styles.head} accessible accessibilityLabel={`${g.year}: ${t.sessions(g.summary.sessions)}${dur ? `. ${dur}` : ''}`}>
        <T variant="hero" color={populated ? C.fg : C.mute}>
          {g.year}
        </T>
        <View style={{ alignItems: 'flex-end', paddingBottom: 10 }}>
          <T variant="heading" color={populated ? C.fg : C.mute} style={{ fontVariant: ['tabular-nums'] }}>
            {g.summary.sessions}
          </T>
          <T variant="label" color={C.mute}>
            {g.summary.sessions === 1 ? 'sessione' : 'sessioni'}
          </T>
        </View>
      </View>
      {populated ? (
        <>
          <T variant="data" color={C.mute} style={{ marginBottom: 18 }}>
            {[t.activeDays(g.summary.activeDays), dur].filter(Boolean).join(' · ')}
          </T>
          <View style={styles.grid}>
            {months.map((m) => <YearMonth key={m.key} month={m} days={days} today={today} width={tileWidth} />)}
          </View>
        </>
      ) : null}
    </View>
  );
});

const YearMonth = memo(function YearMonth({ month, days, today, width }: {
  month: YearGroup['months'][number];
  days: Map<string, DaySummary>;
  today: LocalDate;
  width: number;
}) {
  const C = useSurface();
  const styles = useMemo(() => makeStyles(C), [C]);
  const weeks = useMemo(() => monthWeeks(month.month), [month.month]);
  const populated = !month.future && month.summary.sessions > 0;
  const dur = durationLine(month.summary.duration);
  const label = `${MONTHS_TITLE[month.month.m - 1]} ${month.month.y}: ${month.future ? 'mese futuro' : t.sessions(month.summary.sessions)}${populated ? `, ${t.activeDays(month.summary.activeDays)}${dur ? `. ${dur}` : ''}` : ''}`;
  const dotSize = Math.min(10, Math.max(6, (width - 20) / 7 - 3));

  return (
    <Pressable
      onPress={() => focusHistoryMonth(month.key)}
      disabled={!populated}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={populated ? 'Apri il mese in Storia' : undefined}
      accessibilityState={{ disabled: !populated }}
      style={[styles.tile, { width }]}
      testID={`year-month-${month.key}`}
    >
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        <View style={styles.tileHead}>
          <T variant="labelStrong" color={populated ? C.fg : C.mute} style={{ fontSize: 10, letterSpacing: 0.6 }}>
            {MONTHS_SHORT[month.month.m - 1]}
          </T>
          {month.future ? null : (
            <T variant="small" color={populated ? C.fg : C.mute} style={{ fontSize: 12, lineHeight: 15 }}>
              {month.summary.sessions}
            </T>
          )}
        </View>
        <View style={styles.monthDays}>
          {weeks.map((week, row) => (
            <View key={row} style={styles.week}>
              {week.map((date) => {
                const p = parseDate(date);
                const inMonth = p.y === month.month.y && p.m === month.month.m;
                const day = inMonth && !month.future && date <= today ? days.get(date) : undefined;
                return (
                  <View key={date} style={styles.cell}>
                    {!inMonth ? null : day?.count ? (
                      <MiniDay day={day} size={dotSize} border={C.faint} />
                    ) : (
                      <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: C.faint, opacity: month.future || date > today ? 0.45 : 1 }} />
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
});

/** Tiny native bands retain every activity hue without a canvas per day. */
const MiniDay = memo(function MiniDay({ day, size, border }: { day: DaySummary; size: number; border: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: Math.max(2, size * 0.18), borderWidth: StyleSheet.hairlineWidth, borderColor: border, flexDirection: 'row', overflow: 'hidden' }} testID={`year-day-${day.date}`}>
      {day.categories.map((activity) => <View key={activity.categoryId} style={{ flex: 1, backgroundColor: activity.color }} testID={`year-day-${day.date}-${activity.categoryId}`} />)}
    </View>
  );
});

const makeStyles = (C: Surface) => StyleSheet.create({
  year: { paddingHorizontal: space.gutter, paddingTop: 18, paddingBottom: 24, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.faint },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' },
  tile: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.faint, borderRadius: 12, paddingHorizontal: 10, paddingTop: 9, paddingBottom: 10, minHeight: 118 },
  tileHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  monthDays: { gap: 3 },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 10 },
});
