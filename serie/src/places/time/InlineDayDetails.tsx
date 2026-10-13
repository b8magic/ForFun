import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import type { Category, LocalDate, Session } from '@/domain/types';
import { deleteSession, showToast } from '@/state/actions';
import { Button } from '@/ui/controls';
import { Chevron } from '@/ui/glyphs';
import { T } from '@/ui/T';
import { HIT } from '@/ui/theme';
import { useSurface } from '@/ui/useTheme';
import { t } from '@/i18n/it';
import { DaySessions } from './DaySessions';
import { dateLabel, timingSummary } from './format';

interface Props {
  date: LocalDate;
  sessions: readonly Session[];
  catById: ReadonlyMap<string, Category>;
  filterId: string | null;
  onClose: () => void;
  /** Reveal through the first session, or the entire empty state / confirmation. */
  onReveal: (start: View, end?: View) => void;
}

/** Saved sessions stay in the calendar's flow; only editing opens a route. */
export function InlineDayDetails({ date, sessions, catById, filterId, onClose, onReveal }: Props) {
  const C = useSurface();
  const panel = useRef<View>(null);
  const confirmation = useRef<View>(null);
  const revealed = useRef(false);
  const deletionInFlight = useRef(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteTarget = sessions.find((session) => session.id === deleteId);
  const activity = filterId ? catById.get(filterId) : null;
  const revealFirstRow = useCallback((row: View) => {
    if (!revealed.current && panel.current) {
      revealed.current = true;
      onReveal(panel.current, row);
    }
  }, [onReveal]);

  const askDelete = (session: Session) => {
    if (deletionInFlight.current) return;
    setDeleteError(null);
    setDeleteId(session.id);
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

  return (
    <View
      ref={panel}
      collapsable={false}
      onLayout={() => {
        if (!sessions.length && !revealed.current && panel.current) {
          revealed.current = true;
          onReveal(panel.current);
        }
      }}
      style={[styles.panel, { borderTopColor: C.line }]}
      testID="history-day-details"
    >
      <View style={styles.header} testID={`history-day-${date}`}>
        <T variant="bodyStrong" color={C.fg} accessibilityRole="header" style={styles.date}>
          {dateLabel(date, false)}
        </T>
        <Pressable
          onPress={onClose}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="Chiudi i dettagli del giorno"
          style={styles.close}
          testID="history-day-close"
        >
          <Chevron dir="up" color={C.mute} size={7} />
        </Pressable>
      </View>
      {sessions.length ? (
        <DaySessions date={date} sessions={sessions} catById={catById} showActivity={!filterId} showDate={false} preview interactive={!deleteTarget} onDelete={askDelete} onFirstRowLayout={revealFirstRow} />
      ) : (
        <View style={styles.empty} testID="history-day-empty">
          <T variant="bodyStrong" color={C.fg}>Nessuna sessione registrata</T>
          <T variant="small" color={C.mute}>
            {activity ? `Nessuna sessione di ${activity.name} in questa data.` : 'Scegli un altro giorno nel calendario.'}
          </T>
        </View>
      )}
      {deleteTarget ? (
        <View
          ref={confirmation}
          collapsable={false}
          onLayout={() => { if (confirmation.current) onReveal(confirmation.current); }}
          style={[styles.confirmation, { borderTopColor: C.faint }]}
          accessibilityLiveRegion="polite"
          testID="history-delete-confirm"
        >
          <T variant="bodyStrong" color={C.fg}>
            {[catById.get(deleteTarget.categoryId)?.name, timingSummary(deleteTarget)].filter(Boolean).join(' · ')}
          </T>
          <T variant="small" color={C.mute}>{t.deleteSessionConfirm}</T>
          {deleteError ? <T variant="small" color={C.danger} accessibilityLiveRegion="assertive">{deleteError}</T> : null}
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button label={t.cancel} kind="secondary" onPress={() => setDeleteId(null)} disabled={deleting} testID="history-delete-cancel" />
            </View>
            <View style={styles.action}>
              <Button label={t.delete} kind="danger" onPress={() => void remove()} busy={deleting} testID="history-delete-yes" />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 12, paddingTop: 8, borderTopWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  date: { flex: 1 },
  close: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  empty: { gap: 4, paddingTop: 8, paddingBottom: 12 },
  confirmation: { marginTop: 12, paddingTop: 16, gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
});
