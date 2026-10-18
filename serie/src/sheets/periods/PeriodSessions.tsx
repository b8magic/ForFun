import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import type { Category, Session } from '@/domain/types';
import { DaySessions } from '@/places/time/DaySessions';
import { dateLabel } from '@/places/time/format';
import { Button } from '@/ui/controls';
import { Chevron } from '@/ui/glyphs';
import { T } from '@/ui/T';
import { useSurface } from '@/ui/useTheme';
import { groupPeriodSessions } from './model';

export function PeriodSessionGroup({ date, sessions, catById, interactive = true }: {
  date: string;
  sessions: readonly Session[];
  catById: ReadonlyMap<string, Category>;
  interactive?: boolean;
}) {
  const C = useSurface();
  return (
    <View>
      {interactive ? (
        <Pressable
          onPress={() => router.push({ pathname: '/day', params: { date } })}
          accessibilityRole="button"
          accessibilityLabel={`Apri il giorno ${dateLabel(date)}`}
          style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
          testID={`period-day-${date}`}
        >
          <T variant="bodyStrong" color={C.fg} style={{ flex: 1 }}>{dateLabel(date)}</T>
          <Chevron dir="right" color={C.mute} size={8} />
        </Pressable>
      ) : (
        <T variant="bodyStrong" color={C.fg}>{dateLabel(date)}</T>
      )}
      <DaySessions date={date} sessions={sessions} catById={catById} showActivity showDate={false} interactive={interactive} />
    </View>
  );
}

/** A form preview can reveal every real day without mounting years of rows at once. */
export function PeriodSessionsPreview({ sessions, categories }: { sessions: readonly Session[]; categories: readonly Category[] }) {
  const C = useSurface();
  const groups = useMemo(() => groupPeriodSessions(sessions), [sessions]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const [visibleDays, setVisibleDays] = useState(12);
  if (!groups.length) return <T color={C.mute}>Nessuna sessione corrisponde a questo periodo.</T>;
  return (
    <View style={{ gap: 18 }}>
      {groups.slice(0, visibleDays).map(([date, day]) => (
        <PeriodSessionGroup key={date} date={date} sessions={day} catById={catById} interactive={false} />
      ))}
      {groups.length > visibleDays ? (
        <View style={{ gap: 4 }}>
          <T variant="small" color={C.mute}>{`${visibleDays} di ${groups.length} giorni mostrati`}</T>
          <Button label="Mostra altri giorni" kind="secondary" onPress={() => setVisibleDays((n) => n + 12)} testID="period-preview-more" />
        </View>
      ) : null}
    </View>
  );
}
