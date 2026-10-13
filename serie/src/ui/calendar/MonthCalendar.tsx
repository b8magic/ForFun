import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { daysInMonth, firstOfMonth, monthWeeks, parseDate, weekdayMon0, type MonthRef } from '@/domain/dates';
import type { DaySummary } from '@/domain/daySummaries';
import { useApp } from '@/state/store';
import { useMotionReduced } from '@/state/selectors';
import { MONTHS, WEEKDAYS_INITIAL } from '@/i18n/it';
import { useSurface } from '@/ui/useTheme';
import { T } from '@/ui/T';
import { DayMosaic } from './DayMosaic';

export const calendarRowHeight = (fontScale = 1, compact = false) => Math.ceil((compact ? 46 : 52) * Math.max(1, Math.min(fontScale, 1.6)));
export const calendarWeekdayHeight = (fontScale = 1) => Math.ceil(28 * Math.max(1, Math.min(fontScale, 1.6)));
export const calendarHeight = (month: MonthRef, fontScale = 1, compact = false) => calendarWeekdayHeight(fontScale) + Math.ceil((weekdayMon0(firstOfMonth(month)) + daysInMonth(month.y, month.m)) / 7) * calendarRowHeight(fontScale, compact) + 8;

interface Props {
  month: MonthRef;
  days: Map<string, DaySummary>;
  activeId?: string | null;
  selection?: ReadonlySet<string>;
  today: string;
  showAll?: boolean;
  onPressDay?: (date: string) => void;
  onLongPressDay?: (date: string) => void;
  testID?: string;
  dayTestPrefix?: string;
  compact?: boolean;
  disabled?: boolean;
  preventFuture?: boolean;
  recentSave?: { id: number; dates: readonly string[] };
  selectionEnabled?: boolean;
  /** History uses the same marker for an open day, without implying a draft. */
  selectionLabel?: string;
  /** Existing-session mode: counts selected records, including partial same-day selections. */
  existingSelection?: ReadonlyMap<string, number>;
}

const EMPTY_SELECTION = new Set<string>();

/** One shared calendar keeps colours and day meaning identical across surfaces. */
export const MonthCalendar = memo(function MonthCalendar({ month, days, activeId = null, selection = EMPTY_SELECTION, today, showAll = true, onPressDay, onLongPressDay, testID, dayTestPrefix = 'day-', compact = false, disabled = false, preventFuture = true, recentSave, selectionEnabled = true, selectionLabel = 'selezionato, da salvare', existingSelection }: Props) {
  const surface = useSurface();
  const reduced = useMotionReduced();
  const { width, fontScale } = useWindowDimensions();
  const categories = useApp((s) => s.categories);
  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const weeks = useMemo(() => monthWeeks(month), [month]);
  const rowH = calendarRowHeight(fontScale, compact);
  const size = Math.min(44, (width - 44) / 7 - 1);
  return (
    <View testID={testID} style={{ paddingBottom: 8 }}>
      <View style={[styles.weekdays, { height: calendarWeekdayHeight(fontScale) }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {WEEKDAYS_INITIAL.map((name, index) => <View key={index} style={styles.column}><T variant="label" color={surface.mute} align="center" style={{ letterSpacing: 0 }}>{name}</T></View>)}
      </View>
      {weeks.map((week) => (
        <View key={week[0]} style={{ flexDirection: 'row', height: rowH }}>
          {week.map((date) => {
            const parsed = parseDate(date);
            const inMonth = parsed.y === month.y && parsed.m === month.m;
            if (!inMonth) return <View key={date} style={styles.column} accessibilityElementsHidden />;
            const day = days.get(date);
            const activities = day?.categories.filter((category) => showAll || category.categoryId === activeId) ?? [];
            const selected = selection.has(date);
            const existingCount = activeId ? day?.categories.find((category) => category.categoryId === activeId)?.count ?? 0 : day?.count ?? 0;
            const selectedCount = existingSelection?.get(date) ?? 0;
            const future = date > today;
            const isToday = date === today;
            const names = activities.map((activity) => `${categoryNames.get(activity.categoryId) ?? 'Attività'}: ${activity.count} ${activity.count === 1 ? 'sessione' : 'sessioni'}`).join(', ');
            const selectedLabel = selected ? existingSelection ? `, selezionato, ${selectedCount} di ${existingCount} sessioni selezionate per la modifica` : `, ${selectionLabel}` : '';
            const label = `${parsed.d} ${MONTHS[parsed.m - 1]} ${parsed.y}${isToday ? ', oggi' : ''}${selectedLabel}${names ? `, ${names}, ${day?.count ?? 0} ${(day?.count ?? 0) === 1 ? 'sessione registrata' : 'sessioni registrate'}` : ', nessuna sessione registrata'}${future ? ', data futura' : ''}`;
            const disabledTap = disabled || !onPressDay || (preventFuture && future);
            return (
              <Pressable
                key={date}
                onPress={() => { if (!disabledTap) onPressDay?.(date); }}
                onLongPress={() => onLongPressDay?.(date)}
                delayLongPress={420}
                disabled={disabledTap}
                accessibilityRole={onPressDay || onLongPressDay ? 'button' : 'text'}
                accessibilityLabel={label}
                accessibilityHint={onLongPressDay ? selectionEnabled ? 'Tocca per selezionare. Tieni premuto per le sessioni del giorno.' : 'Mostra le sessioni del giorno' : undefined}
                accessibilityState={{ selected, disabled: disabledTap }}
                accessibilityActions={onLongPressDay ? [{ name: 'showSessions', label: 'Mostra le sessioni del giorno' }] : undefined}
                onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'showSessions') onLongPressDay?.(date); }}
                testID={`${dayTestPrefix}${date}`}
                style={({ pressed }) => [styles.column, { justifyContent: 'center', opacity: future ? 0.3 : pressed ? 0.65 : 1 }]}
              >
                <DayMosaic activities={activities} size={size} activeId={activeId} selected={selected} today={isToday} reduced={reduced} celebration={recentSave?.dates.includes(date) ? recentSave.id : undefined} />
                <View pointerEvents="none" style={styles.number}>
                  <View style={[styles.numberGround, activities.length > 0 && { backgroundColor: surface.bg }]}>
                    <T variant={isToday || selected ? 'dayStrong' : 'day'} color={surface.fg} align="center" style={{ fontSize: compact ? 14 : 16, lineHeight: compact ? 19 : 22 }} maxFontSizeMultiplier={1.6}>{parsed.d}</T>
                  </View>
                </View>
                {existingSelection && existingCount > 1 && selectedCount > 0 ? <View pointerEvents="none" style={[styles.existingCount, { backgroundColor: surface.bg }]}><T variant="labelStrong" color={surface.fg} style={{ fontSize: 9, lineHeight: 11 }}>{selectedCount}/{existingCount}</T></View> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  weekdays: { flexDirection: 'row', alignItems: 'center' },
  column: { flex: 1, alignItems: 'center', minWidth: 0 },
  number: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  numberGround: { paddingHorizontal: 3, paddingVertical: 1, borderRadius: 4 },
  existingCount: { position: 'absolute', bottom: 0, right: 1, borderRadius: 4, paddingHorizontal: 2 },
});
