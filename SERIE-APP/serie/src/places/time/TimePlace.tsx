/**
 * STORIA — history at three scales (Mese, Anno, Tutto) on the calm surface.
 * Entering is the white-water transformation: bone floods up from the
 * history handle, the lines of the lineup give way to the month ridgelines.
 */
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { Canvas, Circle } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { useApp, type TimeScale } from '@/state/store';
import { useActive, useMotionReduced } from '@/state/selectors';
import { setPlace, setTimeScale } from '@/state/actions';
import { historyStart, monthGroups, yearGroups } from '@/domain/history';
import { summarize } from '@/domain/stats';
import { compareMonths, monthOf, parseDate } from '@/domain/dates';
import { palette, surfaces, space, HIT } from '@/ui/theme';
import { T } from '@/ui/T';
import { Segmented } from '@/ui/controls';
import { Chevron } from '@/ui/glyphs';
import { IdentityDisc } from '@/graphics/IdentityDisc';
import { t } from '@/i18n/it';
import { curves } from '@/motion/grammar';
import { MonthMode } from './MonthMode';
import { YearMode } from './YearMode';
import { AllMode } from './AllMode';
import { durationLine } from './format';

const C = surfaces.calm;

export function TimePlace({ visible }: { visible: boolean }) {
  const [mounted, setMounted] = useState(visible);
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();
  const enter = useSharedValue(0);

  // mounted as soon as it becomes visible (adjusted during render); unmounted after the white water recedes
  if (visible && !mounted) setMounted(true);
  useEffect(() => {
    if (visible) {
      enter.set(withTiming(1, { duration: reduced ? 180 : 760, easing: curves.flow }));
    } else if (mounted) {
      enter.set(
        withTiming(0, { duration: reduced ? 160 : 520, easing: Easing.bezier(0.55, 0, 1, 0.45) }, (done) => {
          if (done) runOnJS(setMounted)(false);
        }),
      );
    }
  }, [visible, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  const cx = W / 2;
  const cy = H - Math.max(insets.bottom, 10) - 26;
  const maxR = Math.hypot(W, H) * 1.05;
  const radius = useDerivedValue(() => Math.pow(enter.value, 1.4) * maxR);
  const content = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, (enter.value - 0.35) / 0.5)),
    transform: [{ translateY: (1 - enter.value) * 70 }],
  }));

  // back: Android hardware button, and a swipe from the left edge
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setPlace('lineup');
      return true;
    });
    return () => sub.remove();
  }, [visible]);
  const edge = Gesture.Pan()
    .hitSlop({ left: 0, width: 24 })
    .activeOffsetX(20)
    .failOffsetY([-20, 20])
    .onEnd((e) => {
      'worklet';
      if (e.translationX > 70 || e.velocityX > 600) runOnJS(setPlace)('lineup');
    });

  if (!mounted) return null;
  return (
    <GestureDetector gesture={edge}>
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'} testID="time-place">
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={cx} cy={cy} r={radius} color={palette.bone} />
      </Canvas>
      <Animated.View style={[StyleSheet.absoluteFill, { paddingTop: insets.top }, content]}>
        <TimeBody />
      </Animated.View>
    </View>
    </GestureDetector>
  );
}

function TimeBody() {
  const active = useActive();
  const categories = useApp((s) => s.categories);
  const sessions = useApp((s) => s.sessions);
  const scale = useApp((s) => s.timeScale);
  const today = useApp((s) => s.today);
  const focus = useApp((s) => s.historyFocus);
  const lastSave = useApp((s) => s.lastSave);
  const highlightSaveId = useApp((s) => s.highlightSaveId);
  const [filterId, setFilterId] = useState<string | null>(active?.id ?? null);
  // the filter follows the active activity when it changes (adjusted during render)
  const [filterFor, setFilterFor] = useState(active?.id ?? null);
  if ((active?.id ?? null) !== filterFor) {
    setFilterFor(active?.id ?? null);
    if (active?.id) setFilterId(active.id);
  }

  const filtered = useMemo(() => (filterId ? sessions.filter((s) => s.categoryId === filterId) : sessions), [sessions, filterId]);
  const cat = categories.find((c) => c.id === filterId) ?? null;
  const accent = cat?.color ?? palette.flareDeep;
  const total = useMemo(() => summarize(filtered), [filtered]);
  // a jump to a month before the first session still lands on that (empty) month
  const start = useMemo(() => {
    const first = historyStart(filtered, today);
    if (!focus) return first;
    const f = { y: +focus.key.slice(0, 4), m: +focus.key.slice(5, 7) };
    return compareMonths(f, first) < 0 && compareMonths(f, monthOf(today)) <= 0 ? f : first;
  }, [filtered, today, focus]);
  const months = useMemo(() => (scale === 'month' ? monthGroups(filtered, today, start) : []), [filtered, today, scale, start]);
  const years = useMemo(() => (scale === 'year' ? yearGroups(filtered, today) : []), [filtered, today, scale]);

  // dates saved moments ago rise again in history, in the activity colour
  const highlight = useMemo(() => {
    if (!lastSave || highlightSaveId !== lastSave.requestId) return null;
    if (filterId && lastSave.categoryId !== filterId) return null;
    const saved = sessions.filter((s) => lastSave.ids.includes(s.id));
    if (!saved.length) return null;
    const key = saved[0].date.slice(0, 7);
    return { key, days: saved.filter((s) => s.date.startsWith(key)).map((s) => parseDate(s.date).d) };
  }, [lastSave, highlightSaveId, sessions, filterId]);

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Pressable onPress={() => setPlace('lineup')} accessibilityRole="button" accessibilityLabel={t.backToLog} style={styles.back} hitSlop={8} testID="back-to-log">
          <Chevron dir="left" color={C.fg} size={7} />
          <T variant="labelStrong" color={C.fg}>
            {t.placeLog}
          </T>
        </Pressable>
        <Pressable onPress={() => router.push(`/jump?target=history&cat=${filterId ?? 'all'}`)} accessibilityRole="button" style={styles.back} hitSlop={8} testID="jump-history">
          <T variant="labelStrong" color={C.fg}>
            {t.jumpTo}
          </T>
        </Pressable>
      </View>

      <T variant="monthTitle" color={C.fg} accessibilityRole="header">
        {t.history}
      </T>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="tablist">
        <FilterChip label={t.allActivities} on={filterId === null} onPress={() => setFilterId(null)} />
        {categories.map((c) => (
          <FilterChip key={c.id} label={c.name} on={filterId === c.id} onPress={() => setFilterId(c.id)} disc={<IdentityDisc size={26} pattern={c.pattern} color={c.color} stripe={C.fg} animated={false} />} />
        ))}
      </ScrollView>

      <Segmented<TimeScale>
        value={scale}
        onChange={setTimeScale}
        accent={accent}
        tone="calm"
        options={[
          { key: 'month', label: t.modeMonth },
          { key: 'year', label: t.modeYear },
          { key: 'all', label: t.modeAll },
        ]}
        testID="scale"
      />
      <View style={{ gap: 2, marginTop: 4 }} accessible accessibilityLabel={`${cat ? t.totalForActivity(cat.name) : t.allActivities}: ${t.sessions(total.sessions)}, ${t.activeDays(total.activeDays)}. ${durationLine(total.duration) || t.noDurations}`}>
        <T variant="label" color={C.mute}>
          {cat ? t.totalForActivity(cat.name) : t.allActivities}
        </T>
        <T variant="data" color={C.fg}>
          {t.sessions(total.sessions)}
          {total.sessions ? ` · ${t.activeDays(total.activeDays)}` : ''}
        </T>
        {total.sessions ? (
          <T variant="data" color={C.mute}>
            {durationLine(total.duration)}
          </T>
        ) : null}
      </View>
    </View>
  );

  if (!total.sessions) {
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {header}
        <EmptyHistory />
      </ScrollView>
    );
  }
  if (scale === 'year') return <YearMode groups={years} header={header} accent={accent} />;
  if (scale === 'all') return <AllMode sessions={filtered} allSessions={sessions} categories={categories} filterId={filterId} today={today} accent={accent} header={header} />;
  return <MonthMode groups={months} categories={categories} accent={accent} focus={focus} highlight={highlight} header={header} showActivity={!filterId} />;
}

function FilterChip({ label, on, onPress, disc }: { label: string; on: boolean; onPress: () => void; disc?: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" aria-selected={on} style={[styles.chip, on && styles.chipOn]} testID={`filter-${label}`}>
      {disc}
      <T variant={on ? 'labelStrong' : 'label'} color={on ? C.fg : C.mute}>
        {label}
      </T>
    </Pressable>
  );
}

function EmptyHistory() {
  const { width } = useWindowDimensions();
  return (
    <View style={{ paddingHorizontal: space.gutter, paddingTop: 40, gap: 14 }}>
      <View style={{ height: 1.6, width: width - 2 * space.gutter, backgroundColor: C.line, opacity: 0.8 }} />
      <T variant="heading" color={C.fg} style={{ marginTop: 18 }}>
        {t.emptyHistoryTitle}
      </T>
      <T variant="body" color={C.mute} style={{ maxWidth: 330 }}>
        {t.emptyHistoryBody}
      </T>
      <Pressable onPress={() => setPlace('lineup')} accessibilityRole="button" style={[styles.back, { marginTop: 10 }]}>
        <Chevron dir="left" color={C.fg} size={7} />
        <T variant="labelStrong" color={C.fg}>
          {t.backToLog}
        </T>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.gutter, paddingTop: 8, paddingBottom: 6, gap: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: HIT, paddingRight: 8 },
  filters: { gap: 8, paddingRight: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: HIT, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: C.faint },
  chipOn: { borderColor: C.fg },
});
