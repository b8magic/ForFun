import { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { EARLIEST_DATE, isLocalDate } from '@/domain/dates';
import { useApp } from '@/state/store';
import { toggleDate } from '@/state/actions';
import { useActive } from '@/state/selectors';
import { DaySessions } from '@/places/time/DaySessions';
import { dateLabel } from '@/places/time/format';
import { Button, Sheet } from '@/ui/controls';
import { useSurface } from '@/ui/useTheme';
import { T } from '@/ui/T';
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
  const valid = isLocalDate(date) && date >= EARLIEST_DATE;
  const sessions = useMemo(() => allSessions.filter((s) => s.date === date).sort(compareSessions), [allSessions, date]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const alreadySelected = selection.includes(date);

  const selectForLogging = () => {
    // A tap here adds to the current draft. It never unselects a day or writes a session.
    const state = useApp.getState();
    if (!valid || !state.activeId || state.saving || date > state.today) return;
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
      footer={
        <View style={{ gap: 8 }}>
          <T variant="small" color={C.mute}>
            {date > today
              ? 'Puoi registrare sessioni fino a oggi.'
              : !active
                ? 'Crea un’attività per registrare una sessione.'
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
      }
    >
      {sessions.length ? (
        <DaySessions date={date} sessions={sessions} catById={catById} showActivity showDate={false} />
      ) : (
        <View style={{ gap: 8, paddingVertical: 22 }} testID="day-empty">
          <T variant="title" color={C.fg}>Nessuna sessione registrata</T>
          <T variant="body" color={C.mute}>Questo giorno è ancora vuoto.</T>
        </View>
      )}
    </Sheet>
  );
}
