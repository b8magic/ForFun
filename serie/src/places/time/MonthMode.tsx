/** The monthly archive shows recorded months, expanded on first consultation. */
import { memo, useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useMotionReduced } from '@/state/selectors';
import type { LocalDate } from '@/domain/types';
import type { DaySummary } from '@/domain/daySummaries';
import { monthIndex, type MonthGroup } from '@/domain/history';
import { space, type Surface } from '@/ui/theme';
import { useSurface } from '@/ui/useTheme';
import { MonthCalendar } from '@/ui/calendar/MonthCalendar';
import { T } from '@/ui/T';
import { Chevron } from '@/ui/glyphs';
import { t } from '@/i18n/it';
import { Ridgeline } from './Ridgeline';
import { countsLine, durationLine, monthTitle } from './format';

const ROW_ESTIMATE = 460;
const VIEWABILITY = { itemVisiblePercentThreshold: 50 };

interface Props {
  groups: MonthGroup[];
  days: Map<string, DaySummary>;
  today: LocalDate;
  filterId: string | null;
  accent: string;
  focus: { key: string; nonce: number } | null;
  /** Shared across scales during this consultation, consumed after visibility. */
  handledFocusRef: RefObject<{ key: string; nonce: number } | null>;
  highlight: { key: string; days: number[]; color: string } | null;
  header: React.ReactElement;
  /** This state belongs to TimeBody so changing scale does not reset it. */
  openMonths: Readonly<Record<string, boolean>>;
  onToggle: (key: string) => void;
  onExpand: (key: string) => void;
}

export function MonthMode({ groups, days, today, filterId, accent, focus, handledFocusRef, highlight, header, openMonths, onToggle, onExpand }: Props) {
  const list = useRef<FlatList<MonthGroup>>(null);
  const headerH = useRef(0);
  const pendingKey = useRef<string | null>(null);
  const pendingFocus = useRef<typeof focus>(null);
  const visibleKeys = useRef(new Set<string>());
  const retryCount = useRef(0);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorded = useMemo(() => groups.filter((g) => g.summary.sessions > 0), [groups]);
  const scrollToTarget = useCallback(() => {
    const index = recorded.findIndex((g) => g.key === pendingKey.current);
    if (index < 0) {
      pendingKey.current = null;
      return;
    }
    list.current?.scrollToIndex({ index, animated: true, viewOffset: 8 });
  }, [recorded]);

  useEffect(() => {
    if (!focus || focus === handledFocusRef.current) return;
    const i = monthIndex(recorded, { y: +focus.key.slice(0, 4), m: +focus.key.slice(5, 7) });
    if (i < 0) return;
    onExpand(focus.key);
    pendingKey.current = focus.key;
    pendingFocus.current = focus;
    if (visibleKeys.current.has(focus.key)) handledFocusRef.current = focus;
    retryCount.current = 0;
    if (retry.current) clearTimeout(retry.current);
    retry.current = setTimeout(scrollToTarget, 80);
  }, [focus, handledFocusRef, recorded, onExpand, scrollToTarget]);

  useEffect(() => () => {
    if (retry.current) clearTimeout(retry.current);
    pendingKey.current = null;
    pendingFocus.current = null;
  }, [recorded]);

  // Native FlatList first measures the destination window, then aligns the
  // actual row. Estimates are only for that first pass, never a final offset.
  const onScrollToIndexFailed = useCallback((e: { index: number; averageItemLength: number }) => {
    if (recorded[e.index]?.key !== pendingKey.current || retryCount.current >= 10) return;
    retryCount.current++;
    list.current?.scrollToOffset({ offset: headerH.current + (e.averageItemLength || ROW_ESTIMATE) * e.index, animated: false });
    if (retry.current) clearTimeout(retry.current);
    retry.current = setTimeout(scrollToTarget, 120);
  }, [recorded, scrollToTarget]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: { key: string; isViewable: boolean }[] }) => {
    visibleKeys.current = new Set(viewableItems.filter((item) => item.isViewable).map((item) => item.key));
    if (pendingKey.current && visibleKeys.current.has(pendingKey.current)) {
      handledFocusRef.current = pendingFocus.current;
      pendingKey.current = null;
      pendingFocus.current = null;
    }
  }, [handledFocusRef]);

  return (
    <FlatList
      ref={list}
      data={recorded}
      extraData={openMonths}
      keyExtractor={(g) => g.key}
      ListHeaderComponent={<View onLayout={(e) => (headerH.current = e.nativeEvent.layout.height)}>{header}</View>}
      renderItem={({ item }) => (
        <MonthRow g={item} days={days} today={today} filterId={filterId} open={openMonths[item.key] !== false} onToggle={onToggle} accent={accent} highlight={highlight?.key === item.key ? highlight : undefined} />
      )}
      initialNumToRender={4}
      windowSize={7}
      onScrollToIndexFailed={onScrollToIndexFailed}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={VIEWABILITY}
      contentContainerStyle={{ paddingBottom: 90 }}
      testID="month-list"
    />
  );
}

const MonthRow = memo(function MonthRow({ g, days, today, filterId, open, onToggle, accent, highlight }: {
  g: MonthGroup;
  days: Map<string, DaySummary>;
  today: LocalDate;
  filterId: string | null;
  open: boolean;
  onToggle: (key: string) => void;
  accent: string;
  highlight?: { days: number[]; color: string };
}) {
  const C = useSurface();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { width } = useWindowDimensions();
  const reduced = useMotionReduced();
  const dur = durationLine(g.summary.duration);
  const openDay = useCallback((date: LocalDate) => {
    router.push(`/day?date=${date}`);
  }, []);

  return (
    <Animated.View layout={reduced ? undefined : LinearTransition.duration(260).reduceMotion(ReduceMotion.Never)} style={styles.month}>
      <Pressable
        onPress={() => onToggle(g.key)}
        accessibilityRole="button"
        accessibilityLabel={`${monthTitle(g.month.y, g.month.m)}: ${countsLine(g.summary)}${dur ? `. ${dur}` : ''}. ${t.monthCalendarToggle(open)}`}
        aria-expanded={open}
        testID={`month-${g.key}`}
      >
        <View style={styles.monthHead}>
          <T variant="heading" color={C.fg}>
            {monthTitle(g.month.y, g.month.m)}
          </T>
          <View style={styles.count}>
            <T variant="heading" color={C.fg} style={{ fontVariant: ['tabular-nums'] }}>
              {g.summary.sessions}
            </T>
            <T variant="label" color={C.mute}>
              {g.summary.sessions === 1 ? 'sessione' : 'sessioni'}
            </T>
          </View>
        </View>
        <Ridgeline width={width - 2 * space.gutter} height={44} perDay={g.perDay} color={highlight?.color ?? accent} ink={C.line} highlight={highlight?.days} />
        <View style={styles.monthMeta}>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="data" color={C.mute}>
              {t.activeDays(g.summary.activeDays)}
            </T>
            {dur ? <T variant="data" color={C.mute}>{dur}</T> : null}
          </View>
          <Chevron dir={open ? 'up' : 'down'} color={C.mute} size={7} />
        </View>
      </Pressable>
      {open ? (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(200).reduceMotion(ReduceMotion.Never)} style={styles.calendar}>
          <MonthCalendar month={g.month} days={days} activeId={filterId} today={today} showAll preventFuture={false} onPressDay={openDay} dayTestPrefix="mini-" testID={`history-calendar-${g.key}`} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
});

const makeStyles = (C: Surface) => StyleSheet.create({
  month: { paddingHorizontal: space.gutter, paddingTop: 22, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.faint },
  monthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 },
  count: { alignItems: 'flex-end' },
  monthMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  calendar: { marginTop: 16 },
});

export { formatDate } from '@/domain/dates';
