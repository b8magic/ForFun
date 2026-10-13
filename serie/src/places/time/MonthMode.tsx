/** The monthly archive shows recorded months, expanded on first consultation. */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { useApp } from '@/state/store';
import { useMotionReduced } from '@/state/selectors';
import type { Category, LocalDate } from '@/domain/types';
import type { DaySummary } from '@/domain/daySummaries';
import { monthIndex, type MonthGroup } from '@/domain/history';
import { space, type Surface } from '@/ui/theme';
import { useSurface } from '@/ui/useTheme';
import { MonthCalendar } from '@/ui/calendar/MonthCalendar';
import { T } from '@/ui/T';
import { Chevron } from '@/ui/glyphs';
import { t } from '@/i18n/it';
import { compareSessions } from '@/sheets/day/sessionOrder';
import { Ridgeline } from './Ridgeline';
import { InlineDayDetails } from './InlineDayDetails';
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
  const viewport = useRef<View>(null);
  const scrollY = useRef(0);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealRequest = useRef(0);
  const categories = useApp((s) => s.categories);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const reduced = useMotionReduced();
  const { height: windowHeight } = useWindowDimensions();
  const [selection, setSelection] = useState<{ date: LocalDate; filterId: string | null; focus: Props['focus'] } | null>(null);
  const headerH = useRef(0);
  const pendingKey = useRef<string | null>(null);
  const pendingFocus = useRef<typeof focus>(null);
  const visibleKeys = useRef(new Set<string>());
  const retryCount = useRef(0);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorded = useMemo(() => groups.filter((g) => g.summary.sessions > 0), [groups]);
  const selectedDate = selection && selection.filterId === filterId && selection.focus === focus
    && openMonths[selection.date.slice(0, 7)] !== false
    && recorded.some((g) => g.key === selection.date.slice(0, 7)) ? selection.date : null;
  // Discard stale selection in the same render as a filter, jump or month
  // removal; returning to an old scope must not resurrect its open day.
  if (selection && !selectedDate) setSelection(null);
  const cancelReveal = useCallback(() => {
    revealRequest.current++;
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = null;
  }, []);
  const closeDay = useCallback(() => {
    cancelReveal();
    setSelection(null);
  }, [cancelReveal]);
  const selectDay = useCallback((date: LocalDate) => {
    Keyboard.dismiss();
    cancelReveal();
    setSelection((current) => current?.date === date && current.filterId === filterId ? null : { date, filterId, focus });
  }, [filterId, focus, cancelReveal]);
  const toggleMonth = useCallback((key: string) => {
    if (selectedDate?.startsWith(key)) closeDay();
    onToggle(key);
  }, [selectedDate, closeDay, onToggle]);

  useEffect(() => cancelReveal, [cancelReveal, selectedDate]);

  const revealDetails = useCallback((start: View, end: View = start) => {
    cancelReveal();
    const request = revealRequest.current;
    // Wait for the expanded month to settle before measuring native coordinates.
    revealTimer.current = setTimeout(() => {
      revealTimer.current = null;
      if (request !== revealRequest.current) return;
      viewport.current?.measureInWindow((_x, top, _width, height) => {
        if (request !== revealRequest.current || !height) return;
        start.measureInWindow((_sx, startY, _sw, startHeight) => {
          if (request !== revealRequest.current || !startHeight) return;
          end.measureInWindow((_ex, endY, _ew, endHeight) => {
            if (request !== revealRequest.current || !endHeight) return;
            const visibleTop = top + 12;
            const visibleBottom = Math.min(top + height, windowHeight) - 20;
            const bottom = endY + endHeight;
            // The first row is measured in full, including wrapped timing and
            // notes; later sessions never push the selected date offscreen.
            const below = Math.max(0, bottom - visibleBottom);
            const fits = bottom - startY <= visibleBottom - visibleTop;
            const delta = below || (fits ? Math.min(0, startY - visibleTop) : 0);
            if (Math.abs(delta) > 1) list.current?.scrollToOffset({ offset: Math.max(0, scrollY.current + delta), animated: !reduced });
          });
        });
      });
    }, reduced ? 0 : 280);
  }, [cancelReveal, windowHeight, reduced]);

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
    <View ref={viewport} collapsable={false} style={{ flex: 1 }}>
      <FlatList
        ref={list}
        data={recorded}
        extraData={{ openMonths, selectedDate }}
        keyExtractor={(g) => g.key}
        ListHeaderComponent={<View onLayout={(e) => (headerH.current = e.nativeEvent.layout.height)}>{header}</View>}
        renderItem={({ item }) => (
          <MonthRow g={item} days={days} today={today} filterId={filterId} catById={catById} selectedDate={selectedDate?.startsWith(item.key) ? selectedDate : null} onSelectDay={selectDay} onCloseDay={closeDay} onRevealDetails={revealDetails} open={openMonths[item.key] !== false} onToggle={toggleMonth} accent={accent} highlight={highlight?.key === item.key ? highlight : undefined} />
        )}
        initialNumToRender={4}
        windowSize={7}
        onScrollToIndexFailed={onScrollToIndexFailed}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY}
        onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        onScrollBeginDrag={cancelReveal}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 90 }}
        testID="month-list"
      />
    </View>
  );
}

const MonthRow = memo(function MonthRow({ g, days, today, filterId, catById, selectedDate, onSelectDay, onCloseDay, onRevealDetails, open, onToggle, accent, highlight }: {
  g: MonthGroup;
  days: Map<string, DaySummary>;
  today: LocalDate;
  filterId: string | null;
  catById: ReadonlyMap<string, Category>;
  selectedDate: LocalDate | null;
  onSelectDay: (date: LocalDate) => void;
  onCloseDay: () => void;
  onRevealDetails: (start: View, end?: View) => void;
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
  const selection = useMemo(() => new Set(selectedDate ? [selectedDate] : []), [selectedDate]);
  const daySessions = useMemo(() => selectedDate ? g.sessions.filter((s) => s.date === selectedDate).sort(compareSessions) : [], [g.sessions, selectedDate]);

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
          <MonthCalendar month={g.month} days={days} activeId={filterId} today={today} selection={selection} selectionLabel="selezionato, dettagli aperti" showAll preventFuture={false} onPressDay={onSelectDay} dayTestPrefix="mini-" testID={`history-calendar-${g.key}`} />
          {selectedDate ? <InlineDayDetails key={`${filterId ?? 'all'}:${selectedDate}`} date={selectedDate} sessions={daySessions} catById={catById} filterId={filterId} onClose={onCloseDay} onReveal={onRevealDetails} /> : null}
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
