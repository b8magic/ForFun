import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import type { Category, LocalDate, Session } from '@/domain/types';
import { deleteSession } from '@/state/actions';
import { Chevron } from '@/ui/glyphs';
import { T } from '@/ui/T';
import { HIT } from '@/ui/theme';
import { useSurface } from '@/ui/useTheme';
import { t } from '@/i18n/it';
import { DaySessions } from './DaySessions';
import { dateLabel } from './format';

interface Props {
  date: LocalDate;
  sessions: readonly Session[];
  catById: ReadonlyMap<string, Category>;
  filterId: string | null;
  onClose: () => void;
  /** Reveal through the first session, or the entire empty state. */
  onReveal: (start: View, end?: View) => void;
}

/** Saved sessions stay in the calendar's flow; only editing opens a route. */
export function InlineDayDetails({ date, sessions, catById, filterId, onClose, onReveal }: Props) {
  const C = useSurface();
  const panel = useRef<View>(null);
  const revealed = useRef(false);
  const deletionInFlight = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const activity = filterId ? catById.get(filterId) : null;
  const revealFirstRow = useCallback((row: View) => {
    if (!revealed.current && panel.current) {
      revealed.current = true;
      onReveal(panel.current, row);
    }
  }, [onReveal]);

  const remove = async (id: string) => {
    if (deletionInFlight.current) return;
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
      {deleting ? <T variant="small" color={C.mute} accessibilityLiveRegion="polite" testID="history-delete-busy">Eliminazione…</T> : null}
      {deleteError ? <T variant="small" color={C.danger} accessibilityLiveRegion="assertive" testID="history-delete-error">{deleteError}</T> : null}
      {sessions.length ? (
        <DaySessions date={date} sessions={sessions} catById={catById} showActivity={!filterId} showDate={false} preview interactive={!deleting} onDelete={(session) => void remove(session.id)} onFirstRowLayout={revealFirstRow} />
      ) : (
        <View style={styles.empty} testID="history-day-empty">
          <T variant="bodyStrong" color={C.fg}>Nessuna sessione registrata</T>
          <T variant="small" color={C.mute}>
            {activity ? `Nessuna sessione di ${activity.name} in questa data.` : 'Scegli un altro giorno nel calendario.'}
          </T>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 12, paddingTop: 8, borderTopWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  date: { flex: 1 },
  close: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  empty: { gap: 4, paddingTop: 8, paddingBottom: 12 },
});
