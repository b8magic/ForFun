import { useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { router } from 'expo-router';
import { EARLIEST_DATE, isLocalDate } from '@/domain/dates';
import { useApp } from '@/state/store';
import { deleteSession, setHomeSessionMode, showToast, toggleDate } from '@/state/actions';
import { useActive } from '@/state/selectors';
import { DaySessions } from '@/places/time/DaySessions';
import { dateLabel, timingSummary } from '@/places/time/format';
import { Button, Sheet } from '@/ui/controls';
import { useSurface } from '@/ui/useTheme';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { compareSessions } from './sessionOrder';

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

export function DaySheet({ date }: { date: string }) {
  const C = useSurface();
  const allSessions = useApp((s) => s.sessions);
  const categories = useApp((s) => s.categories);
  const selection = useApp((s) => s.selection);
  const today = useApp((s) => s.today);
  const saving = useApp((s) => s.saving);
  const active = useActive();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deletionInFlight = useRef(false);
  const valid = isLocalDate(date) && date >= EARLIEST_DATE;
  const sessions = useMemo(() => allSessions.filter((s) => s.date === date).sort(compareSessions), [allSessions, date]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const alreadySelected = selection.includes(date);
  const deleteTarget = sessions.find((session) => session.id === deleteId);

  const askDelete = (id: string) => {
    if (deletionInFlight.current) return;
    setDeleteError(null);
    setDeleteId(id);
    AccessibilityInfo.announceForAccessibility(t.deleteSessionConfirm);
  };

  const remove = async () => {
    if (!deleteTarget || deletionInFlight.current) return;
    deletionInFlight.current = true;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteSession(deleteTarget.id);
      setDeleteId(null);
      showToast(t.sessionSheets.sessionDeleted);
    } catch {
      setDeleteError(t.errorGeneric);
      AccessibilityInfo.announceForAccessibility(t.errorGeneric);
    } finally {
      deletionInFlight.current = false;
      setDeleting(false);
    }
  };

  const selectForLogging = () => {
    // A tap here adds to the current draft. It never unselects a day or writes a session.
    const state = useApp.getState();
    if (!valid || !state.activeId || state.saving || state.bulkSaving || date > state.today) return;
    setHomeSessionMode('new');
    if (!state.selection.includes(date) && !toggleDate(date)) return;
    close();
  };

  if (!valid) {
    return (
      <Sheet title="Giorno non valido" testID="day-missing">
        <T color={C.mute}>Apri un giorno dal calendario o dalla Storia.</T>
        <Button label="Chiudi" kind="secondary" onPress={close} />
      </Sheet>
    );
  }

  return (
    <Sheet
      title={dateLabel(date)}
      testID="day-sheet"
      footer={deleteTarget ? (
        <View style={{ gap: 12 }} accessibilityLiveRegion="polite" testID="day-delete-confirm">
          <T variant="bodyStrong" color={C.fg}>
            {[catById.get(deleteTarget.categoryId)?.name, timingSummary(deleteTarget)].filter(Boolean).join(' · ')}
          </T>
          <T variant="small" color={C.mute}>{t.deleteSessionConfirm}</T>
          {deleteError ? <T variant="small" color={C.danger} accessibilityLiveRegion="assertive">{deleteError}</T> : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button label={t.cancel} kind="secondary" onPress={() => setDeleteId(null)} disabled={deleting} testID="day-delete-cancel" />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={t.delete} kind="danger" onPress={() => void remove()} busy={deleting} testID="day-delete-yes" />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <T variant="small" color={C.mute}>
            {date > today
              ? 'Puoi registrare sessioni fino a oggi.'
              : !active
                ? categories.length ? 'Seleziona un’attività per registrare una sessione.' : 'Crea un’attività per registrare una sessione.'
                : alreadySelected
                  ? `La data è già selezionata per ${active.name}. Potrai salvarla da Home.`
                  : `La data verrà selezionata per ${active.name}. Potrai salvarla da Home.`}
          </T>
          <Button
            label={alreadySelected ? 'Torna alla selezione' : 'Nuova sessione'}
            onPress={selectForLogging}
            disabled={!active || saving || date > today}
            testID="day-new-session"
            accessibilityHint={active ? `Aggiungi questa data alla selezione di ${active.name} e chiudi il giorno` : undefined}
          />
        </View>
      )}
    >
      {sessions.length ? (
        <DaySessions date={date} sessions={sessions} catById={catById} showActivity showDate={false} interactive={!deleteTarget} onDelete={(session) => askDelete(session.id)} />
      ) : (
        <View style={{ gap: 8, paddingVertical: 22 }} testID="day-empty">
          <T variant="title" color={C.fg}>Nessuna sessione registrata</T>
          <T variant="body" color={C.mute}>Questo giorno è ancora vuoto.</T>
        </View>
      )}
    </Sheet>
  );
}
