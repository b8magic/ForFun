import { useSurface, useThemedStyles } from '@/ui/useTheme';
/**
 * One export review row: the outgoing event for one session in one
 * destination. Edits here change the outgoing event only; "Applica anche alla
 * sessione" is the separate, explicit way to change the stored session.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ExternalEvent } from '@/calendar/types';
import type { ExportAction, ExportPlanRow, PlanDestination } from '@/calendar/exportEngine';
import { overrideToSessionPatch, type ApplyField } from '@/calendar/representation';
import { isWallTime } from '@/domain/zoned';
import { isLocalDate } from '@/domain/dates';
import { updateSession } from '@/state/actions';
import { Button, Field, Note, Segmented } from '@/ui/controls';
import { T } from '@/ui/T';
import { HIT, type Surface } from '@/ui/theme';
import { t } from '@/i18n/it';
import { errorText } from '@/sheets/manage/helpers';
import { Check, longDateIt, Pill } from './parts';
import { ACTION_LABEL, clearOverride, setOverride, tapIntent, type DestSettings } from './exportModel';

const STATUS_TONE: Record<ExportPlanRow['status'], 'good' | 'warn' | 'neutral' | 'bad' | 'accent'> = {
  ready: 'good',
  already_exported: 'neutral',
  linked_changed: 'warn',
  recognized: 'neutral',
  possible_duplicate: 'warn',
  not_checked: 'warn',
  pending_representation: 'warn',
  invalid: 'bad',
  not_writable: 'bad',
};
const STATUS_LABEL: Record<ExportPlanRow['status'], string> = {
  ready: t.exportStatusReady,
  already_exported: t.exportStatusAlready,
  linked_changed: t.exportStatusLinkedChanged,
  recognized: 'Evento riconosciuto',
  possible_duplicate: 'Possibile doppione',
  not_checked: 'Non verificato',
  pending_representation: 'In attesa',
  invalid: 'Da correggere',
  not_writable: 'Sola lettura',
};

function eventWhen(e: { allDay: boolean; start: { date: string; time: string | null }; end: { date: string; time: string | null } }): string {
  if (e.allDay) return `${longDateIt(e.start.date)} · ${t.allDay.toLowerCase()}`;
  const end = e.end.time ? `–${e.end.time}${e.end.date !== e.start.date ? ` (${longDateIt(e.end.date)})` : ''}` : '';
  return `${longDateIt(e.start.date)} · ${e.start.time ?? ''}${end}`;
}

export function ExportRow({
  row: r,
  dest,
  settings,
  categoryName,
  color,
  open,
  onExpand,
  onChoice,
  onEdit,
  linked,
}: {
  row: ExportPlanRow;
  dest: PlanDestination;
  settings: DestSettings;
  categoryName: string;
  color: string;
  open: boolean;
  onExpand: () => void;
  onChoice: (c: { selected?: boolean; action?: ExportAction; linkTargetEventId?: string }) => void;
  onEdit: (fn: (s: DestSettings) => DestSettings) => void;
  linked: boolean;
}) {
  const S = useSurface();
  const styles = useThemedStyles(createStyles);
  const rep = r.representation;
  const ov = settings.overrides[r.session.id] ?? {};
  const existing: ExternalEvent | null = r.duplicate.event ?? r.duplicate.candidates.find((c) => c.event.eventId === r.linkTargetEventId)?.event ?? r.duplicate.candidates[0]?.event ?? null;
  const when = r.draft ? eventWhen(r.draft) : longDateIt(rep.outgoingDate);
  const intent = tapIntent(r);
  const a11y = [r.title.final, STATUS_LABEL[r.status], when, `durata attività ${r.durationLabel}`, r.selected ? 'selezionata' : 'non selezionata'].join(', ');

  const onTap = () => {
    if (intent.kind === 'toggle') onChoice({ selected: intent.selected });
    else if (intent.kind === 'action') onChoice({ action: intent.action, selected: true });
    else onExpand();
  };

  return (
    <View style={styles.item} testID={`export-row-${r.session.id}`}>
      <Pressable onPress={onTap} accessibilityRole="checkbox" aria-checked={r.selected} accessibilityLabel={a11y} style={styles.main} testID={`export-toggle-${r.session.id}`}>
        <View style={{ paddingTop: 2 }}>
          <Check on={r.selected} color={color} disabled={r.allowedActions.every((a) => a === 'skip')} />
        </View>
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <T variant="bodyStrong" color={S.fg} numberOfLines={2}>
            {r.title.final}
          </T>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Pill text={STATUS_LABEL[r.status].toUpperCase()} tone={STATUS_TONE[r.status]} />
            {r.action !== r.defaultAction || r.action !== 'create' ? <Pill text={ACTION_LABEL[r.action].toUpperCase()} tone="accent" /> : null}
          </View>
          <T variant="data" color={S.fg}>
            {when}
          </T>
          <T variant="small" color={r.session.timing.durationSec != null ? S.fg : S.mute}>
            {`Durata attività: ${r.durationLabel}`}
          </T>
          {rep.status === 'ready' && rep.schedulingPlaceholder && rep.spanMin ? (
            <T variant="small" color={S.warning}>
              {`Nel calendario: ${rep.spanMin} min solo di pianificazione`}
            </T>
          ) : null}
          <T variant="small" color={S.mute}>
            {rep.disclosure}
          </T>
          {r.draft?.location ? (
            <T variant="small" color={S.mute} numberOfLines={2}>
              {`Luogo: ${r.draft.location}`}
            </T>
          ) : null}
          {r.draft?.notes ? (
            <T variant="small" color={S.mute} numberOfLines={open ? undefined : 2}>
              {`Descrizione: ${r.draft.notes}`}
            </T>
          ) : null}
          <T variant="label" color={S.mute} numberOfLines={1}>
            {`${categoryName.toUpperCase()}  →  ${dest.calendar.title.toUpperCase()}`}
          </T>
          {r.reason && r.status !== 'ready' ? (
            <T variant="small" color={STATUS_TONE[r.status] === 'warn' ? S.warning : S.mute}>
              {r.reason}
            </T>
          ) : null}
          {r.detail ? (
            <T variant="small" color={S.mute}>
              {r.detail}
            </T>
          ) : null}
        </View>
      </Pressable>
      <Pressable onPress={onExpand} accessibilityRole="button" accessibilityLabel={open ? 'Chiudi modifica' : 'Modifica e dettagli'} style={styles.expand} testID={`export-expand-${r.session.id}`}>
        <T variant="label" color={S.accent}>
          {open ? 'CHIUDI' : intent.kind === 'decide' ? 'DECIDI' : 'MODIFICA'}
        </T>
      </Pressable>
      {open ? <RowEditor r={r} existing={existing} ov={ov} settings={settings} categoryName={categoryName} onChoice={onChoice} onEdit={onEdit} linked={linked} /> : null}
    </View>
  );
}

function RowEditor({
  r,
  existing,
  ov,
  settings,
  categoryName,
  onChoice,
  onEdit,
  linked,
}: {
  r: ExportPlanRow;
  existing: ExternalEvent | null;
  ov: NonNullable<DestSettings['overrides'][string]>;
  settings: DestSettings;
  categoryName: string;
  onChoice: (c: { selected?: boolean; action?: ExportAction; linkTargetEventId?: string }) => void;
  onEdit: (fn: (s: DestSettings) => DestSettings) => void;
  linked: boolean;
}) {
  const S = useSurface();
  const styles = useThemedStyles(createStyles);
  const id = r.session.id;
  const [base, setBase] = useState(ov.baseTitle ?? '');
  const [notes, setNotes] = useState(ov.notes !== undefined ? (ov.notes ?? '') : (r.session.notes ?? ''));
  const [date, setDate] = useState(ov.date ?? '');
  const [time, setTime] = useState(ov.time?.start ?? '');
  const [span, setSpan] = useState(ov.time?.spanMin != null ? String(ov.time.spanMin) : '');
  const [applyMsg, setApplyMsg] = useState<{ tone: 'neutral' | 'error'; text: string } | null>(null);
  const needsTime = r.session.timing.state !== 'interval' && r.session.timing.state !== 'start_duration';

  const commitTime = (tv: string, sv: string) => {
    if (!tv.trim()) return onEdit((s) => setOverride(s, id, 'time', undefined));
    if (!isWallTime(tv.trim())) return;
    const m = Number(sv);
    onEdit((s) => setOverride(s, id, 'time', { start: tv.trim(), spanMin: Number.isInteger(m) && m > 0 ? m : null }));
  };

  const apply = async (fields: ApplyField[]) => {
    const res = overrideToSessionPatch(r.session, settings.overrides[id] ?? {}, fields);
    if (!res.ok) return setApplyMsg({ tone: 'error', text: 'Valore non valido: controlla il campo.' });
    if (!res.applied.length) return setApplyMsg({ tone: 'neutral', text: 'Nessuna differenza dalla sessione.' });
    try {
      await updateSession(id, res.patch);
      setApplyMsg({ tone: 'neutral', text: `Sessione aggiornata (${res.applied.map((f) => ({ notes: 'note', location: 'luogo', date: 'data', time: 'orario' })[f]).join(', ')}).` });
    } catch (e) {
      setApplyMsg({ tone: 'error', text: errorText(e) });
    }
  };

  return (
    <View style={styles.editor}>
      {r.allowedActions.length > 1 ? (
        <View style={{ gap: 6 }}>
          <T variant="label" color={S.mute}>
            AZIONE
          </T>
          <Segmented value={r.action} onChange={(a) => onChoice({ action: a, selected: a !== 'skip' })} options={r.allowedActions.map((a) => ({ key: a, label: ACTION_LABEL[a] }))} testID={`export-action-${id}`} />
          {r.action === 'update' ? <Note tone="warn">L’evento collegato verrà sovrascritto con la proposta qui sotto. Controlla le differenze.</Note> : null}
          {r.action === 'create' && (r.status === 'possible_duplicate' || r.status === 'recognized') ? <Note tone="warn">Verrà creato un evento separato, anche se ne esiste uno simile.</Note> : null}
        </View>
      ) : null}

      {existing ? (
        <View style={styles.compare}>
          <View style={styles.compareCol}>
            <T variant="label" color={S.mute}>
              {t.existingEvent.toUpperCase()}
            </T>
            <T variant="small" color={S.fg}>
              {existing.title}
            </T>
            <T variant="small" color={S.mute}>
              {eventWhen(existing)}
            </T>
            {existing.notes ? (
              <T variant="small" color={S.mute} numberOfLines={3}>
                {existing.notes}
              </T>
            ) : null}
          </View>
          <View style={styles.compareCol}>
            <T variant="label" color={S.mute}>
              {t.proposedEvent.toUpperCase()}
            </T>
            <T variant="small" color={S.fg}>
              {r.title.final}
            </T>
            <T variant="small" color={S.mute}>
              {r.draft ? eventWhen(r.draft) : r.representation.disclosure}
            </T>
            {r.duplicate.differences.length ? (
              <T variant="small" color={S.warning}>
                {`Differenze: ${r.duplicate.differences.map((f) => ({ title: 'titolo', notes: 'note', location: 'luogo', time: 'orario', timing: 'tipo di orario' })[f]).join(', ')}`}
              </T>
            ) : null}
          </View>
        </View>
      ) : null}
      {r.duplicate.candidates.length > 1 && r.action === 'link' ? (
        <View style={{ gap: 4 }}>
          <T variant="label" color={S.mute}>
            EVENTO DA COLLEGARE
          </T>
          {r.duplicate.candidates.map((c) => (
            <Pressable key={c.event.eventId + (c.event.occurrenceKey ?? '')} onPress={() => onChoice({ linkTargetEventId: c.event.eventId })} accessibilityRole="radio" aria-checked={r.linkTargetEventId === c.event.eventId} style={styles.candidate}>
              <View style={[styles.dot, r.linkTargetEventId === c.event.eventId && { backgroundColor: S.accent }]} />
              <T variant="small" color={S.fg} style={{ flex: 1 }}>
                {`${c.event.title} · ${eventWhen(c.event)}`}
              </T>
            </Pressable>
          ))}
        </View>
      ) : null}

      <T variant="label" color={S.mute}>
        {`SOLO PER L’EVENTO ESPORTATO${linked ? ' · ENTRAMBE LE DESTINAZIONI' : ''}`}
      </T>
      <Field
        label={t.baseTitle}
        value={base}
        placeholder={categoryName}
        onChangeText={(v) => {
          setBase(v);
          onEdit((s) => setOverride(s, id, 'baseTitle', v.trim() ? v : undefined));
        }}
        autoCorrect={false}
        testID={`export-base-${id}`}
      />
      <T variant="small" color={S.mute}>
        {`Titolo finale: ${r.title.final}`}
      </T>
      {settings.includeNotes ? (
        <Field
          label="Note dell’evento"
          value={notes}
          multiline
          onChangeText={(v) => {
            setNotes(v);
            onEdit((s) => setOverride(s, id, 'notes', v === (r.session.notes ?? '') ? undefined : v));
          }}
          testID={`export-notes-${id}`}
        />
      ) : (
        <Note>Le note sono escluse per questa esportazione.</Note>
      )}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Data evento"
            value={date}
            placeholder={r.session.date}
            onChangeText={(v) => {
              setDate(v);
              onEdit((s) => setOverride(s, id, 'date', isLocalDate(v.trim()) && v.trim() !== r.session.date ? v.trim() : undefined));
            }}
            autoCapitalize="none"
            testID={`export-date-${id}`}
          />
        </View>
        {needsTime ? (
          <>
            <View style={{ flex: 1 }}>
              <Field
                label="Ora (solo calendario)"
                value={time}
                placeholder="hh:mm"
                onChangeText={(v) => {
                  setTime(v);
                  commitTime(v, span);
                }}
                autoCapitalize="none"
                testID={`export-time-${id}`}
              />
            </View>
            <View style={{ width: 82 }}>
              <Field
                label="Min"
                value={span}
                placeholder="60"
                keyboardType="number-pad"
                onChangeText={(v) => {
                  setSpan(v);
                  commitTime(time, v);
                }}
                testID={`export-spanmin-${id}`}
              />
            </View>
          </>
        ) : null}
      </View>
      {needsTime ? <Note>Un orario scelto qui vale solo per il calendario: la sessione resta com’è e la sua durata non cambia.</Note> : null}
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Button kind="quiet" label={t.resetTitle.replace('titolo', 'evento')} onPress={() => (setBase(''), setNotes(r.session.notes ?? ''), setDate(''), setTime(''), setSpan(''), onEdit((s) => clearOverride(s, id)))} testID={`export-reset-${id}`} />
        <Button kind="secondary" label={t.applyToSession} onPress={() => apply(['notes', 'date', 'time'])} testID={`export-apply-${id}`} accessibilityHint="Modifica la sessione salvata con note, data e orario scelti qui." />
      </View>
      {applyMsg ? <Note tone={applyMsg.tone === 'error' ? 'error' : 'neutral'}>{applyMsg.text}</Note> : null}
    </View>
  );
}

const createStyles = (S: Surface) => StyleSheet.create({
  item: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: S.faint, paddingVertical: 12, gap: 6 },
  main: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  expand: { alignSelf: 'flex-start', marginLeft: 36, minHeight: HIT, justifyContent: 'center' },
  editor: { marginLeft: 36, gap: 12, paddingTop: 4, paddingBottom: 6 },
  compare: { flexDirection: 'row', gap: 12 },
  compareCol: { flex: 1, gap: 3, padding: 10, borderRadius: 10, backgroundColor: S.raised },
  candidate: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.2, borderColor: S.mute },
});
