/** Menu rows: a contents list set in the display face, details in mono. */
import { Pressable, StyleSheet, View } from 'react-native';
import { palette, surfaces } from '@/ui/theme';
import { T } from '@/ui/T';
import { Caret } from './parts';

const S = surfaces.night;

export function MenuItem({ title, detail, onPress, testID }: { title: string; detail?: string | null; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      testID={testID}
      style={({ pressed }) => [styles.item, pressed && { opacity: 0.66 }]}
    >
      <T variant="heading" color={S.fg} style={{ flexShrink: 1 }} numberOfLines={1}>
        {title}
      </T>
      <View style={styles.right}>
        {detail ? (
          <T variant="label" color={S.mute} numberOfLines={1}>
            {detail}
          </T>
        ) : null}
        <Caret dir="right" color={S.mute} size={7} />
      </View>
    </Pressable>
  );
}

/** One-line status with a flare dot (e.g. pending calendar exports). */
export function StatusLine({ text, action, onPress, testID }: { text: string; action: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${text}. ${action}`} testID={testID} style={({ pressed }) => [styles.status, pressed && { opacity: 0.7 }]}>
      <View style={styles.dot} />
      <T variant="small" color={S.fg} style={{ flex: 1 }}>
        {text}
      </T>
      <T variant="labelStrong" color={palette.flare}>
        {action}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 62, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: S.faint },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,77,31,0.45)' },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: palette.flare },
});
