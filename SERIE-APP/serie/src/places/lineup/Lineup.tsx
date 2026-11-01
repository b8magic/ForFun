/**
 * REGISTRA — the logging surface. Opens in the remembered activity with the
 * current month ready for selection: tap dates, tap Save. Everything else is
 * optional and one step away.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, runOnUI, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useApp } from '@/state/store';
import { useActive, useCountsByDate, useMotionReduced } from '@/state/selectors';
import { clearSelection, closeSwitcher, goToday, openSwitcher, save, setPlace, setViewMonth, shiftMonth, switchActivity, toggleDate } from '@/state/actions';
import { addDays, compareMonths, monthOf, monthWeeks, parseDate, toDayNumber } from '@/domain/dates';
import { shortDate } from '@/places/time/format';
import type { LocalDate } from '@/domain/types';
import { palette, surfaces, HIT } from '@/ui/theme';
import { T } from '@/ui/T';
import { MONTHS_TITLE, WEEKDAYS_INITIAL, t } from '@/i18n/it';
import { smooth, curves } from '@/motion/grammar';
import { PATTERN_CODES } from '@/graphics/disc';
import { discMetrics } from '@/graphics/IdentityDisc';
import { haptics } from '@/platform/haptics';
import { computeLayout, rowY } from './layout';
import { useWater, triggerSwell } from './useWater';
import { WaterCanvas, type DiscTarget } from './WaterCanvas';
import { DayGrid } from './DayGrid';
import { Switcher, arcSlots } from './Switcher';
import { Chevron, MenuGlyph } from '@/ui/glyphs';

const BREAK_MS = 1700;

export function Lineup() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const active = useActive();
  const categories = useApp((s) => s.categories);
  const viewMonth = useApp((s) => s.viewMonth);
  const selectionArr = useApp((s) => s.selection);
  const today = useApp((s) => s.today);
  const saving = useApp((s) => s.saving);
  const saveError = useApp((s) => s.saveError);
  const breakEvent = useApp((s) => s.breakEvent);
  const switcherOpen = useApp((s) => s.switcherOpen);
  const pendingDetails = useApp((s) => s.pendingDetails);
  const reduced = useMotionReduced();
  const counts = useCountsByDate(active?.id ?? null);

  const weeks = useMemo(() => monthWeeks(viewMonth), [viewMonth]);
  const L = useMemo(() => computeLayout(W, H, insets.top, insets.bottom, weeks.length), [W, H, insets.top, insets.bottom, weeks.length]);
  const selection = useMemo(() => new Set(selectionArr), [selectionArr]);
  const monthKey = `${viewMonth.y}-${viewMonth.m}`;
  const place = useApp((s) => s.place);
  const w = useWater(L, weeks, selectionArr, counts, reduced, monthKey, place === 'lineup', active ? PATTERN_CODES[active.pattern] : 0);

  const inMonth = useMemo(() => {
    const a = new Array(42).fill(0);
    weeks.forEach((wk, r) =>
      wk.forEach((d, c) => {
        const p = parseDate(d);
        a[r * 7 + c] = p.m === viewMonth.m && p.y === viewMonth.y && d <= today ? 1 : 0;
      }),
    );
    return a;
  }, [weeks, viewMonth, today]);

  // ── switcher ──
  const sw = useSharedValue(0);
  useEffect(() => {
    sw.set(withTiming(switcherOpen ? 1 : 0, { duration: reduced ? 160 : 560, easing: curves.flow }));
  }, [switcherOpen, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  const slots = useMemo(() => arcSlots(categories.length, L), [categories.length, L]);
  const activeIndex = Math.max(0, categories.findIndex((c) => c.id === active?.id));
  const discTarget: DiscTarget = useMemo(() => {
    const slot = slots[activeIndex] ?? { x: L.discX, y: L.discY, r: L.discR };
    const size = slot.r * 2.9;
    const m = discMetrics(size);
    const top = slot.y - slot.r - slot.r * 0.45;
    return { x: slot.x - size / 2 + m.cx, y: top + m.cy, r: m.r };
  }, [slots, activeIndex, L]);

  // ── unfold after switching activity: the new disc pours into the lines ──
  const unfold = useSharedValue(1);
  const prevActive = useRef(active?.id);
  useEffect(() => {
    if (prevActive.current && active?.id && prevActive.current !== active.id) {
      unfold.set(0);
      unfold.set(withTiming(1, { duration: reduced ? 1 : 1000, easing: Easing.linear }));
    }
    prevActive.current = active?.id;
  }, [active?.id, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── the break ──
  const brk = useSharedValue(1);
  const breakCells = useSharedValue<number[]>([]);
  const [breaking, setBreaking] = useState(false);
  const breakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!breakEvent) return;
    const sameMonth = breakEvent.month.y === viewMonth.y && breakEvent.month.m === viewMonth.m;
    const grid = monthWeeks(breakEvent.month);
    const cells: number[] = [];
    if (sameMonth) grid.forEach((wk, r) => wk.forEach((d, c) => breakEvent.dates.includes(d) && cells.push(r * 7 + c)));
    // reduced motion: no wave and no sliding lines — the calendar simply settles with the new rings
    if (reduced) {
      breakCells.set([]);
      brk.set(1);
      return;
    }
    breakCells.set(cells);
    const dur = BREAK_MS;
    brk.set(0);
    brk.set(withTiming(1, { duration: dur, easing: Easing.linear }));
    // the flag mirrors the lifetime of the break animation started by this store event
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBreaking(true);
    setTimeout(() => haptics.breakImpact(), dur * 0.6);
    if (breakTimer.current) clearTimeout(breakTimer.current);
    breakTimer.current = setTimeout(() => setBreaking(false), dur);
  }, [breakEvent?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const skipBreak = useCallback(() => {
    brk.set(withTiming(1, { duration: 140 }));
    setBreaking(false);
  }, [brk]);
  const breakCancel = useApp((s) => s.breakCancel);
  useEffect(() => {
    // the save was undone (store event): no celebration for sessions that no longer exist
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (breakCancel) skipBreak();
  }, [breakCancel]); // eslint-disable-line react-hooks/exhaustive-deps

  const onToggle = useCallback(
    (d: LocalDate) => {
      if (breaking) skipBreak();
      return toggleDate(d);
    },
    [breaking, skipBreak],
  );

  // ── month navigation ──
  const current = monthOf(today);
  const atCurrent = compareMonths(viewMonth, current) >= 0;
  const onSwipe = useCallback(
    (dir: 1 | -1) => {
      if (dir === 1 && atCurrent) return;
      shiftMonth(dir);
      runOnUI(triggerSwell)(w, dir);
    },
    [atCurrent, w],
  );

  // history handle bumps: session days of the last 8 weeks
  const handleBumps = useMemo(() => {
    const out: number[] = [];
    const end = toDayNumber(today);
    const start = end - 55;
    counts.forEach((n, d) => {
      const k = toDayNumber(d);
      if (k >= start && k <= end) out.push((k - start) / 55, Math.min(n, 3) / 3 + 0.35);
    });
    return out;
  }, [counts, today]);

  const content = useAnimatedStyle(() => ({ opacity: 1 - smooth(Math.min(1, sw.value * 1.6)) }));
  const n = selectionArr.length;
  // selected dates outside the month in view are saved too: say so, and let them be found or cleared
  const viewKey = `${viewMonth.y}-${String(viewMonth.m).padStart(2, '0')}`;
  const offMonth = selectionArr.filter((d) => d.slice(0, 7) !== viewKey).sort();

  if (!active) return <EmptyActivities />;

  return (
    <View style={styles.root} testID="lineup">
      <WaterCanvas
        L={L}
        w={w}
        inMonth={inMonth}
        brk={brk}
        breakCells={breakCells}
        sw={sw}
        unfold={unfold}
        discTarget={discTarget}
        pattern={PATTERN_CODES[active.pattern]}
        color={active.color}
        handleBumps={handleBumps}
      />

      {/* header: the identity disc is the switching control */}
      <Pressable
        style={[styles.header, { top: L.headerY - 24, left: L.G - 8 }]}
        onPress={() => {
          if (breaking) skipBreak();
          (switcherOpen ? closeSwitcher : openSwitcher)();
        }}
        accessibilityRole="button"
        accessibilityLabel={t.activityA11y(active.name)}
        aria-expanded={switcherOpen}
        testID="activity-switcher"
        hitSlop={6}
      >
        <View style={{ width: 44 }} />
        <T variant="title" color={palette.foam} numberOfLines={1} style={{ maxWidth: W * 0.5 }}>
          {active.name}
        </T>
        <Chevron dir={switcherOpen ? 'up' : 'down'} color={palette.foam} />
      </Pressable>
      <Pressable style={[styles.menu, { top: L.headerY - 22, right: L.G - 10 }]} onPress={() => router.push('/menu')} accessibilityRole="button" accessibilityLabel={t.menu} hitSlop={6} testID="menu">
        <MenuGlyph color={palette.foam} />
      </Pressable>

      <Animated.View
        style={[StyleSheet.absoluteFill, content]}
        pointerEvents={switcherOpen ? 'none' : 'box-none'}
        accessibilityElementsHidden={switcherOpen}
        importantForAccessibility={switcherOpen ? 'no-hide-descendants' : 'auto'}
        aria-hidden={switcherOpen}
      >
        {/* month */}
        <View style={[styles.monthRow, { top: L.titleTop, left: L.G, right: L.G }]} pointerEvents="box-none">
          <Pressable onPress={() => router.push('/jump')} accessibilityRole="button" accessibilityLabel={`${MONTHS_TITLE[viewMonth.m - 1]} ${viewMonth.y}. ${t.pickMonth}`} hitSlop={6} testID="month-title">
            <T variant="monthTitle" color={palette.foam}>
              {MONTHS_TITLE[viewMonth.m - 1]}
            </T>
          </Pressable>
          <View style={styles.monthNav}>
            <Pressable onPress={() => onSwipe(-1)} accessibilityRole="button" accessibilityLabel={t.prevMonth} style={styles.navBtn} testID="prev-month">
              <Chevron dir="left" color={palette.foam} />
            </Pressable>
            <T variant="data" color={surfaces.night.mute}>
              {viewMonth.y}
            </T>
            <Pressable onPress={() => onSwipe(1)} disabled={atCurrent} accessibilityRole="button" accessibilityLabel={t.nextMonth} aria-disabled={atCurrent} style={[styles.navBtn, atCurrent && { opacity: 0.25 }]} testID="next-month">
              <Chevron dir="right" color={palette.foam} />
            </Pressable>
          </View>
        </View>
        {!atCurrent ? (
          <Pressable style={[styles.todayChip, { top: L.titleTop + 64, left: L.G }]} onPress={goToday} accessibilityRole="button" hitSlop={{ top: 8, bottom: 14, left: 12, right: 12 }}>
            <T variant="labelStrong" color={active.color} maxFontSizeMultiplier={1.2}>
              {t.goToToday}
            </T>
          </Pressable>
        ) : null}

        {/* weekdays */}
        {WEEKDAYS_INITIAL.map((d, c) => (
          <View key={c} style={[styles.weekday, { left: L.colX[c] - 16, top: L.weekdayY }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <T variant="label" color={surfaces.night.mute} align="center">
              {d}
            </T>
          </View>
        ))}

        <DayGrid
          L={L}
          w={w}
          weeks={weeks}
          month={viewMonth}
          selection={selection}
          counts={counts}
          today={today}
          brk={brk}
          sw={sw}
          unfold={unfold}
          onToggle={onToggle}
          onSwipe={onSwipe}
          disabled={saving}
        />

        {/* optional details: present, never required */}
        <Pressable style={[styles.details, { top: L.detailsY - 16, left: L.G, right: L.G }]} onPress={() => router.push('/details')} accessibilityRole="button" accessibilityLabel={n ? t.detailsForSelection(n) : pendingDetails ? t.detailsPrepared : t.detailsLink} hitSlop={6} testID="details-link">
          <T variant="label" color={pendingDetails ? active.color : surfaces.night.mute} maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ flexShrink: 1 }}>
            {pendingDetails ? `✓ ${n ? t.detailsForSelection(n) : t.detailsPrepared}` : t.detailsLink}
          </T>
          <T variant="label" color={surfaces.night.mute} maxFontSizeMultiplier={1.2}>
            {t.detailsOptional}
          </T>
        </Pressable>
        {!saveError && offMonth.length ? (
          <View style={[styles.offMonth, { top: L.detailsY - 46, left: L.G, right: L.G }]} testID="off-month">
            <Pressable onPress={() => setViewMonth(monthOf(offMonth[0]))} accessibilityRole="button" accessibilityLabel={t.offMonthA11y(offMonth.map((d) => shortDate(d)).join(', '))} hitSlop={8} style={styles.offBtn} testID="off-month-show">
              <T variant="label" color={active.color}>
                {t.offMonth(offMonth.length)}
              </T>
            </Pressable>
            <Pressable onPress={clearSelection} accessibilityRole="button" accessibilityLabel={t.clearSelection} hitSlop={8} style={styles.offBtn} testID="clear-selection">
              <T variant="label" color={surfaces.night.mute}>
                {t.clearSelection.toUpperCase()}
              </T>
            </Pressable>
          </View>
        ) : null}
        {saveError ? (
          <View style={[styles.error, { top: L.detailsY - 46, left: L.G, right: L.G }]} accessibilityLiveRegion="assertive">
            <T variant="small" color={palette.danger}>
              {saveError}
            </T>
          </View>
        ) : null}

        {/* Save */}
        <Pressable
          style={[styles.pill, { left: L.pillCX - L.pillW / 2, top: L.pillCY - L.pillH / 2, width: L.pillW, height: L.pillH, borderRadius: L.pillH / 2 }]}
          onPress={save}
          disabled={!n || saving}
          accessibilityRole="button"
          accessibilityLabel={n ? `${saving ? t.saving : saveError ? `${t.retry} · ${t.save(n)}` : t.save(n)} · ${active.name}` : t.selectDates}
          aria-disabled={!n || saving} aria-busy={saving}
          testID="save"
        >
          {n ? (
            <T variant="button" color={palette.ink} maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {saving ? t.saving : saveError ? `${t.retry} · ${t.save(n)}` : t.save(n)}
            </T>
          ) : (
            <T variant="label" color={surfaces.night.mute} maxFontSizeMultiplier={1.2}>
              {t.selectDates}
            </T>
          )}
        </Pressable>

        {/* history handle */}
        <Pressable style={[styles.handle, { top: L.handleY - 30, left: W / 2 - 80, width: 160 }]} onPress={() => setPlace('time')} accessibilityRole="button" accessibilityLabel={t.history} hitSlop={4} testID="history-handle">
          <T variant="label" color={surfaces.night.mute} style={{ marginTop: 22 }}>
            {t.placeTime}
          </T>
        </Pressable>
      </Animated.View>

      <Switcher L={L} categories={categories} activeId={active.id} open={switcherOpen} sw={sw} onPick={switchActivity} onClose={closeSwitcher} />

      {/* the break never blocks: every control stays live and a tap on a date fast-forwards it */}
    </View>
  );
}

function EmptyActivities() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 120, paddingHorizontal: 22 }]}>
      <View style={{ height: 2, backgroundColor: palette.foam, opacity: 0.8, marginBottom: 32 }} />
      <T variant="heading" color={palette.foam}>
        {t.noActivities}
      </T>
      <T variant="body" color={surfaces.night.mute} style={{ marginTop: 10, maxWidth: 320 }}>
        {t.noActivitiesBody}
      </T>
      <Pressable style={[styles.pill, { position: 'relative', marginTop: 32, height: 56, borderRadius: 28, backgroundColor: palette.flare }]} onPress={() => router.push('/activities')} accessibilityRole="button">
        <T variant="button" color={palette.ink}>
          {t.createActivity}
        </T>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.ink },
  header: { position: 'absolute', height: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10 },
  menu: { position: 'absolute', width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  monthRow: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 10 },
  navBtn: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  todayChip: { position: 'absolute', paddingVertical: 4 },
  weekday: { position: 'absolute', width: 32 },
  details: { position: 'absolute', height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  error: { position: 'absolute' },
  offMonth: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  offBtn: { minHeight: HIT, justifyContent: 'center' },
  pill: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  handle: { position: 'absolute', height: 44, alignItems: 'center' },
});

export { rowY, addDays };
