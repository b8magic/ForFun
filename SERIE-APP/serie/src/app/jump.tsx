/**
 * Vai a… — direct month/year navigation for the Lineup (default) or the
 * history (`?target=history`). Months after the current one are disabled;
 * counts are the active activity's stored sessions.
 */
import { useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useApp } from '@/state/store';
import { useActive } from '@/state/selectors';
import { focusHistoryMonth, goToday, setViewMonth } from '@/state/actions';
import { compareMonths, monthKey, monthOf, type MonthRef } from '@/domain/dates';
import { Button, Sheet } from '@/ui/controls';
import { palette } from '@/ui/theme';
import { t } from '@/i18n/it';
import { ALL_ACTIVITIES, isFutureMonth, jumpYears, monthCounts, parseJumpTarget, parseMonthKey, yearCounts } from '@/sheets/manage/helpers';
import { MonthGrid, YearStrip, type MonthCell } from '@/sheets/manage/JumpParts';
import { closeSheet } from '@/sheets/manage/parts';

export default function JumpSheet() {
  const params = useLocalSearchParams<{ target?: string; cat?: string }>();
  const target = parseJumpTarget(params.target);
  const active = useActive();
  const sessions = useApp((s) => s.sessions);
  const today = useApp((s) => s.today);
  const viewMonth = useApp((s) => s.viewMonth);
  const historyFocus = useApp((s) => s.historyFocus);
  const categories = useApp((s) => s.categories);
  // from history, counts follow the history filter ('all' = every activity); from the Lineup, the active activity
  const filterCat = target === 'history' && params.cat ? (params.cat === 'all' ? null : (categories.find((c) => c.id === params.cat) ?? active)) : active;
  const activeId = target === 'history' && params.cat === 'all' ? ALL_ACTIVITIES : (filterCat?.id ?? null);
  const accent = filterCat?.color ?? palette.flare;
  const current = monthOf(today);

  const viewing: MonthRef | null = target === 'lineup' ? viewMonth : parseMonthKey(historyFocus?.key);
  const [earlier, setEarlier] = useState(0);
  const years = useMemo(() => jumpYears(sessions, activeId, today, { include: viewing?.y, earlier }), [sessions, activeId, today, viewing?.y, earlier]);
  const [year, setYear] = useState(() => Math.min(viewing?.y ?? current.y, current.y));
  const perYear = useMemo(() => yearCounts(sessions, activeId), [sessions, activeId]);
  const counts = useMemo(() => monthCounts(sessions, activeId, year), [sessions, activeId, year]);

  const cells: MonthCell[] = counts.map((count, i) => {
    const r = { y: year, m: i + 1 };
    return {
      m: i + 1,
      count,
      future: isFutureMonth(r, today),
      current: compareMonths(r, current) === 0,
      viewing: !!viewing && compareMonths(r, viewing) === 0,
    };
  });

  const pick = (m: number) => {
    const r = { y: year, m };
    if (isFutureMonth(r, today)) return;
    if (target === 'history') focusHistoryMonth(monthKey(r));
    else setViewMonth(r);
    closeSheet();
  };

  const backToToday = () => {
    if (target === 'history') focusHistoryMonth(monthKey(current));
    else goToday();
    closeSheet();
  };

  const atToday = !!viewing && compareMonths(viewing, current) === 0;

  return (
    <Sheet
      title={t.jumpTo}
      eyebrow={[active?.name, target === 'history' ? t.placeTime : t.placeLog].filter(Boolean).join(' · ')}
      testID="jump-sheet"
    >
      <YearStrip
        years={years}
        value={year}
        counts={perYear}
        accent={accent}
        onChange={setYear}
        onEarlier={() => {
          setEarlier((e) => e + 1);
          setYear(years[0] - 1);
        }}
      />
      <MonthGrid year={year} cells={cells} accent={accent} onPick={pick} />
      {atToday ? null : <Button kind="secondary" label={t.goToToday} onPress={backToToday} testID="jump-today" />}
    </Sheet>
  );
}
