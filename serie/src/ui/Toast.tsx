/** Product-voice confirmations (e.g. "4 sessioni salvate · Surf" with Annulla). */
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/state/store';
import { dismissToast } from '@/state/actions';
import { palette } from './theme';
import { T } from './T';

export function Toast() {
  const toast = useApp((s) => s.toast);
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  return (
    <Animated.View key={toast.id} entering={FadeInDown.duration(260)} exiting={FadeOutDown.duration(200)} style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) + 150 }]} accessibilityLiveRegion="polite" testID="toast">
      <Pressable style={styles.body} onPress={dismissToast} accessibilityRole="alert">
        <T variant="small" color={toast.tone === 'error' ? palette.danger : palette.foam} style={{ flex: 1 }} numberOfLines={2}>
          {toast.text}
        </T>
        {toast.action ? (
          <Pressable
            onPress={() => {
              toast.action?.run();
              dismissToast();
            }}
            accessibilityRole="button"
            hitSlop={10}
            style={styles.action}
          >
            <T variant="labelStrong" color={palette.flare}>
              {toast.action.label}
            </T>
          </Pressable>
        ) : null}
      </Pressable>
      <View />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 50 },
  body: { minHeight: 48, borderRadius: 14, backgroundColor: palette.ink3, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(238,232,218,0.16)' },
  action: { paddingVertical: 6, paddingHorizontal: 4 },
});
