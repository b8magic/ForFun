import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/state/store';
import { clearBulkSelection, setHomeSessionMode } from '@/state/actions';
import { T } from '@/ui/T';
import { Button } from '@/ui/controls';
import { useSurface } from '@/ui/useTheme';

export function HomeSessionModes() {
  const S = useSurface();
  const mode = useApp((state) => state.homeSessionMode);
  const busy = useApp((state) => state.bulkSaving || state.saving);
  return <View style={[styles.modes, { borderColor: S.faint }]} testID="home-session-modes">
    {(['new', 'edit'] as const).map((choice) => <Pressable key={choice} onPress={() => { if (choice !== mode) setHomeSessionMode(choice); }} disabled={busy} accessibilityRole="radio" accessibilityLabel={choice === 'new' ? 'Registra nuove sessioni' : 'Modifica sessioni già registrate'} aria-checked={mode === choice} aria-disabled={busy} testID={`home-mode-${choice}`} style={[styles.mode, { backgroundColor: mode === choice ? S.faint : 'transparent' }]}><T variant="labelStrong" color={mode === choice ? S.fg : S.mute}>{choice === 'new' ? '+ Nuove' : '✎ Modifica'}</T></Pressable>)}
  </View>;
}

export function HomeBulkControls({ count, dayCount, color }: { count: number; dayCount: number; color: string }) {
  const S = useSurface();
  const busy = useApp((state) => state.bulkSaving);
  return <View testID="home-bulk-controls">
    <View style={styles.summary}>
      <T variant="small" color={S.mute} testID="bulk-selection-count">{dayCount ? `${count} ${count === 1 ? 'sessione' : 'sessioni'} · ${dayCount} ${dayCount === 1 ? 'giorno' : 'giorni'}` : 'Seleziona i giorni'}</T>
      {dayCount ? <View style={{ flexDirection: 'row', gap: 16 }}><Pressable onPress={() => router.push('/bulk-day')} disabled={busy} accessibilityRole="button" accessibilityLabel="Scegli le sessioni dei giorni selezionati" testID="selected-day-sessions" style={styles.clear}><T variant="label" color={S.fg}>Sessioni</T></Pressable><Pressable onPress={clearBulkSelection} disabled={busy} accessibilityRole="button" accessibilityLabel="Svuota le date selezionate" testID="bulk-clear-selection" style={styles.clear}><T variant="label" color={S.mute}>Svuota</T></Pressable></View> : null}
    </View>
    <Button label={count ? `Modifica ${count} ${count === 1 ? 'sessione' : 'sessioni'}` : 'Modifica sessioni'} color={color} disabled={!count || busy} onPress={() => router.push('/bulk')} testID="bulk-edit" />
  </View>;
}

const styles = StyleSheet.create({
  modes: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  mode: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  summary: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  clear: { minHeight: 44, justifyContent: 'center' },
});
