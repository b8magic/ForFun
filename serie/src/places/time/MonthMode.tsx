/**
 * Mese — continuous vertical scroller of months (newest first). Each month:
 * exact session count, active days, recorded hours with completeness, a
 * ridgeline, and an expandable mini calendar whose marked days reveal their
 * sessions. Empty months are shown, never skipped.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { useMotionReduced } from '@/state/selectors';
import { router } from 'expo-router';
import type { Category, LocalDate, Session } from '@/domain/types';
import type { MonthGroup } from '@/domain/history';
import { monthIndex } from '@/domain/history';
import { summarize } from '@/domain/stats';
import { formatDate, monthWeeks, parseDate } from '@/domain/dates';
import { surfaces, palette, HIT, space } from '@/ui/theme';
import { T } from '@/ui/T';
import { Chevron } from '@/ui/glyphs';
import { WEEKDAYS_INITIAL, t } from '@/i18n/it';
import { Ridgeline } from './Ridgeline';
import { countsLine, dateLabel, durationLine, monthTitle, timingSummary } from './format';

const C = surfaces.calm;
/** A jump request is handled once, even if Mese is mounted again later (re-entry, Anno → Mese). */
let lastHandledNonce = 0;
/** Height of a collapsed month row before it has been measured (title, ridgeline, two meta lines). */
const ROW_ESTIMATE = 152;

interface Props {
  groups: MonthGroup[];
  categories: Category[];
  /** color per category id (for "all activities") */
  accent: string;
  focus: { key: string; nonce: number } | null;
  highlight: { key: string; days: number[] } | null;
  header: React.ReactElement;
  showActivity: boolean;
}

export function MonthMode({ groups, categories, accent, focus, highlight, header, showActivity }: Props) {
  const list = useRef<FlatList<MonthGroup>>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = useCallback((key: string) => setOpen((o) => ({ ...o, [key]: !o[key] })), []);

  // Measured row heights → exact offsets, so a jump to any month scrolls straight there
  // (without getItemLayout, scrollToIndex fails for unrendered rows and crawls month by month).
  const heights = useRef(new Map<string, number>());
  const headerH = useRef(0);
  const onRowLayout = useCallback((key: string, h: number) => heights.current.set(key, h), []);
  const getItemLayout = useCallback((data: ArrayLike<MonthGroup> | null | undefined, index: number) => {
    let offset = headerH.current;
    for (let k = 0; k < index; k++) offset += heights.current.get(data![k].key) ?? ROW_ESTIMATE;
    const length = data && data[index] ? (heights.current.get(data[index].key) ?? ROW_ESTIMATE) : ROW_ESTIMATE;
    return { length, offset, index };
  }, []);

  useEffect(() => {
    if (!focus || focus.nonce === lastHandledNonce) return;
    const i = monthIndex(groups, { y: +focus.key.slice(0, 4), m: +focus.key.slice(5, 7) });
    if (i >= 0) {
      lastHandledNonce = focus.nonce;
      // a navigation request (Vai a… / year drill-down) opens that month and scrolls to it
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen((o) => ({ ...o, [focus.key]: true }));
      setTimeout(() => list.current?.scrollToIndex({ index: i, animated: true, viewOffset: 8 }), 60);
    }
  }, [focus?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  return (
    <FlatList
      ref={list}
      data={groups}
      keyExtractor={(g) => g.key}
      ListHeaderComponent={<View onLayout={(e) => (headerH.current = e.nativeEvent.layout.height)}>{header}</View>}
      renderItem={({ item }) => (
        <MonthRow g={item} open={!!open[item.key]} onToggle={toggle} onLayoutHeight={onRowLayout} accent={accent} highlight={highlight?.key === item.key ? highlight.days : undefined} catById={catById} showActivity={showActivity} />
      )}
      getItemLayout={getItemLayout}
      initialNumToRender={6}
      windowSize={9}
      onScrollToIndexFailed={(e) => list.current?.scrollToOffset({ offset: getItemLayout(groups, e.index).offset, animated: false })}
      contentContainerStyle={{ paddingBottom: 80 }}
      testID="month-list"
    />
  );
}

const MonthRow = memo(function MonthRow({ g, open, onToggle, onLayoutHeight, accent, highlight, catById, showActivity }: { g: MonthGroup; open: boolean; onToggle: (k: string) => void; onLayoutHeight: (k: string, h: number) => void; accent: string; highlight?: number[]; catById: Map<string, Category>; showActivity: boolean }) {
  const { width } = useWindowDimensions();
  const reduced = useMotionReduced();
  const [day, setDay] = useState<LocalDate | null>(null);
  // the chosen day lost its last session (deleted or moved): close its panel
  if (day && !g.sessions.some((s) => s.date === day)) setDay(null);
  const empty = g.summary.sessions === 0;
  const dur = durationLine(g.summary.duration);
  return (
    <Animated.View layout={reduced ? undefined : LinearTransition.duration(260).reduceMotion(ReduceMotion.Never)} style={styles.month} onLayout={(e) => onLayoutHeight(g.key, e.nativeEvent.layout.height)}>
      <Pressable
        onPress={() => onToggle(g.key)}
        accessibilityRole="button"
        accessibilityLabel={`${monthTitle(g.month.y, g.month.m)}: ${countsLine(g.summary)}${dur ? `. ${dur}` : ''}. ${t.monthCalendarToggle(open)}`}
        aria-expanded={open}
        testID={`month-${g.key}`}
      >
        <View style={styles.monthHead}>
          <T variant="heading" color={empty ? C.mute : C.fg}>
            {monthTitle(g.month.y, g.month.m)}
          </T>
          <View style={styles.count}>
            <T variant="heading" color={empty ? C.mute : C.fg} style={{ fontVariant: ['tabular-nums'] }}>
              {g.summary.sessions}
            </T>
            <T variant="label" color={C.mute}>
              {g.summary.sessions === 1 ? 'sessione' : 'sessioni'}
            </T>
          </View>
        </View>
        <Ridgeline width={width - 2 * space.gutter} height={44} perDay={g.perDay} color={accent} ink={empty ? C.faint : C.line} highlight={highlight} />
        <View style={styles.monthMeta}>
          <View style={{ flex: 1, gap: 2 }}>
            {!empty ? (
              <T variant="data" color={C.mute}>
                {t.activeDays(g.summary.activeDays)}
              </T>
            ) : null}
            <T variant="data" color={C.mute}>
              {empty ? t.emptyMonth : dur}
            </T>
          </View>
          <Chevron dir={open ? 'up' : 'down'} color={C.mute} size={7} />
        </View>
      </Pressable>
      {open ? (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(200).reduceMotion(ReduceMotion.Never)}>
          <MiniCalendar g={g} accent={accent} selected={day} onSelect={(d) => setDay(d === day ? null : d)} />
          {day ? <DaySessions date={day} sessions={g.sessions.filter((s) => s.date === day)} catById={catById} showActivity={showActivity} /> : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
});

function MiniCalendar({ g, accent, selected, onSelect }: { g: MonthGroup; accent: string; selected: LocalDate | null; onSelect: (d: LocalDate) => void }) {
  const weeks = monthWeeks(g.month);
  return (
    <View style={styles.mini} accessibilityLabel={`Calendario di ${monthTitle(g.month.y, g.month.m)}`}>
      <View style={styles.miniRow}>
        {WEEKDAYS_INITIAL.map((d, i) => (
          <View key={i} style={styles.miniCell}>
            <T variant="label" color={C.mute}>
              {d}
            </T>
          </View>
        ))}
      </View>
      {weeks.map((wk, r) => (
        <View key={r} style={styles.miniRow}>
          {wk.map((d) => {
            const p = parseDate(d);
            const inMonth = p.m === g.month.m && p.y === g.month.y;
            const n = inMonth ? g.perDay[p.d] : 0;
            const sel = selected === d;
            if (!inMonth) return <View key={d} style={styles.miniCell} />;
            return (
              <Pressable
                key={d}
                style={styles.miniCell}
                disabled={!n}
                onPress={() => onSelect(d)}
                accessibilityRole="button"
                accessibilityLabel={`${dateLabel(d)}${n ? `: ${t.sessions(n)}` : ''}`}
                aria-selected={sel} aria-disabled={!n}
                testID={`mini-${d}`}
              >
                <T variant={n ? 'dataStrong' : 'data'} color={n ? C.fg : C.mute} style={sel ? { textDecorationLine: 'underline' } : undefined}>
                  {p.d}
                </T>
                <View style={styles.marks}>
                  {Array.from({ length: Math.min(n, 3) }).map((_, k) => (
                    <View key={k} style={[styles.mark, { backgroundColor: accent }]} />
                  ))}
                  {n > 3 ? (
                    <T variant="label" color={C.mute} style={{ fontSize: 11, lineHeight: 12 }}>
                      +{n - 3}
                    </T>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function DaySessions({ date, sessions, catById, showActivity }: { date: LocalDate; sessions: Session[]; catById: Map<string, Category>; showActivity: boolean }) {
  const dayDur = durationLine(summarize(sessions).duration);
  return (
    <View style={styles.day}>
      <T variant="label" color={C.mute}>
        {t.sessionsOnDay(dateLabel(date))}
      </T>
      <T variant="data" color={C.fg} testID="day-total">
        {[t.sessions(sessions.length), dayDur].filter(Boolean).join(' · ')}
      </T>
      {sessions.map((s, i) => {
        const c = catById.get(s.categoryId);
        const detail = [timingSummary(s), s.place?.label ?? s.place?.address ?? null, s.notes ? `“${s.notes.slice(0, 60)}${s.notes.length > 60 ? '…' : ''}”` : null].filter(Boolean).join('\n');
        return (
          <Pressable key={s.id} onPress={() => router.push(`/session/${s.id}`)} accessibilityRole="button" accessibilityLabel={`${showActivity && c ? c.name + ', ' : ''}sessione ${i + 1}: ${detail.replace(/\n/g, ', ')}. Apri dettagli`} style={styles.dayRow} testID={`session-${s.id}`}>
            <View style={[styles.dayDot, { backgroundColor: c?.color ?? palette.flareDeep }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="bodyStrong" color={C.fg}>
                {showActivity && c ? c.name : `Sessione ${i + 1}`}
              </T>
              <T variant="small" color={C.mute}>
                {detail}
              </T>
            </View>
            <Chevron dir="right" color={C.mute} size={7} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  month: { paddingHorizontal: space.gutter, paddingTop: 22, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.faint },
  monthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 },
  count: { alignItems: 'flex-end' },
  monthMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  mini: { marginTop: 14, gap: 2 },
  miniRow: { flexDirection: 'row' },
  miniCell: { flex: 1, minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
  marks: { flexDirection: 'row', gap: 2, height: 6, alignItems: 'center', marginTop: 2 },
  mark: { width: 4, height: 4, borderRadius: 2 },
  day: { marginTop: 12, gap: 4 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.faint },
  dayDot: { width: 8, height: 8, borderRadius: 4 },
});

export { formatDate };
