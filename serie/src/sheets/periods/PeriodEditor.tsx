import { useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View, type ScrollView } from 'react-native';
import type { Category, NamedPeriod, Session } from '@/domain/types';
import { sessionsForNamedPeriod } from '@/domain/namedPeriods';
import { summarize } from '@/domain/stats';
import { isLocalDate } from '@/domain/dates';
import { DomainError } from '@/data/repositories';
import { createNamedPeriod, showToast, updateNamedPeriod } from '@/state/actions';
import { useMotionReduced } from '@/state/selectors';
import { useSurface } from '@/ui/useTheme';
import { Button, Field, Note, Section, Sheet } from '@/ui/controls';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { dateLabel } from '@/places/time/format';
import { closeSheet, FooterPair, KeyboardSafe } from '@/sheets/manage/parts';
import { SheetScroll } from '@/sheets/session/SheetScroll';
import { confirmDiscard, useConfirmDiscard } from '@/sheets/session/useConfirmDiscard';
import { evaluatePeriodDraft, samePeriodDraft, type PeriodDraft } from './model';
import { PeriodMosaic } from './PeriodMosaic';
import { PeriodSessionsPreview } from './PeriodSessions';
import { PeriodSummary } from './PeriodSummary';

const DISCARD_COPY = { title: 'Modifiche non salvate', body: 'Se esci adesso, le modifiche a questo periodo andranno perse.' };

function saveErrorText(error: unknown): string {
  if (!(error instanceof DomainError)) return t.errorGeneric;
  const messages: Record<string, string> = {
    name_required: 'Scrivi un nome per il periodo.',
    name_too_long: 'Il nome può avere al massimo 80 caratteri.',
    invalid_date: 'Controlla le date del periodo.',
    invalid_range: 'La fine non può precedere l’inizio.',
    invalid_scope: 'Scegli le attività da includere.',
    categories_required: 'Scegli almeno un’attività, oppure tutte le attività.',
    category_missing: 'Un’attività non è più disponibile. Aggiorna la scelta delle attività.',
    period_missing: 'Questo periodo non è più disponibile.',
  };
  return messages[error.code] ?? t.errorGeneric;
}

export function PeriodEditor({ period, initialDraft, categories, sessions, onSaved, onCancel }: {
  period?: NamedPeriod;
  initialDraft: PeriodDraft;
  categories: readonly Category[];
  sessions: readonly Session[];
  onSaved: (period: NamedPeriod) => void;
  onCancel: () => void;
}) {
  const C = useSurface();
  const [baseline] = useState(initialDraft);
  const [draft, setDraft] = useState(initialDraft);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef({ dates: 0, activities: 0 });
  const reduced = useMotionReduced();
  const evaluation = useMemo(() => evaluatePeriodDraft(draft, categories, period), [draft, categories, period]);
  const { startDate, endDate, scope, categoryIds } = draft;
  const preview = useMemo(() => evaluatePeriodDraft({ name: 'Anteprima', startDate, endDate, scope, categoryIds, note: '' }, categories, period).preview, [startDate, endDate, scope, categoryIds, categories, period]);
  const matches = useMemo(() => preview ? sessionsForNamedPeriod(sessions, preview) : [], [sessions, preview]);
  const summary = useMemo(() => summarize(matches), [matches]);
  const dirty = !samePeriodDraft(draft, baseline);
  useConfirmDiscard(dirty, { ...DISCARD_COPY, blocked: busy });

  const change = <K extends keyof PeriodDraft>(key: K, value: PeriodDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  };
  const cancel = () => {
    if (inFlight.current) return;
    if (dirty) confirmDiscard(onCancel, DISCARD_COPY);
    else onCancel();
  };
  const save = async () => {
    if (inFlight.current) return;
    setAttempted(true);
    setError(null);
    if (!evaluation.valid) {
      const y = evaluation.errors.name ? 0 : evaluation.errors.startDate || evaluation.errors.endDate ? fieldY.current.dates : fieldY.current.activities;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: !reduced });
      AccessibilityInfo.announceForAccessibility('Controlla il nome, le date e le attività del periodo.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const saved = period
        ? await updateNamedPeriod(period.id, evaluation.patch)
        : await createNamedPeriod(evaluation.input);
      showToast(period ? 'Periodo aggiornato' : 'Periodo creato');
      onSaved(saved);
    } catch (failure) {
      const message = saveErrorText(failure);
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
      inFlight.current = false;
      setBusy(false);
    }
  };
  const selected = new Set(draft.categoryIds);
  const toggleActivity = (id: string) => {
    if (inFlight.current) return;
    setDraft((current) => ({
      ...current,
      categoryIds: current.categoryIds.includes(id) ? current.categoryIds.filter((candidate) => candidate !== id) : [...current.categoryIds, id],
    }));
    setError(null);
  };

  return (
    <KeyboardSafe>
      <Sheet
        title={period ? 'Modifica periodo' : 'Nuovo periodo'}
        onBack={cancel}
        backLabel={period ? 'Torna al periodo' : 'Torna ai periodi'}
        onClose={() => { if (!inFlight.current) closeSheet(); }}
        scroll={false}
        testID="period-form"
        footer={
          <View style={{ gap: 10 }}>
            {error ? <Note tone="error">{error}</Note> : null}
            {attempted && !evaluation.valid ? <Note tone="error">Controlla i campi indicati prima di salvare.</Note> : null}
            <FooterPair
              secondary={<Button label="Annulla" kind="secondary" onPress={cancel} disabled={busy} testID="period-cancel" />}
              primary={<Button label="Salva periodo" onPress={() => void save()} busy={busy} testID="period-save" />}
            />
          </View>
        }
      >
        <SheetScroll ref={scrollRef} testID="period-form-scroll">
          <Field
            label="Nome"
            value={draft.name}
            onChangeText={(value) => change('name', value)}
            placeholder="Viaggio in Portogallo"
            maxLength={80}
            editable={!busy}
            autoCapitalize="sentences"
            error={attempted ? evaluation.errors.name : null}
            accessibilityHint="Al massimo 80 caratteri"
            testID="period-name"
          />

          <View style={styles.dates} onLayout={(e) => (fieldY.current.dates = e.nativeEvent.layout.y)}>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Field
                label="Inizio"
                value={draft.startDate}
                onChangeText={(value) => change('startDate', value)}
                placeholder="AAAA-MM-GG"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                autoCorrect={false}
                editable={!busy}
                error={attempted ? evaluation.errors.startDate : null}
                testID="period-start"
              />
              {isLocalDate(draft.startDate) ? <T variant="small" color={C.mute}>{dateLabel(draft.startDate)}</T> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Field
                label="Fine"
                value={draft.endDate}
                onChangeText={(value) => change('endDate', value)}
                placeholder="AAAA-MM-GG"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                autoCorrect={false}
                editable={!busy}
                error={attempted ? evaluation.errors.endDate : null}
                testID="period-end"
              />
              {isLocalDate(draft.endDate) ? <T variant="small" color={C.mute}>{dateLabel(draft.endDate)}</T> : null}
            </View>
          </View>

          <View onLayout={(e) => (fieldY.current.activities = e.nativeEvent.layout.y)}><Section label="Attività incluse">
            <View accessibilityRole="radiogroup">
              <ScopeChoice
                title="Tutte le attività"
                detail="Comprende anche le attività aggiunte in seguito."
                on={draft.scope === 'all'}
                onPress={() => change('scope', 'all')}
                disabled={busy}
                testID="period-scope-all"
              />
              <ScopeChoice
                title="Scegli attività"
                detail="Solo le attività selezionate."
                on={draft.scope === 'selected'}
                onPress={() => change('scope', 'selected')}
                disabled={busy}
                testID="period-scope-selected"
              />
            </View>
            {draft.scope === 'selected' ? (
              <View style={{ gap: 4 }}>
                {evaluation.preservesEmptySelection ? <Note>Le attività di questo periodo non sono più disponibili. Puoi conservarlo vuoto o scegliere nuove attività.</Note> : null}
                {categories.map((category) => (
                  <Pressable
                    key={category.id}
                    onPress={() => toggleActivity(category.id)}
                    disabled={busy}
                    accessibilityRole="checkbox"
                    aria-checked={selected.has(category.id)}
                    accessibilityLabel={category.name}
                    testID={`period-activity-${category.id}`}
                    style={[styles.activity, { borderBottomColor: C.faint, opacity: busy ? 0.5 : 1 }]}
                  >
                    <View style={[styles.check, { borderColor: C.mute, backgroundColor: selected.has(category.id) ? C.fg : 'transparent' }]}>
                      {selected.has(category.id) ? <T color={C.bg} style={{ fontSize: 14, lineHeight: 18 }} accessible={false}>✓</T> : null}
                    </View>
                    <View style={[styles.dot, { backgroundColor: category.color, borderColor: C.faint }]} />
                    <T color={C.fg} style={{ flex: 1 }}>{category.name}</T>
                  </Pressable>
                ))}
                {!categories.length ? <T color={C.mute}>Nessuna attività disponibile.</T> : null}
                {attempted && evaluation.errors.scope ? <T variant="small" color={C.danger} accessibilityLiveRegion="polite">{evaluation.errors.scope}</T> : null}
              </View>
            ) : null}
          </Section></View>

          <Field
            label="Nota (facoltativa)"
            value={draft.note}
            onChangeText={(value) => change('note', value)}
            placeholder="Un ricordo di questo periodo"
            multiline
            editable={!busy}
            testID="period-note"
          />

          <Section label="Anteprima" hint="Le sessioni tra inizio e fine sono incluse automaticamente. Il periodo si aggiorna quando modifichi le sessioni.">
            <View style={{ gap: 18 }} testID="period-preview">
              {preview ? (
                <>
                  <PeriodSummary summary={summary} testID="period-preview-summary" />
                  <PeriodMosaic startDate={preview.startDate} endDate={preview.endDate} sessions={matches} categories={categories} />
                  <PeriodSessionsPreview sessions={matches} categories={categories} />
                </>
              ) : (
                <T color={C.mute}>Scegli un intervallo valido e le attività per vedere le sessioni incluse.</T>
              )}
            </View>
          </Section>
        </SheetScroll>
      </Sheet>
    </KeyboardSafe>
  );
}

function ScopeChoice({ title, detail, on, onPress, disabled, testID }: {
  title: string;
  detail: string;
  on: boolean;
  onPress: () => void;
  disabled: boolean;
  testID: string;
}) {
  const C = useSurface();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      aria-checked={on}
      accessibilityLabel={`${title}. ${detail}`}
      testID={testID}
      style={[styles.scope, { opacity: disabled ? 0.5 : 1 }]}
    >
      <View style={[styles.radio, { borderColor: on ? C.fg : C.mute }]}>
        {on ? <View style={[styles.radioFill, { backgroundColor: C.fg }]} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="bodyStrong" color={C.fg}>{title}</T>
        <T variant="small" color={C.mute}>{detail}</T>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dates: { flexDirection: 'row', gap: 18, alignItems: 'flex-start' },
  scope: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 58, paddingVertical: 8 },
  radio: { width: 20, height: 20, borderWidth: 1.5, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  radioFill: { width: 10, height: 10, borderRadius: 5 },
  activity: { minHeight: 48, flexDirection: 'row', gap: 12, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  check: { width: 20, height: 20, borderWidth: 1, borderRadius: 5, justifyContent: 'center', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth },
});
