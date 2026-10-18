import { useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/state/store';
import { deleteSession, selectBulkDay, toggleBulkSession } from '@/state/actions';
import { Button, Sheet } from '@/ui/controls';
import { T } from '@/ui/T';
import { ToastContent } from '@/ui/Toast';
import { useSurface } from '@/ui/useTheme';
import { isLocalDate } from '@/domain/dates';
import { groupSessionsForDates } from '@/domain/sessionGroups';
import { DaySessions } from '@/places/time/DaySessions';
import { dateLabel } from '@/places/time/format';
import { t } from '@/i18n/it';

const close = () => router.canGoBack() ? router.back() : router.replace('/');

/** Home's saved-session list: browse in Nuove, choose records in Modifica. */
export function BulkDaySheet({ date }: { date: string }) {
  const S = useSurface();
  const activeId = useApp((state) => state.activeId);
  const categories = useApp((state) => state.categories);
  const allSessions = useApp((state) => state.sessions);
  const selectedDates = useApp((state) => state.selection);
  const selectedIds = useApp((state) => state.bulkSelection);
  const mode = useApp((state) => state.homeSessionMode);
  const saving = useApp((state) => state.bulkSaving || state.saving);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deletionInFlight = useRef(false);
  const busy = saving || deleting;
  const selecting = mode === 'edit';
  const filterId = selecting ? activeId : null;
  const groups = useMemo(() => groupSessionsForDates(allSessions, isLocalDate(date) ? [date] : selectedDates, filterId), [allSessions, date, selectedDates, filterId]);
  const catById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const sessionCount = groups.reduce((sum, group) => sum + group.sessions.length, 0);
  const count = groups.reduce((sum, group) => sum + group.sessions.filter((session) => selected.has(session.id)).length, 0);
  const toggleAll = () => {
    if (!selecting || busy) return;
    for (const group of groups) if (group.sessions.length) selectBulkDay(group.date, count !== sessionCount);
  };
  const remove = async (id: string) => {
    const state = useApp.getState();
    if (deletionInFlight.current || state.homeSessionMode !== 'new' || state.saving || state.bulkSaving) return;
    deletionInFlight.current = true;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteSession(id, { undo: true });
    } catch {
      setDeleteError(t.errorGeneric);
      AccessibilityInfo.announceForAccessibility(t.errorGeneric);
    } finally {
      deletionInFlight.current = false;
      setDeleting(false);
    }
  };
  return (
    <Sheet
      title="Sessioni"
      eyebrow={filterId ? catById.get(filterId)?.name : 'Tutte le attività'}
      testID="bulk-day-sheet"
      footer={(
        <View style={{ gap: 8 }}>
          <ToastContent inline />
          {deleting ? <T variant="small" color={S.mute} accessibilityLiveRegion="polite" testID="selected-sessions-delete-busy">Eliminazione…</T> : null}
          {deleteError ? <T variant="small" color={S.danger} accessibilityLiveRegion="assertive" testID="selected-sessions-delete-error">{deleteError}</T> : null}
          <Button label={selecting ? `Fatto · ${count} ${count === 1 ? 'selezionata' : 'selezionate'}` : 'Fatto'} onPress={close} testID="bulk-day-done" />
        </View>
      )}
    >
      {selecting && sessionCount ? (
        <Pressable onPress={toggleAll} disabled={busy} accessibilityRole="checkbox" aria-checked={count === sessionCount ? true : count ? 'mixed' : false} aria-disabled={busy} accessibilityLabel={`Tutte le ${sessionCount} sessioni`} testID="bulk-day-all" style={styles.all}>
          <T variant="bodyStrong">Tutte · {sessionCount}</T>
          <T variant="bodyStrong" color={S.fg}>{count === sessionCount ? '✓' : count ? '−' : '○'}</T>
        </Pressable>
      ) : null}
      {groups.map((group) => (
        <View key={group.date} testID={`selected-sessions-day-${group.date}`}>
          <T variant="title" color={S.fg} accessibilityRole="header">{dateLabel(group.date)}</T>
          {group.sessions.length ? (
            <DaySessions
              date={group.date}
              sessions={group.sessions}
              catById={catById}
              showActivity
              showDate={false}
              interactive={!busy}
              onDelete={selecting ? undefined : (session) => void remove(session.id)}
              selection={selecting ? { ids: selected, onToggle: toggleBulkSession } : undefined}
            />
          ) : <T variant="small" color={S.mute} style={styles.empty}>{filterId ? 'Nessuna sessione di questa attività.' : 'Nessuna sessione registrata.'}</T>}
        </View>
      ))}
      {!groups.length ? <T color={S.mute}>Seleziona i giorni dal calendario.</T> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  all: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  empty: { marginTop: 12 },
});
