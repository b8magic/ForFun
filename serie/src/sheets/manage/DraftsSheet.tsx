import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { SessionDetailsDraft } from '@/domain/types';
import { hasDraftDetails } from '@/domain/drafts';
import { formatDuration } from '@/domain/duration';
import { useApp } from '@/state/store';
import { discardActivityDraft, discardAllDrafts, discardDraftSelection, setPlace } from '@/state/actions';
import { Button, Note, Section, Sheet } from '@/ui/controls';
import { T } from '@/ui/T';
import { useSurface } from '@/ui/useTheme';
import { shortDate } from '@/sheets/session/drafts';
import { formatCoords } from '@/sheets/session/placeForm';

export function DraftsSheet() {
  const S = useSurface();
  const selection = useApp((state) => state.selection);
  const drafts = useApp((state) => state.drafts);
  const categories = useApp((state) => state.categories);
  const bulkSaving = useApp((state) => state.bulkSaving);
  const saving = useApp((state) => state.saving);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const prepared = categories.filter((category) => hasDraftDetails(drafts[category.id]?.details));
  const empty = !selection.length && !prepared.length;
  const disabled = busy || saving || bulkSaving || Object.values(drafts).some((draft) => draft.saving);

  const discard = async (action: () => Promise<boolean>) => {
    if (disabled) return;
    setBusy(true);
    setError(null);
    try {
      if (await action()) setConfirmAll(false);
      else setError('Non è stato possibile eliminare tutte le bozze. Riprova.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Bozze" testID="drafts-sheet" onBack={() => router.replace('/menu')} backLabel="Menu">
      <T variant="small" color={S.mute}>Le date sono condivise tra le attività. I dettagli preparati per ogni attività si applicano quando premi Salva in Home.</T>
      {error ? <View accessibilityRole="alert" accessibilityLiveRegion="polite"><Note tone="error">{error}</Note></View> : null}

      {empty ? <View style={styles.empty} testID="drafts-empty"><T variant="heading">Nessuna bozza</T><T variant="small" color={S.mute}>Qui trovi le date selezionate e i dettagli ancora da salvare.</T></View> : null}

      {selection.length ? (
        <Section label="Date selezionate">
          <View style={styles.dates} testID="drafts-selection">
            {selection.map((date) => <T key={date} variant="data">{shortDate(date)}</T>)}
          </View>
          <Button label="Elimina date selezionate" kind="secondary" disabled={disabled} onPress={() => void discard(discardDraftSelection)} testID="drafts-clear-selection" accessibilityHint="Conserva i dettagli preparati per ogni attività" />
        </Section>
      ) : null}

      {prepared.length ? (
        <Section label="Dettagli per attività">
          {prepared.map((category) => (
            <View key={category.id} style={[styles.activity, { borderColor: S.faint }]} testID={`draft-${category.id}`}>
              <View style={styles.title}>
                <View style={[styles.dot, { backgroundColor: category.color }]} />
                <T variant="bodyStrong" style={{ flex: 1 }}>{category.name}</T>
              </View>
              <DraftDetails details={drafts[category.id].details!} />
              <Button label={`Elimina dettagli di ${category.name}`} kind="quiet" disabled={disabled} onPress={() => void discard(() => discardActivityDraft(category.id))} testID={`draft-delete-${category.id}`} accessibilityHint="Conserva le date selezionate e i dettagli delle altre attività" />
            </View>
          ))}
        </Section>
      ) : null}

      {!empty ? <Button label="Riprendi in Home" kind="secondary" disabled={disabled} onPress={() => { setPlace('lineup'); router.replace('/'); }} testID="drafts-resume" /> : null}

      {!empty && !confirmAll ? <Button label="Elimina tutte le bozze" kind="danger" disabled={disabled} onPress={() => setConfirmAll(true)} testID="drafts-clear-all" /> : null}
      {confirmAll ? (
        <View style={{ gap: 10 }} testID="drafts-confirmation">
          <Note>Eliminare le date selezionate e tutti i dettagli preparati? Le sessioni già registrate restano nella Storia.</Note>
          <Button label="Elimina tutte le bozze" kind="danger" disabled={disabled} onPress={() => void discard(discardAllDrafts)} testID="drafts-confirm-clear-all" />
          <Button label="Annulla" kind="secondary" disabled={busy} onPress={() => setConfirmAll(false)} testID="drafts-cancel-clear-all" />
        </View>
      ) : null}
    </Sheet>
  );
}

function DraftDetails({ details }: { details: SessionDetailsDraft }) {
  const S = useSurface();
  const timing = details.timing;
  const place = details.place;
  const clock = timing?.start ? `${timing.start}${timing.end ? `–${timing.end}${timing.endDayOffset ? ' (giorno dopo)' : ''}` : ''}${timing.timeZone ? ` · ${timing.timeZone}` : ''}` : null;
  const duration = timing?.declaredSec ? formatDuration(timing.declaredSec) : null;
  return (
    <View style={{ gap: 12 }}>
      {details.notes?.trim() ? <View style={{ gap: 3 }}><T variant="label" color={S.mute}>Note</T><T variant="body">{details.notes}</T></View> : null}
      {place && (place.label || place.address || place.mapUrl || place.coords) ? (
        <View style={{ gap: 3 }}>
          <T variant="label" color={S.mute}>Luogo</T>
          {place.label ? <T variant="body">{place.label}</T> : null}
          {place.address ? <T variant="small">{place.address}</T> : null}
          {place.mapUrl ? <T variant="small">{place.mapUrl}</T> : null}
          {place.coords ? <T variant="small">{formatCoords(place.coords)}</T> : null}
        </View>
      ) : null}
      {clock || duration ? <View style={{ gap: 3 }}><T variant="label" color={S.mute}>Orario e durata</T>{clock ? <T variant="body">{clock}</T> : null}{duration ? <T variant="body">{duration}</T> : null}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { gap: 8, paddingVertical: 20 },
  dates: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8 },
  activity: { gap: 12, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
