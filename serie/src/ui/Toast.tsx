/** Product-voice confirmations (e.g. "4 sessioni salvate · Surf" with Annulla). */
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { useMotionReduced } from '@/state/selectors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/state/store';
import { dismissToast, setScreenReaderActive } from '@/state/actions';
import { useSurface } from './useTheme';
import { T } from './T';

/** One announcement host; Home reserves real layout space for its visual toast. */
export function Toast() {
  const toast = useApp((s) => s.toast);
  const place = useApp((s) => s.place);

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

  return place === 'time' ? <ToastContent /> : null;
}

export function ToastContent({ inline = false }: { inline?: boolean }) {
  const S = useSurface();
  const toast = useApp((s) => s.toast);
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();

  if (!toast) return null;
  return (
    <Animated.View key={toast.id} entering={inline || reduced ? FadeIn.duration(120).reduceMotion(ReduceMotion.Never) : FadeInDown.duration(260).reduceMotion(ReduceMotion.Never)} exiting={reduced ? undefined : inline ? FadeOut.duration(160).reduceMotion(ReduceMotion.Never) : FadeOutDown.duration(200).reduceMotion(ReduceMotion.Never)} style={[styles.wrap, inline ? styles.inline : { bottom: Math.max(insets.bottom, 10) + 72 }]} accessibilityLiveRegion="polite" testID="toast">
      <Animated.View style={[styles.body, { backgroundColor: S.raised, borderColor: S.faint }]}>
        <Pressable onPress={dismissToast} style={{ flex: 1 }} accessibilityRole="text" accessibilityHint="Tocca per chiudere">
          <T variant="small" color={toast.tone === 'error' ? S.danger : S.fg} numberOfLines={2}>
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
            <T variant="labelStrong" color={S.accent}>
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
  inline: { position: 'relative', left: 0, right: 0, marginBottom: 2 },
  body: { minHeight: 48, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth },
  action: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
});
