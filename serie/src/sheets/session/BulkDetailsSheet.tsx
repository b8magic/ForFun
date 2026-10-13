import { useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { Place } from '@/domain/types';
import { sameSessionVersion } from '@/domain/bulkDetails';
import { deviceTimeZone } from '@/domain/zoned';
import { DomainError } from '@/data/repositories';
import { useApp } from '@/state/store';
import { showToast, updateSelectedSessions } from '@/state/actions';
import { Button, Field, Note, Sheet } from '@/ui/controls';
import { T } from '@/ui/T';
import { useSurface } from '@/ui/useTheme';
import { KeyboardSafe } from '@/sheets/manage/parts';
import { placeSummary, timingSummary } from '@/places/time/format';
import { compareSessions } from '@/sheets/day/sessionOrder';
import { PlaceEditor } from './PlaceEditor';
import { TimingEditor } from './TimingEditor';
import { SheetScroll } from './SheetScroll';
import { datesSummary } from './drafts';
import { useConfirmDiscard } from './useConfirmDiscard';
import { commonDetails, evaluateBulkDetails, KEEP_DETAILS, type BulkField, type BulkOperation, type BulkOperations } from './bulkForm';

const close = () => router.canGoBack() ? router.back() : router.replace('/');
const labels: Record<BulkField, string> = { notes: 'Note', place: 'Luogo', timing: 'Orario e durata' };
const operationLabels: Record<BulkOperation, string> = { keep: 'Mantieni', set: 'Imposta', clear: 'Rimuovi' };

function BulkFieldChoice({ field, operation, onChange, summary, children, error, disabled }: {
  field: BulkField; operation: BulkOperation; onChange: (operation: BulkOperation) => void;
  summary: string; children: ReactNode; error?: string; disabled: boolean;
}) {
  const S = useSurface();
  return (
    <View style={{ gap: 8 }} testID={`bulk-${field}`}>
      <View style={styles.fieldHead}>
        <T variant="bodyStrong" color={S.fg}>{labels[field]}</T>
        <T variant="small" color={operation === 'clear' ? S.danger : S.mute} numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>
          {operation === 'clear' ? 'Da rimuovere' : operation === 'set' ? 'Per tutte le selezionate' : summary}
        </T>
      </View>
      <View style={[styles.choices, { borderColor: S.faint }]}>
        {(['keep', 'set', 'clear'] as const).map((choice) => (
          <Pressable key={choice} onPress={() => onChange(choice)} disabled={disabled} accessibilityRole="radio" aria-checked={operation === choice} aria-disabled={disabled} accessibilityLabel={`${labels[field]}: ${operationLabels[choice]}`} testID={`bulk-${field}-${choice}`} style={[styles.choice, { backgroundColor: choice === operation ? S.faint : 'transparent' }]}>
            <T variant="labelStrong" color={choice === 'clear' && operation === choice ? S.danger : S.fg}>{operationLabels[choice]}</T>
          </Pressable>
        ))}
      </View>
      {operation === 'set' ? children : null}
      {error ? <Note tone="error">{error}</Note> : null}
    </View>
  );
}

function errorText(error: unknown) {
  if (error instanceof DomainError) {
    if (['session_changed', 'session_missing', 'bulk_category_changed', 'bulk_selection_changed'].includes(error.code)) return 'La selezione è cambiata. Chiudi e seleziona di nuovo le sessioni.';
    if (error.code === 'timing_invalid_for_date') return `L’orario non è valido per ${datesSummary([error.message])}. Cambialo prima di salvare.`;
  }
  return 'Le modifiche non sono state salvate. Riprova.';
}

export function BulkDetailsSheet() {
  const S = useSurface();
  const deviceZone = useMemo(() => deviceTimeZone(), []);
  const [review] = useState(() => {
    const state = useApp.getState();
    const ids = new Set(state.bulkSelection);
    return {
      categoryId: state.activeId,
      category: state.categories.find((category) => category.id === state.activeId),
      sessions: state.sessions.filter((session) => ids.has(session.id) && session.categoryId === state.activeId).sort(compareSessions),
    };
  });
  const activeId = useApp((state) => state.activeId);
  const currentSessions = useApp((state) => state.sessions);
  const selection = useApp((state) => state.bulkSelection);
  const busy = useApp((state) => state.bulkSaving);
  const [common] = useState(() => commonDetails(review.sessions, deviceZone));
  const [operations, setOperations] = useState<BulkOperations>({ ...KEEP_DETAILS });
  const [notes, setNotes] = useState(common.notes);
  const [place, setPlace] = useState<Place | null>(common.place);
  const [timing, setTiming] = useState(common.timing);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const committing = useRef(false);
  const [completed, setCompleted] = useState(false);
  const evaluation = useMemo(() => evaluateBulkDetails(review.sessions, { operations, notes, place, timing }, deviceZone), [review.sessions, operations, notes, place, timing, deviceZone]);
  const stale = useMemo(() => {
    const current = new Map(currentSessions.map((session) => [session.id, session]));
    const selected = new Set(selection);
    return activeId !== review.categoryId || selected.size !== review.sessions.length || review.sessions.some((session) => !selected.has(session.id) || !current.has(session.id) || !sameSessionVersion(session, current.get(session.id)!));
  }, [activeId, currentSessions, selection, review]);
  const allowLeave = useConfirmDiscard(evaluation.dirty && !completed, { blocked: busy });
  const changeOperation = (field: BulkField, operation: BulkOperation) => { setOperations((current) => ({ ...current, [field]: operation })); setError(null); };
  const save = async () => {
    if (committing.current || !review.categoryId || stale) return;
    setAttempted(true);
    if (!evaluation.ok || !evaluation.dirty) { AccessibilityInfo.announceForAccessibility('Controlla i dettagli da modificare.'); return; }
    committing.current = true;
    setError(null);
    Keyboard.dismiss();
    try {
      const result = await updateSelectedSessions({ categoryId: review.categoryId, expected: review.sessions, patch: evaluation.patch });
      setCompleted(true);
      allowLeave();
      showToast(result.changed ? `${result.changed} ${result.changed === 1 ? 'sessione modificata' : 'sessioni modificate'}` : 'I dettagli erano già uguali.');
      close();
    } catch (failure) {
      const text = errorText(failure);
      setError(text);
      AccessibilityInfo.announceForAccessibility(text);
    } finally {
      committing.current = false;
    }
  };
  const dates = [...new Set(review.sessions.map((session) => session.date))];
  const first = review.sessions[0];
  const summaries = {
    notes: common.mixed.notes ? 'Valori diversi' : common.notes || 'Nessuna nota',
    place: common.mixed.place ? 'Valori diversi' : placeSummary(common.place) ?? 'Nessun luogo',
    timing: common.mixed.timing ? 'Valori diversi' : first ? timingSummary(first) : 'Nessun orario',
  };
  if (!first || !review.categoryId) return <Sheet title="Nessuna sessione selezionata" testID="bulk-empty"><Button label="Torna al calendario" onPress={close} /></Sheet>;
  return (
    <KeyboardSafe>
      <Sheet title={`Modifica ${review.sessions.length} ${review.sessions.length === 1 ? 'sessione' : 'sessioni'}`} eyebrow={`${review.category?.name ?? ''} · ${datesSummary(dates)}`} scroll={false} testID="bulk-details-sheet" footer={
        <View style={{ gap: 8 }}>
          {error ? <Note tone="error">{error}</Note> : null}
          {stale && !completed && !busy ? <Note tone="error">La selezione è cambiata. Chiudi e seleziona di nuovo le sessioni.</Note> : null}
          <Button label="Salva modifiche" onPress={() => void save()} disabled={!evaluation.dirty || stale} busy={busy} color={review.category?.color} testID="bulk-save" />
        </View>
      }>
        <SheetScroll testID="bulk-scroll">
          <T variant="small" color={S.mute}>Cambia solo i dettagli scelti.</T>
          <View pointerEvents={busy ? 'none' : 'auto'} style={{ gap: 24 }}>
            <BulkFieldChoice field="notes" operation={operations.notes} onChange={(operation) => changeOperation('notes', operation)} summary={summaries.notes} error={attempted ? evaluation.errors.notes : undefined} disabled={busy}>
              <Field value={notes} onChangeText={setNotes} multiline accessibilityLabel="Note per le sessioni selezionate" testID="bulk-notes-input" />
            </BulkFieldChoice>
            <BulkFieldChoice field="place" operation={operations.place} onChange={(operation) => changeOperation('place', operation)} summary={summaries.place} error={attempted ? evaluation.errors.place : undefined} disabled={busy}>
              <PlaceEditor value={place} onChange={setPlace} accent={review.category?.color ?? S.accent} testID="bulk-place-input" />
            </BulkFieldChoice>
            <BulkFieldChoice field="timing" operation={operations.timing} onChange={(operation) => changeOperation('timing', operation)} summary={summaries.timing} error={attempted ? evaluation.errors.timing : undefined} disabled={busy}>
              <TimingEditor date={first.date} value={timing} onChange={setTiming} deviceZone={deviceZone} showErrors={attempted} accent={review.category?.color ?? S.accent} testID="bulk-timing-input" />
              <T variant="small" color={S.mute}>Orario e durata valgono per ogni sessione.</T>
            </BulkFieldChoice>
          </View>
          {attempted && evaluation.badDates.length ? <Note tone="error">{`Controlla gli orari per ${datesSummary(evaluation.badDates)}.`}</Note> : null}
          {evaluation.ambiguousDates.length ? <Note tone="warn">{`Cambio dell’ora: per ${datesSummary(evaluation.ambiguousDates)} vale la prima occorrenza dell’orario.`}</Note> : null}
          <T variant="small" color={S.mute}>Gli eventi già nei calendari restano invariati.</T>
        </SheetScroll>
      </Sheet>
    </KeyboardSafe>
  );
}

const styles = StyleSheet.create({
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  choices: { flexDirection: 'row', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  choice: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
