/** Vertical logging calendar. The activity selects the destination, never the history. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { useApp } from '@/state/store';
import { useActive, useMotionReduced } from '@/state/selectors';
import { clearSelection, goToday, save, setPlace, setViewMonth, toggleDate } from '@/state/actions';
import { EARLIEST_DATE, addDays, compareMonths, monthKey, monthOf, monthRange, type MonthRef } from '@/domain/dates';
import { buildDaySummaries } from '@/domain/daySummaries';
import { MONTHS_TITLE, t } from '@/i18n/it';
import { useSurface } from '@/ui/useTheme';
import { T } from '@/ui/T';
import { ToastContent } from '@/ui/Toast';
import { Button } from '@/ui/controls';
import { fonts } from '@/ui/theme';
import { Chevron, MenuGlyph } from '@/ui/glyphs';
import { MonthCalendar, calendarHeight } from '@/ui/calendar/MonthCalendar';
import { ActivityDock } from './ActivityDock';
import { SaveCapsule } from './SaveCapsule';

const openDay = (date: string) => router.push({ pathname: '/day', params: { date } });
const VIEWABILITY = { itemVisiblePercentThreshold: 30 };

export function Lineup() {
  const surface = useSurface();
  const pathname = usePathname();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const active = useActive();
  const categories = useApp((state) => state.categories);
  const sessions = useApp((state) => state.sessions);
  const selectionArr = useApp((state) => state.selection);
  const today = useApp((state) => state.today);
  const viewMonth = useApp((state) => state.viewMonth);
  const mode = useApp((state) => state.homeActivitiesMode);
  const pendingDetails = useApp((state) => state.pendingDetails);
  const saving = useApp((state) => state.saving);
  const saveError = useApp((state) => state.saveError);
  const breakEvent = useApp((state) => state.breakEvent);
  const highlightSaveId = useApp((state) => state.highlightSaveId);
  const place = useApp((state) => state.place);
  const activeNotice = useApp((state) => state.activeNotice);
  const reduced = useMotionReduced();
  const current = useMemo(() => monthOf(today), [today]);
  // Only the visible window is rendered. Stable month indices prevent scroll jumps.
  const months = useMemo(() => monthRange(monthOf(EARLIEST_DATE), current), [current]);
  const days = useMemo(() => buildDaySummaries(sessions, categories), [sessions, categories]);
  const selection = useMemo(() => new Set(selectionArr), [selectionArr]);
  const [listHeight, setListHeight] = useState(0);
  const visibleMonth = viewMonth;
  const list = useRef<FlatList<MonthRef>>(null);
  const scrollKey = useRef(monthKey(viewMonth));
  const initialAligned = useRef(false);
  const pendingTarget = useRef<string | null>(null);
  const sectionTitleHeight = Math.ceil(48 * Math.max(1, Math.min(fontScale, 1.6)));
  const frames = useMemo(() => {
    let offset = 0;
    const result: { index: number; length: number; offset: number }[] = [];
    for (let index = 0; index < months.length; index++) {
      const month = months[index];
      const length = sectionTitleHeight + calendarHeight(month, fontScale) + 28;
      const frame = { index, length, offset };
      offset += length;
      result.push(frame);
    }
    return result;
  }, [months, sectionTitleHeight, fontScale]);
  const [initialIndex] = useState(() => Math.max(0, months.findIndex((month) => compareMonths(month, viewMonth) === 0)));
  useEffect(() => {
    if (!listHeight || initialAligned.current) return;
    const frame = requestAnimationFrame(() => {
      list.current?.scrollToIndex({ index: initialIndex, animated: false, viewPosition: 0 });
      initialAligned.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [listHeight, initialIndex]);
  const requested = monthKey(viewMonth);
  useEffect(() => {
    if (requested === scrollKey.current) return;
    const index = months.findIndex((month) => compareMonths(month, viewMonth) === 0);
    if (index >= 0) {
      scrollKey.current = requested;
      pendingTarget.current = requested;
      list.current?.scrollToIndex({ index, animated: !reduced, viewPosition: 0 });
    }
  }, [requested, months, viewMonth, reduced]);
  const onVisible = useCallback(({ viewableItems }: { viewableItems: ViewToken<MonthRef>[] }) => {
    const requestedKey = pendingTarget.current;
    const target = requestedKey ? viewableItems.find((item) => item.isViewable && monthKey(item.item) === requestedKey) : null;
    if (requestedKey && !target) return;
    const month = target?.item ?? viewableItems.find((item) => item.isViewable)?.item;
    if (!month) return;
    pendingTarget.current = null;
    scrollKey.current = monthKey(month);
    setViewMonth(month);
  }, []);
  const n = selectionArr.length;
  const offMonth = selectionArr.filter((date) => !date.startsWith(monthKey(visibleMonth)));
  const footerHeight = Math.max(0, listHeight - (frames[frames.length - 1]?.length ?? listHeight));
  if (!active) return <View style={[styles.root, { backgroundColor: surface.bg, paddingTop: insets.top + 90, paddingHorizontal: 22 }]}><T variant="heading">{t.noActivities}</T><T variant="body" color={surface.mute} style={{ marginTop: 12, marginBottom: 24 }}>{t.noActivitiesBody}</T><Button label={t.createActivity} onPress={() => router.push('/activities')} /></View>;

  return (
    <View style={[styles.root, { backgroundColor: surface.bg, paddingTop: insets.top }]} testID="lineup">
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/jump')} accessibilityRole="button" accessibilityLabel={`${MONTHS_TITLE[visibleMonth.m - 1]} ${visibleMonth.y}. Scegli mese e anno`} testID="month-title" style={styles.monthTitle}>
          <T variant="heading" color={surface.fg} maxFontSizeMultiplier={1.15} style={{ fontFamily: fonts.displayBlack, fontSize: 30, lineHeight: 36 }}>Serie</T>
          <View style={styles.year}><T variant="data" color={surface.mute}>{visibleMonth.y}</T><Chevron dir="down" color={surface.fg} size={7} /></View>
        </Pressable>
        <Pressable onPress={() => setPlace('time')} accessibilityRole="button" accessibilityLabel="Storia" testID="history-handle" style={styles.headerButton}><T variant="bodyStrong" color={surface.fg}>Storia</T></Pressable>
        <Pressable onPress={() => router.push('/menu')} accessibilityRole="button" accessibilityLabel="Menu" testID="menu" style={styles.menu}><MenuGlyph color={surface.fg} /></Pressable>
      </View>
      {compareMonths(visibleMonth, current) !== 0 ? <Pressable onPress={goToday} accessibilityRole="button" testID="go-today" style={styles.today}><T variant="labelStrong" color={surface.fg}>{t.goToToday}</T></Pressable> : null}
      {activeNotice ? <T variant="small" color={surface.mute} style={{ paddingHorizontal: 22 }}>{activeNotice}</T> : null}
      <FlatList
        ref={list} data={months} keyExtractor={monthKey} initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => frames[index]}
        onScrollToIndexFailed={(info) => list.current?.scrollToOffset({ offset: frames[info.index]?.offset ?? 0, animated: false })}
        onLayout={(event) => setListHeight(event.nativeEvent.layout.height)}
        onViewableItemsChanged={onVisible} viewabilityConfig={VIEWABILITY}
        initialNumToRender={3} maxToRenderPerBatch={3} windowSize={5} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 22 }} ListFooterComponent={<View style={{ height: footerHeight }} />}
        extraData={{ selection, activeId: active.id, mode, saving, days, fontScale }} testID="month-list"
        renderItem={({ item }) => (
          <View style={{ paddingBottom: 28 }} testID={`home-month-${monthKey(item)}`}>
            <Pressable onPress={() => { setViewMonth(item); router.push('/jump'); }} accessibilityRole="button" accessibilityLabel={`${MONTHS_TITLE[item.m - 1]} ${item.y}. Scegli mese e anno`} style={{ height: sectionTitleHeight, justifyContent: 'center' }}><T variant="heading" color={surface.fg}>{MONTHS_TITLE[item.m - 1]} <T variant="data" color={surface.mute}>{item.y}</T></T></Pressable>
            <MonthCalendar month={item} days={days} activeId={active.id} selection={selection} today={today} showAll={mode === 'all'} onPressDay={toggleDate} onLongPressDay={openDay} disabled={saving} recentSave={highlightSaveId && breakEvent ? breakEvent : undefined} testID={`month-${monthKey(item)}`} />
          </View>
        )}
      />
      <View style={[styles.dock, { backgroundColor: surface.bg, borderTopColor: surface.faint, paddingBottom: Math.max(insets.bottom, 12) }]}>
        {place === 'lineup' ? <ToastContent inline /> : null}
        <View style={styles.context}>
          <Pressable onPress={() => router.push('/details')} accessibilityRole="button" accessibilityLabel={n ? t.detailsForSelection(n) : t.detailsLink} testID="details-link" style={styles.contextButton}><T variant="label" color={surface.mute} style={{ letterSpacing: 0.6 }}>{pendingDetails ? '✓ Dettagli' : '+ Dettagli'}</T></Pressable>
          {n === 1 ? <Pressable onPress={() => openDay(selectionArr[0])} accessibilityRole="button" accessibilityLabel="Sessioni del giorno" testID="selected-day-details" style={styles.contextButton}><T variant="label" color={surface.fg} style={{ letterSpacing: 0.3 }}>Sessioni</T></Pressable> : null}
          {n ? <Pressable onPress={clearSelection} accessibilityRole="button" accessibilityLabel="Svuota la selezione" testID="clear-selection" style={styles.contextButton}><T variant="label" color={surface.mute} style={{ letterSpacing: 0.3 }}>Svuota</T></Pressable> : null}
        </View>
        {offMonth.length ? <Pressable onPress={() => setViewMonth(monthOf(offMonth[0]))} accessibilityRole="button" testID="off-month" style={{ minHeight: 28, justifyContent: 'center' }}><T variant="small" color={surface.mute}>{offMonth.length} {offMonth.length === 1 ? 'data in un altro mese' : 'date in altri mesi'}</T></Pressable> : null}
        {saveError ? <T variant="small" color={surface.danger} accessibilityLiveRegion="assertive">{saveError}</T> : null}
        <SaveCapsule count={n} color={active.color} activityName={active.name} busy={saving} error={saveError} reduced={reduced} visible={place === 'lineup' && pathname === '/'} celebration={breakEvent?.categoryId === active.id ? breakEvent.id : null} onSave={() => { void save(); }} />
        <View style={{ height: 10 }} /><ActivityDock categories={categories} activeId={active.id} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({ root: { flex: 1 }, header: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 10 }, monthTitle: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 }, year: { flexDirection: 'row', alignItems: 'center', gap: 6 }, headerButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 2 }, menu: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' }, today: { paddingHorizontal: 22, minHeight: 36, justifyContent: 'center' }, dock: { paddingHorizontal: 22, paddingTop: 2, borderTopWidth: StyleSheet.hairlineWidth }, context: { minHeight: 44, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 8 }, contextButton: { minHeight: 44, flexShrink: 1, justifyContent: 'center' } });
export { addDays };
