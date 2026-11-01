/**
 * Small building blocks shared by the activities, menu and jump sheets.
 * Everything follows the identity: hairlines, mono labels, foam on ink,
 * one coloured action per sheet, ≥44 pt targets.
 */
import { type ReactNode, useEffect, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform, Pressable, StyleSheet, View, type KeyboardEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { palette, surfaces, HIT } from '@/ui/theme';
import { T } from '@/ui/T';
import { useMotionReduced } from '@/state/selectors';

const S = surfaces.night;

/** Dismiss the current sheet (falls back to the composition when opened directly by URL). */
export function closeSheet() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Keeps a sheet's footer (the primary action) above the software keyboard.
 * Sheets here are bottom-anchored (iOS form sheet on iPhone, full-screen modal
 * elsewhere), so the overlap is the keyboard height. RN's KeyboardAvoidingView
 * measures its frame relative to its parent, which under-reports the overlap
 * inside a form sheet that does not start at the top of the window.
 */
export function KeyboardSafe({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();
  const [inset, setInset] = useState(0);
  const bottomPad = Math.max(insets.bottom, 12); // what Sheet already reserves below its footer
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const ios = Platform.OS === 'ios';
    const follow = (e: KeyboardEvent) => {
      // Move with the keyboard's own curve; under reduced motion just settle.
      if (!reduced && e.duration && e.easing) {
        const duration = Math.max(10, e.duration);
        LayoutAnimation.configureNext({ duration, update: { duration, type: LayoutAnimation.Types[e.easing] ?? LayoutAnimation.Types.keyboard } });
      }
    };
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      follow(e);
      setInset(Math.max(0, Math.round(e.endCoordinates.height + 12 - bottomPad)));
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      follow(e);
      setInset(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [bottomPad, reduced]);
  return <View style={{ flex: 1, paddingBottom: inset }}>{children}</View>;
}

/**
 * The one primary action plus a way out: side by side for short labels,
 * stacked (primary full width, the way out beneath it) for long, explicit ones.
 */
export function FooterPair({ secondary, primary, stacked }: { secondary?: ReactNode; primary: ReactNode; stacked?: boolean }) {
  if (!secondary) return <>{primary}</>;
  if (stacked)
    return (
      <View style={{ gap: 4 }}>
        {primary}
        <View style={{ alignItems: 'center' }}>
          <View>{secondary}</View>
        </View>
      </View>
    );
  return (
    <View style={styles.pair}>
      <View style={{ flex: 1 }}>{secondary}</View>
      <View style={{ flex: 1.55 }}>{primary}</View>
    </View>
  );
}

/** The ring used by every one-of-many choice: hollow, or holding a dot in the accent colour. */
export function ChoiceRing({ on, accent = palette.flare }: { on: boolean; accent?: string }) {
  return (
    <View style={[styles.ring, { borderColor: on ? palette.foam : 'rgba(238,232,218,0.42)' }]}>
      {on ? <View style={[styles.ringDot, { backgroundColor: accent }]} /> : null}
    </View>
  );
}

/** A radio row with optional leading visual and a detail line. */
export function RadioRow({
  title,
  detail,
  on,
  onPress,
  disabled,
  accent,
  left,
  testID,
  accessibilityLabel,
}: {
  title: string;
  detail?: string | null;
  on: boolean;
  onPress: () => void;
  disabled?: boolean;
  accent?: string;
  left?: ReactNode;
  testID?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      aria-checked={on} aria-disabled={!!disabled}
      accessibilityLabel={accessibilityLabel ?? (detail ? `${title}. ${detail}` : title)}
      testID={testID}
      style={({ pressed }) => [styles.radio, { opacity: disabled ? 0.38 : pressed ? 0.72 : 1 }]}
    >
      <ChoiceRing on={on} accent={accent} />
      {left}
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <T variant="body" color={on ? S.fg : 'rgba(238,232,218,0.86)'}>
          {title}
        </T>
        {detail ? (
          <T variant="small" color={S.mute}>
            {detail}
          </T>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Mono tag in an accent colour (e.g. ATTIVA). */
export function Tag({ children, color }: { children: string; color: string }) {
  return (
    <T variant="labelStrong" color={color}>
      {children}
    </T>
  );
}

/** A crisp caret drawn from two borders of a rotated square. */
export function Caret({ dir, color, size = 9 }: { dir: 'up' | 'down' | 'left' | 'right'; color: string; size?: number }) {
  const rot = { up: '45deg', right: '135deg', down: '225deg', left: '-45deg' }[dir];
  // Nudge the square so the visible corner sits on the optical centre.
  const shift = size * 0.22;
  const tx = dir === 'left' ? shift : dir === 'right' ? -shift : 0;
  const ty = dir === 'up' ? shift : dir === 'down' ? -shift : 0;
  return (
    <View style={{ width: size * 1.6, height: size * 1.6, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size, borderTopWidth: 1.6, borderLeftWidth: 1.6, borderColor: color, transform: [{ translateX: tx }, { translateY: ty }, { rotate: rot }] }} />
    </View>
  );
}

/** Square icon button (reorder arrows). */
export function IconButton({ children, onPress, disabled, label, testID }: { children: ReactNode; onPress: () => void; disabled?: boolean; label: string; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={!!disabled}
      testID={testID}
      style={({ pressed }) => [styles.icon, { opacity: disabled ? 0.22 : pressed ? 0.6 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: 10 },
  ring: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center' },
  ringDot: { width: 10, height: 10, borderRadius: 5 },
  radio: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingVertical: 10 },
  icon: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
});
