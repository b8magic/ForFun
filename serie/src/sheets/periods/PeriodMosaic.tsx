import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Category, Session } from '@/domain/types';
import { addDays, diffDays, startOfWeek } from '@/domain/dates';
import { shortDate } from '@/places/time/format';
import { T } from '@/ui/T';
import { useSurface } from '@/ui/useTheme';

/** A bounded preview of actual days. A long interval explicitly names the part shown. */
export function PeriodMosaic({ startDate, endDate, sessions, categories, compact = false }: {
  startDate: string;
  endDate: string;
  sessions: readonly Session[];
  categories: readonly Category[];
  compact?: boolean;
}) {
  const C = useSurface();
  const [width, setWidth] = useState(280);
  const maxDays = compact ? 91 : 366;
  const span = diffDays(endDate, startDate) + 1;
  const from = span > maxDays ? addDays(endDate, 1 - maxDays) : startDate;
  const weeks = useMemo(() => {
    const first = startOfWeek(from);
    const firstOffset = diffDays(from, first);
    const lastOffset = diffDays(endDate, first);
    return Array.from({ length: Math.ceil((lastOffset + 1) / 7) }, (_, week) => (
      Array.from({ length: 7 }, (_, day) => {
        const offset = week * 7 + day;
        return { date: addDays(first, offset), outside: offset < firstOffset || offset > lastOffset };
      })
    ));
  }, [from, endDate]);
  const colorsByDate = useMemo(() => {
    const catById = new Map(categories.map((c) => [c.id, c]));
    const idsByDate = new Map<string, Set<string>>();
    for (const session of sessions) {
      if (session.date < from || session.date > endDate) continue;
      const ids = idsByDate.get(session.date);
      if (ids) ids.add(session.categoryId);
      else idsByDate.set(session.date, new Set([session.categoryId]));
    }
    const colors = new Map<string, string[]>();
    for (const [date, ids] of idsByDate) {
      const ordered = [...ids].sort((a, b) => (catById.get(a)?.sortOrder ?? 0) - (catById.get(b)?.sortOrder ?? 0) || a.localeCompare(b));
      colors.set(date, ordered.map((id) => catById.get(id)?.color ?? C.mute));
    }
    return colors;
  }, [sessions, categories, from, endDate, C.mute]);
  const size = Math.max(2, Math.min(compact ? 6 : 8, Math.floor((width - (weeks.length - 1) * 2) / weeks.length)));

  return (
    <View style={{ gap: 8 }} onLayout={(e) => setWidth(Math.max(1, e.nativeEvent.layout.width))}>
      <View style={{ flexDirection: 'row', gap: 2 }} accessible={false} importantForAccessibility="no-hide-descendants">
        {weeks.map((week) => (
          <View key={week[0].date} style={{ gap: 2 }}>
            {week.map(({ date, outside }) => {
              const colors = colorsByDate.get(date) ?? [];
              return (
                <View key={date} style={{ width: size, height: size, flexDirection: 'row', overflow: 'hidden', borderRadius: 1, backgroundColor: outside ? 'transparent' : C.faint, borderWidth: colors.length ? StyleSheet.hairlineWidth : 0, borderColor: C.faint }}>
                  {colors.map((color, i) => <View key={`${color}-${i}`} style={{ flex: 1, backgroundColor: color }} />)}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      {span > maxDays ? <T variant="small" color={C.mute}>{`${shortDate(from)}–${shortDate(endDate)} · ultimi ${maxDays} giorni`}</T> : null}
    </View>
  );
}
