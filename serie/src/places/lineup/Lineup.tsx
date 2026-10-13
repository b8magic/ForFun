/** Vertical logging calendar. The activity selects the destination, never the history. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type ViewToken } from 'react-native';
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
import { HomeBulkControls, HomeSessionModes } from './HomeBulkMode';

const openDay = (date: string) => router.push({ pathname: '/day', params: { date } });
const VIEWABILITY = { itemVisiblePercentThreshold: 30 };
interface MonthAlignment { key: string; month: MonthRef; index: number; offset: number }

export function Lineup() {
  const surface = useSurface();
  const pathname = usePathname();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const active = useActive();
  const categories = useApp((state) => state.categories);
  const sessions = useApp((state) => state.sessions);
  const selectionArr = useApp((state) => state.selection);
  const sessionMode = useApp((state) => state.homeSessionMode);
  const bulkSelection = useApp((state) => state.bulkSelection);
  const bulkSaving = useApp((state) => state.bulkSaving);
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
  const bulkDays = useMemo(() => {
    const selected = new Set(bulkSelection);
    const counts = new Map<string, number>();
    for (const session of sessions) if (selected.has(session.id) && (!active?.id || session.categoryId === active.id)) counts.set(session.date, (counts.get(session.date) ?? 0) + 1);
    return counts;
  }, [bulkSelection, sessions, active]);
  const selection = useMemo(() => new Set(selectionArr), [selectionArr]);
  const [listHeight, setListHeight] = useState(0);
  const visibleMonth = viewMonth;
  const list = useRef<FlatList<MonthRef>>(null);
  // A request is acknowledged only after its rendered month reaches its offset.
  const scrollKey = useRef<string | null>(null);
  const pendingTarget = useRef<MonthAlignment | null>(null);
  const viewableMonths = useRef<MonthRef[]>([]);
  const scrollOffset = useRef<number | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAlignment = useRef<(() => void) | null>(null);
  const homeVisible = place === 'lineup' && pathname === '/';
  const homeVisibleRef = useRef(homeVisible);
  const requested = monthKey(viewMonth);
  useLayoutEffect(() => {
    homeVisibleRef.current = homeVisible;
  }, [homeVisible]);
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
  const stopRetry = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
  }, []);
  const finishAlignment = useCallback(() => {
    const target = pendingTarget.current;
    if (!target || !homeVisibleRef.current || scrollOffset.current === null) return;
    if (monthKey(useApp.getState().viewMonth) !== target.key) return;
    if (Math.abs(scrollOffset.current - target.offset) > 2 || !viewableMonths.current.some((month) => monthKey(month) === target.key)) return;
    pendingTarget.current = null;
    retryAlignment.current = null;
    scrollKey.current = target.key;
    stopRetry();
    setViewMonth(target.month);
  }, [stopRetry]);
  useEffect(() => {
    const index = months.findIndex((month) => monthKey(month) === requested);
    if (requested === scrollKey.current || index < 0) {
      pendingTarget.current = null;
      return;
    }
    const target = { key: requested, month: months[index], index, offset: frames[index].offset };
    pendingTarget.current = target;
    // The covered native screen can ignore scroll commands during dismissal.
    // Keep the request pending and issue it once Home has a measured viewport.
    if (!homeVisible || !listHeight) return;
    let attempts = 0;
    const align = () => {
      if (pendingTarget.current !== target || !homeVisibleRef.current || monthKey(useApp.getState().viewMonth) !== target.key) return;
      stopRetry();
      attempts++;
      // Jump directly to the known frame; animating through years can strand
      // the virtualized window when the route or content layout changes.
      list.current?.scrollToIndex({ index, animated: false, viewPosition: 0 });
      list.current?.recordInteraction();
      finishAlignment();
      if (pendingTarget.current === target && attempts < 12) retryTimer.current = setTimeout(align, 200);
    };
    retryAlignment.current = align;
    const frame = requestAnimationFrame(align);
    return () => {
      cancelAnimationFrame(frame);
      stopRetry();
      if (retryAlignment.current === align) retryAlignment.current = null;
    };
  }, [requested, months, frames, homeVisible, listHeight, finishAlignment, stopRetry]);
  const onVisible = useCallback(({ viewableItems }: { viewableItems: ViewToken<MonthRef>[] }) => {
    viewableMonths.current = viewableItems.filter((item) => item.isViewable).map((item) => item.item);
    if (!homeVisibleRef.current) return;
    if (pendingTarget.current) { finishAlignment(); return; }
    // Ignore stale viewability between a new store request and its effect.
    if (monthKey(useApp.getState().viewMonth) !== scrollKey.current) return;
    const month = viewableMonths.current[0];
    if (!month) return;
    scrollKey.current = monthKey(month);
    setViewMonth(month);
  }, [finishAlignment]);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
    finishAlignment();
  }, [finishAlignment]);
  const onScrollBeginDrag = useCallback(() => {
    // A deliberate drag takes ownership from any unfinished jump/retry.
    pendingTarget.current = null;
    retryAlignment.current = null;
    stopRetry();
    const month = viewableMonths.current[0];
    if (month) {
      scrollKey.current = monthKey(month);
      setViewMonth(month);
    }
  }, [stopRetry]);
  const n = selectionArr.length;
  const offMonth = selectionArr.filter((date) => !date.startsWith(monthKey(visibleMonth)));
  const footerHeight = Math.max(0, listHeight - (frames[frames.length - 1]?.length ?? listHeight));
  if (!categories.length) return <View style={[styles.root, { backgroundColor: surface.bg, paddingTop: insets.top + 90, paddingHorizontal: 22 }]}><T variant="heading">{t.noActivities}</T><T variant="body" color={surface.mute} style={{ marginTop: 12, marginBottom: 24 }}>{t.noActivitiesBody}</T><Button label={t.createActivity} onPress={() => router.push('/activities')} /></View>;

  return (
    <View style={[styles.root, { backgroundColor: surface.bg, paddingTop: insets.top }]} testID="lineup">
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/jump')} accessibilityRole="button" accessibilityLabel={`${MONTHS_TITLE[visibleMonth.m - 1]} ${visibleMonth.y}. Scegli mese e anno`} testID="month-title" style={styles.monthTitle}>
          <T variant="heading" color={surface.fg} maxFontSizeMultiplier={1.15} testID="home-year" style={{ fontFamily: fonts.displayCondensedMedium, fontSize: 30, lineHeight: 36 }}>{visibleMonth.y}</T>
          <Chevron dir="down" color={surface.fg} size={7} />
        </Pressable>
        <Pressable onPress={() => setPlace('time')} accessibilityRole="button" accessibilityLabel="Storia" testID="history-handle" style={styles.headerButton}><T variant="bodyStrong" color={surface.fg}>Storia</T></Pressable>
        <Pressable onPress={() => router.push('/menu')} accessibilityRole="button" accessibilityLabel="Menu" testID="menu" style={styles.menu}><MenuGlyph color={surface.fg} /></Pressable>
      </View>
      {compareMonths(visibleMonth, current) !== 0 ? <Pressable onPress={goToday} accessibilityRole="button" testID="go-today" style={styles.today}><T variant="labelStrong" color={surface.fg}>{t.goToToday}</T></Pressable> : null}
      {activeNotice ? <T variant="small" color={surface.mute} style={{ paddingHorizontal: 22 }}>{activeNotice}</T> : null}
      <FlatList
        ref={list} data={months} keyExtractor={monthKey} initialScrollIndex={initialIndex}
        // The native status-bar shortcut would jump to January 1900, not today.
        scrollsToTop={false}
        getItemLayout={(_, index) => frames[index]}
        onScrollToIndexFailed={(info) => {
          const target = pendingTarget.current;
          if (target?.index === info.index && homeVisibleRef.current) list.current?.scrollToOffset({ offset: target.offset, animated: false });
        }}
        onLayout={(event) => setListHeight(event.nativeEvent.layout.height)}
        onContentSizeChange={() => retryAlignment.current?.()}
        onScroll={onScroll} onScrollBeginDrag={onScrollBeginDrag} scrollEventThrottle={16}
        onViewableItemsChanged={onVisible} viewabilityConfig={VIEWABILITY}
        initialNumToRender={3} maxToRenderPerBatch={3} windowSize={5} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 22 }} ListFooterComponent={<View style={{ height: footerHeight }} />}
        extraData={{ selection, activeId: active?.id, mode, saving, days, fontScale, sessionMode, bulkDays, bulkSaving }} testID="month-list"
        renderItem={({ item }) => (
          <View style={{ paddingBottom: 28 }} testID={`home-month-${monthKey(item)}`}>
            <Pressable onPress={() => { setViewMonth(item); router.push('/jump'); }} accessibilityRole="button" accessibilityLabel={`${MONTHS_TITLE[item.m - 1]} ${item.y}. Scegli mese e anno`} style={{ height: sectionTitleHeight, justifyContent: 'center' }}><T variant="heading" color={surface.fg}>{MONTHS_TITLE[item.m - 1]} <T variant="data" color={surface.mute}>{item.y}</T></T></Pressable>
            <MonthCalendar month={item} days={days} activeId={active?.id} selection={selection} today={today} showAll={!active || mode === 'all'} onPressDay={toggleDate} onLongPressDay={openDay} disabled={saving || bulkSaving} existingSelection={sessionMode === 'edit' ? bulkDays : undefined} recentSave={sessionMode === 'new' && highlightSaveId && breakEvent ? breakEvent : undefined} testID={`month-${monthKey(item)}`} />
          </View>
        )}
      />
      <View style={[styles.dock, { backgroundColor: surface.bg, borderTopColor: surface.faint, paddingBottom: Math.max(insets.bottom, 12) }]}>
        {place === 'lineup' ? <ToastContent inline /> : null}
        <HomeSessionModes />{sessionMode === 'edit' ? <HomeBulkControls count={[...bulkDays.values()].reduce((sum, count) => sum + count, 0)} dayCount={n} color={active?.color ?? surface.fg} /> : <><View style={styles.context}>
          {active ? <Pressable onPress={() => router.push('/details')} accessibilityRole="button" accessibilityLabel={n ? t.detailsForSelection(n) : t.detailsLink} testID="details-link" style={styles.contextButton}><T variant="label" color={surface.mute} style={{ letterSpacing: 0.6 }}>{pendingDetails ? '✓ Dettagli' : '+ Dettagli'}</T></Pressable> : <T variant="small" color={surface.mute}>{n ? `${n} ${n === 1 ? 'giorno selezionato' : 'giorni selezionati'}` : ''}</T>}
          {n === 1 ? <Pressable onPress={() => openDay(selectionArr[0])} accessibilityRole="button" accessibilityLabel="Sessioni del giorno" testID="selected-day-details" style={styles.contextButton}><T variant="label" color={surface.fg} style={{ letterSpacing: 0.3 }}>Sessioni</T></Pressable> : null}
          {n ? <Pressable onPress={clearSelection} accessibilityRole="button" accessibilityLabel="Svuota la selezione" testID="clear-selection" style={styles.contextButton}><T variant="label" color={surface.mute} style={{ letterSpacing: 0.3 }}>Svuota</T></Pressable> : null}
        </View>
        {offMonth.length ? <Pressable onPress={() => setViewMonth(monthOf(offMonth[0]))} accessibilityRole="button" testID="off-month" style={{ minHeight: 28, justifyContent: 'center' }}><T variant="small" color={surface.mute}>{offMonth.length} {offMonth.length === 1 ? 'data in un altro mese' : 'date in altri mesi'}</T></Pressable> : null}
        {saveError ? <T variant="small" color={surface.danger} accessibilityLiveRegion="assertive">{saveError}</T> : null}
        <SaveCapsule count={n} color={active?.color ?? surface.fg} activityName={active?.name ?? null} busy={saving} error={saveError} reduced={reduced} visible={place === 'lineup' && pathname === '/'} celebration={active && breakEvent?.categoryId === active.id ? breakEvent.id : null} onSave={() => { void save(); }} />
        </>}
        <View style={{ height: 10 }} /><ActivityDock categories={categories} activeId={active?.id ?? null} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({ root: { flex: 1 }, header: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 10 }, monthTitle: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 }, year: { flexDirection: 'row', alignItems: 'center', gap: 6 }, headerButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 2 }, menu: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' }, today: { paddingHorizontal: 22, minHeight: 36, justifyContent: 'center' }, dock: { paddingHorizontal: 22, paddingTop: 2, borderTopWidth: StyleSheet.hairlineWidth }, context: { minHeight: 44, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 8 }, contextButton: { minHeight: 44, flexShrink: 1, justifyContent: 'center' } });
export { addDays };
