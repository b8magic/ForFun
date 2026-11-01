/** Product-voice confirmations (e.g. "4 sessioni salvate · Surf" with Annulla). */
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { useMotionReduced } from '@/state/selectors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/state/store';
import { dismissToast, setScreenReaderActive } from '@/state/actions';
import { palette } from './theme';
import { T } from './T';

/**
 * Sits over the details row and the top of the Save pill (empty right after a save), never over the
 * week-lines where the next tap goes, nor over the header that names the active activity.
 */
export function Toast() {
  const toast = useApp((s) => s.toast);
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();

  // VoiceOver: announce every new toast (live regions are Android-only) and keep undo toasts up longer
  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled()
      .then(setScreenReaderActive)
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReaderActive);
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (toast) AccessibilityInfo.announceForAccessibility(toast.action ? `${toast.text}. ${toast.action.label} disponibile.` : toast.text);
  }, [toast]);

  if (!toast) return null;
  return (
    <Animated.View key={toast.id} entering={reduced ? FadeIn.duration(120).reduceMotion(ReduceMotion.Never) : FadeInDown.duration(260).reduceMotion(ReduceMotion.Never)} exiting={reduced ? undefined : FadeOutDown.duration(200).reduceMotion(ReduceMotion.Never)} style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) + 72 }]} accessibilityLiveRegion="polite" testID="toast">
      <Animated.View style={styles.body}>
        <Pressable onPress={dismissToast} style={{ flex: 1 }} accessibilityRole="text" accessibilityHint="Tocca per chiudere">
          <T variant="small" color={toast.tone === 'error' ? palette.danger : palette.foam} numberOfLines={2}>
            {toast.text}
          </T>
        </Pressable>
        {toast.action ? (
          <Pressable
            onPress={() => {
              toast.action?.run();
              dismissToast();
            }}
            accessibilityRole="button"
            accessibilityLabel={toast.action.label}
            hitSlop={10}
            style={styles.action}
            testID="toast-action"
          >
            <T variant="labelStrong" color={palette.flare}>
              {toast.action.label}
            </T>
          </Pressable>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 50 },
  body: { minHeight: 48, borderRadius: 14, backgroundColor: palette.ink3, paddingHorizontal: 16, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(238,232,218,0.16)' },
  action: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
});
