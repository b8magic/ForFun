/** Product-voice confirmations (e.g. "4 sessioni salvate · Surf" with Annulla). */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, PanResponder, Pressable, StyleSheet, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useMotionReduced } from '@/state/selectors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, type Toast as ToastMessage } from '@/state/store';
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
  const toast = useApp((s) => s.toast);
  return toast ? <DraggableToast key={toast.id} toast={toast} inline={inline} /> : null;
}

function DraggableToast({ toast, inline }: { toast: ToastMessage; inline: boolean }) {
  const S = useSurface();
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const moved = useRef(false);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (releaseTimer.current) clearTimeout(releaseTimer.current); }, []);
  const releasePressSuppression = useCallback(() => {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    // Ignore the pointer release's trailing click, then restore keyboard/VoiceOver
    // activation even if no further pointer-down happens after a cancelled drag.
    releaseTimer.current = setTimeout(() => { moved.current = false; releaseTimer.current = null; }, 150);
  }, []);
  // A drag or late press from an outgoing toast must never dismiss its replacement.
  const dismiss = useCallback(() => {
    if (useApp.getState().toast?.id === toast.id) dismissToast();
  }, [toast.id]);
  const resetPosition = useCallback(() => {
    const config = { duration: reduced ? 0 : 150, reduceMotion: ReduceMotion.Never };
    x.set(withTiming(0, config));
    y.set(withTiming(0, config));
  }, [reduced, x, y]);
  const startDrag = useCallback(() => {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    moved.current = false;
    return false;
  }, []);
  const grantDrag = useCallback(() => { moved.current = true; }, []);
  const moveDrag = useCallback((_: GestureResponderEvent, gesture: PanResponderGestureState) => {
    x.set(gesture.dx);
    y.set(gesture.dy);
  }, [x, y]);
  const releaseDrag = useCallback((_: GestureResponderEvent, gesture: PanResponderGestureState) => {
    if (Math.hypot(gesture.dx, gesture.dy) >= 40) dismiss();
    else { resetPosition(); releasePressSuppression(); }
  }, [dismiss, resetPosition, releasePressSuppression]);
  const cancelDrag = useCallback(() => { resetPosition(); releasePressSuppression(); }, [resetPosition, releasePressSuppression]);
  // PanResponder.create only registers callbacks; refs are read by later touch
  // events. The compiler treats this native callback factory as an unknown call.
  // eslint-disable-next-line react-hooks/refs
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: startDrag,
    // Capture only a deliberate drag, leaving ordinary taps on Annulla intact.
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.hypot(gesture.dx, gesture.dy) > 8,
    onPanResponderGrant: grantDrag,
    onPanResponderMove: moveDrag,
    onPanResponderRelease: releaseDrag,
    onPanResponderTerminationRequest: () => true,
    onPanResponderTerminate: cancelDrag,
  }), [startDrag, grantDrag, moveDrag, releaseDrag, cancelDrag]);
  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
    opacity: Math.max(0.4, 1 - Math.hypot(x.value, y.value) / 180),
  }));

  return (
    <Animated.View entering={inline || reduced ? FadeIn.duration(120).reduceMotion(ReduceMotion.Never) : FadeInDown.duration(260).reduceMotion(ReduceMotion.Never)} exiting={reduced ? undefined : FadeOut.duration(140).reduceMotion(ReduceMotion.Never)} style={[styles.wrap, inline ? styles.inline : { bottom: Math.max(insets.bottom, 10) + 72 }]} accessibilityLiveRegion="polite" testID="toast">
      <Animated.View {...pan.panHandlers} style={[styles.body, { backgroundColor: S.raised, borderColor: S.faint }, dragStyle]} testID="toast-swipe">
        <Pressable onPress={() => { if (!moved.current) dismiss(); }} onAccessibilityEscape={dismiss} style={styles.message} accessibilityRole="button" accessibilityLabel={toast.text} accessibilityHint="Tocca per chiudere. Puoi anche trascinare il messaggio in qualsiasi direzione." testID="toast-dismiss">
          <T variant="small" color={toast.tone === 'error' ? S.danger : S.fg} numberOfLines={2}>
            {toast.text}
          </T>
        </Pressable>
        {toast.action ? (
          <Pressable
            onPress={() => {
              if (moved.current || useApp.getState().toast?.id !== toast.id) return;
              dismiss();
              toast.action?.run();
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
  message: { flex: 1, minHeight: 44, justifyContent: 'center' },
  action: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
});
