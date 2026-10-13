import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/state/store';
import { selectBulkDay, toggleBulkSession } from '@/state/actions';
import { Button, Sheet } from '@/ui/controls';
import { T } from '@/ui/T';
import { useSurface } from '@/ui/useTheme';
import { isLocalDate } from '@/domain/dates';
import { dateLabel, placeSummary, timingSummary } from '@/places/time/format';
import { compareSessions } from '@/sheets/day/sessionOrder';

const close = () => router.canGoBack() ? router.back() : router.replace('/');

export function BulkDaySheet({ date }: { date: string }) {
  const S = useSurface();
  const activeId = useApp((state) => state.activeId);
  const category = useApp((state) => state.categories.find((item) => item.id === state.activeId));
  const allSessions = useApp((state) => state.sessions);
  const selectedIds = useApp((state) => state.bulkSelection);
  const mode = useApp((state) => state.homeSessionMode);
  const busy = useApp((state) => state.bulkSaving);
  const sessions = useMemo(() => allSessions.filter((session) => session.date === date && session.categoryId === activeId).sort(compareSessions), [allSessions, date, activeId]);
  const selected = new Set(selectedIds);
  const count = sessions.filter((session) => selected.has(session.id)).length;
  const enabled = mode === 'edit' && !busy;
  return (
    <Sheet title={isLocalDate(date) ? dateLabel(date, false) : 'Giorno non valido'} eyebrow={category?.name} testID="bulk-day-sheet" footer={<Button label={`Fatto · ${count} ${count === 1 ? 'selezionata' : 'selezionate'}`} onPress={close} testID="bulk-day-done" />}>
      {sessions.length ? <>
        <Pressable onPress={() => selectBulkDay(date, count !== sessions.length)} disabled={!enabled} accessibilityRole="checkbox" aria-checked={count === sessions.length ? true : count ? 'mixed' : false} aria-disabled={!enabled} accessibilityLabel={`Tutte le ${sessions.length} sessioni del giorno`} testID="bulk-day-all" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><T variant="bodyStrong">Tutte · {sessions.length}</T><T variant="bodyStrong" color={S.fg}>{count === sessions.length ? '✓' : count ? '−' : '○'}</T></Pressable>
        {sessions.map((session, index) => <Pressable key={session.id} onPress={() => toggleBulkSession(session.id)} disabled={!enabled} accessibilityRole="checkbox" aria-checked={selected.has(session.id)} aria-disabled={!enabled} accessibilityLabel={`Sessione ${index + 1}: ${[timingSummary(session), placeSummary(session.place), session.notes].filter(Boolean).join(', ')}`} testID={`bulk-day-session-${session.id}`} style={{ minHeight: 64, flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: S.faint }}>
          <T variant="bodyStrong" color={S.fg}>{selected.has(session.id) ? '✓' : '○'}</T>
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="bodyStrong">{timingSummary(session)}</T>
            {placeSummary(session.place) ? <T variant="small" color={S.mute} numberOfLines={2}>{placeSummary(session.place)}</T> : null}
            {session.notes ? <T variant="small" color={S.mute} numberOfLines={2}>{session.notes}</T> : null}
          </View>
        </Pressable>)}
      </> : <T color={S.mute}>Nessuna sessione di questa attività.</T>}
    </Sheet>
  );
}
