import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { router } from 'expo-router';
import { T } from '@/ui/T';
import { Chevron } from '@/ui/glyphs';
import { foregroundOn } from '@/ui/theme';
import { useSurface } from '@/ui/useTheme';

interface Props {
  id: string;
  title: string;
  detail: string;
  color: string;
  interactive: boolean;
  accessibilityLabel: string;
  deleteLabel: string;
  onDelete?: () => void;
  onOpen: (row: SwipeableMethods) => void;
}

/** Swiping reveals an action. Only an explicit press can request deletion. */
export function DaySessionRow({ id, title, detail, color, interactive, accessibilityLabel, deleteLabel, onDelete, onOpen }: Props) {
  const C = useSurface();
  const swipeable = useRef<SwipeableMethods>(null);
  const [open, setOpen] = useState(false);
  const canDelete = interactive && !!onDelete;
  const askDelete = () => {
    swipeable.current?.close();
    onDelete?.();
  };
  const content = (
    <View style={[styles.row, { backgroundColor: C.bg, borderTopColor: C.faint }]}>
      <Pressable
        onPress={() => router.push(`/session/${id}`)}
        disabled={!interactive}
        accessibilityRole={interactive ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
        accessibilityActions={canDelete ? [{ name: 'delete', label: deleteLabel }] : undefined}
        onAccessibilityAction={(event) => { if (canDelete && event.nativeEvent.actionName === 'delete') askDelete(); }}
        style={styles.details}
        testID={`session-${id}`}
      >
        <View style={[styles.dot, { backgroundColor: color }]} />
        <View style={styles.copy}>
          <T variant="bodyStrong" color={C.fg}>{title}</T>
          <T variant="small" color={C.mute}>{detail}</T>
        </View>
        {interactive ? <Chevron dir="right" color={C.mute} size={7} /> : null}
      </Pressable>
      {canDelete ? (
        <Pressable
          onPress={askDelete}
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}
          accessibilityHint="Chiede conferma prima di eliminare"
          style={styles.deleteButton}
          testID={`day-delete-${id}`}
        >
          <TrashGlyph color={C.mute} />
        </Pressable>
      ) : null}
    </View>
  );
  // Archive and unsaved previews do not allocate gesture handlers for every row.
  if (!canDelete) return content;
  return (
    <Swipeable
      ref={swipeable}
      friction={1.4}
      rightThreshold={40}
      overshootLeft={false}
      overshootRight={false}
      enableTrackpadTwoFingerGesture
      onSwipeableWillOpen={() => {
        if (swipeable.current) onOpen(swipeable.current);
        setOpen(true);
      }}
      onSwipeableWillClose={() => setOpen(false)}
      renderRightActions={() => (
        <Pressable
          onPress={askDelete}
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}
          accessibilityHint="Chiede conferma prima di eliminare"
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
          aria-hidden={!open}
          style={[styles.revealedDelete, { backgroundColor: C.danger }]}
          testID={`day-swipe-delete-${id}`}
        >
          <T variant="bodyStrong" color={foregroundOn(C.danger)}>Elimina</T>
        </Pressable>
      )}
    >
      {content}
    </Swipeable>
  );
}

function TrashGlyph({ color }: { color: string }) {
  return (
    <View style={{ width: 18, height: 20 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ position: 'absolute', top: 6, left: 3, width: 12, height: 13, borderWidth: 1.4, borderTopWidth: 0, borderColor: color, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
      <View style={{ position: 'absolute', top: 3, left: 1, width: 16, height: 1.4, borderRadius: 1, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: 0, left: 6, width: 6, height: 4, borderWidth: 1.4, borderBottomWidth: 0, borderColor: color, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
      <View style={{ position: 'absolute', top: 8, left: 7, width: 1.2, height: 7, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: 8, left: 10, width: 1.2, height: 7, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  details: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10 },
  copy: { flex: 1, gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  deleteButton: { width: 44, minHeight: 44, marginLeft: 4, alignItems: 'center', justifyContent: 'center' },
  revealedDelete: { width: 92, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
