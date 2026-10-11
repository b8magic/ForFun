/**
 * Controls in the Serie identity for sheets and functional tools.
 * Familiar where it helps (inputs, toggles, segmented choices), expressed
 * with the film's primitives: hairlines, mono labels, flare for the one
 * primary action, and ≥44 pt touch targets.
 */
import { type ReactNode, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { palette, surfaces, fonts, HIT, space } from './theme';
import { T } from './T';
import { Close } from './glyphs';
import { t } from '@/i18n/it';

const S = surfaces.night;
// react-native-web colours the active thumb separately (teal by default)
const WEB_SWITCH = (Platform.OS === 'web' ? { activeThumbColor: palette.foam } : {}) as object;

export function Sheet({
  title,
  eyebrow,
  children,
  footer,
  onClose,
  scroll = true,
  keyboardInsets = true,
  testID,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  scroll?: boolean;
  /** iOS: keep the focused field above the keyboard (off when a parent already pads for it). */
  keyboardInsets?: boolean;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const close = onClose ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  const body = <View style={[{ paddingHorizontal: space.gutter, paddingBottom: 32, gap: 22 }, !scroll && { flex: 1, paddingBottom: 0 }]}>{children}</View>;
  // collapsable={false}: on Fabric a view that only has a background is drawn, but its children
  // are mounted next to it in the parent. In an iOS form sheet that made the ScrollView a direct
  // child of react-native-screens' SafeAreaView, which then resized it to the whole sheet (over the
  // header and the footer) or, next to a sibling it took for a header, to zero height. As real
  // containers, the sheet and its header keep the ScrollView out of that search: plain flex layout.
  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]} testID={testID} collapsable={false}>
      <View style={styles.sheetHead} collapsable={false}>
        <View style={{ flex: 1, gap: 4 }}>
          {eyebrow ? (
            <T variant="label" color={S.mute}>
              {eyebrow}
            </T>
          ) : null}
          <T variant="heading" color={S.fg} accessibilityRole="header">
            {title}
          </T>
        </View>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t.close} style={styles.closeBtn} hitSlop={8} testID="sheet-close">
          <Close color={S.fg} />
        </Pressable>
      </View>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={keyboardInsets} keyboardDismissMode="interactive" contentContainerStyle={{ paddingTop: 4 }}>
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{body}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

export function Section({ label, children, hint, right }: { label: string; children: ReactNode; hint?: string; right?: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.sectionHead}>
        <T variant="label" color={S.mute}>
          {label}
        </T>
        {right}
      </View>
      {children}
      {hint ? (
        <T variant="small" color={S.mute}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

export function Rule({ style }: { style?: ViewStyle }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: S.faint }, style]} />;
}

export function Field({ label, error, style, ...props }: TextInputProps & { label?: string; error?: string | null }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <T variant="label" color={S.mute}>
          {label}
        </T>
      ) : null}
      <TextInput
        placeholderTextColor="rgba(238,232,218,0.55)"
        selectionColor={palette.flare}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        accessibilityLabel={props.accessibilityLabel ?? label}
        style={[
          styles.input,
          {
            borderBottomColor: error ? palette.danger : focused ? palette.foam : S.faint,
          },
          props.multiline && { minHeight: 84, textAlignVertical: 'top' },
          style,
        ]}
      />
      {error ? (
        <T variant="small" color={palette.danger} accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  color,
  disabled,
  busy,
  testID,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger' | 'quiet';
  color?: string;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  accessibilityHint?: string;
}) {
  const bg = kind === 'primary' ? (color ?? palette.flare) : 'transparent';
  const fg = kind === 'primary' ? palette.ink : kind === 'danger' ? palette.danger : S.fg;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      aria-disabled={!!disabled}
      aria-busy={!!busy}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.35 : busy ? 0.6 : pressed ? 0.8 : 1 },
        kind === 'secondary' && { borderWidth: 1.2, borderColor: S.faint },
        kind === 'quiet' && {
          minHeight: HIT,
          paddingHorizontal: 0,
          alignSelf: 'flex-start',
        },
        kind === 'danger' && {
          borderWidth: 1.2,
          borderColor: 'rgba(255,90,78,0.4)',
        },
      ]}
    >
      <T variant={kind === 'quiet' ? 'labelStrong' : 'button'} color={fg}>
        {label}
      </T>
    </Pressable>
  );
}

/** One-of-many choice drawn as a row of mono labels on a line, the chosen one lifted with a crest dot. */
export function Segmented<K extends string>({
  value,
  options,
  onChange,
  accent = palette.flare,
  testID,
  tone = 'night',
}: {
  value: K;
  options: { key: K; label: string }[];
  onChange: (k: K) => void;
  accent?: string;
  testID?: string;
  tone?: 'night' | 'calm';
}) {
  const S = surfaces[tone];
  const items = options.map((o) => {
    const on = o.key === value;
    return (
      <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="radio" aria-checked={on} style={styles.segment} testID={testID ? `${testID}-${o.key}` : undefined}>
        <View style={[styles.segDot, { backgroundColor: on ? accent : 'transparent' }]} />
        <T variant={on ? 'labelStrong' : 'label'} color={on ? S.fg : S.mute} align="center" numberOfLines={1}>
          {o.label}
        </T>
      </Pressable>
    );
  });
  const line = {
    borderBottomColor: tone === 'calm' ? 'rgba(20,18,15,0.3)' : 'rgba(238,232,218,0.3)',
  };
  // more than three choices: one line that scrolls sideways instead of wrapping a lone option
  if (options.length > 3)
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.segmentedScroll, line]} contentContainerStyle={{ flexGrow: 1 }} accessibilityRole="radiogroup" testID={testID}>
        {items}
      </ScrollView>
    );
  return (
    <View style={[styles.segmented, line]} accessibilityRole="radiogroup" testID={testID}>
      {items}
    </View>
  );
}

export function Toggle({ label, value, onChange, hint, disabled, testID }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean; testID?: string }) {
  return (
    <Pressable onPress={() => !disabled && onChange(!value)} accessibilityRole="switch" aria-checked={value} aria-disabled={disabled} style={styles.toggleRow} testID={testID}>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="body" color={disabled ? S.mute : S.fg}>
          {label}
        </T>
        {hint ? (
          <T variant="small" color={S.mute}>
            {hint}
          </T>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ false: palette.ink3, true: palette.flare }} thumbColor={palette.foam} ios_backgroundColor={palette.ink3} {...WEB_SWITCH} />
    </Pressable>
  );
}

export function Row({
  title,
  detail,
  onPress,
  right,
  left,
  testID,
  accessibilityLabel,
}: {
  title: string;
  detail?: string | null;
  onPress?: () => void;
  right?: ReactNode;
  left?: ReactNode;
  testID?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.row, pressed && onPress ? { opacity: 0.7 } : null]}
      testID={testID}
    >
      {left}
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <T variant="body" color={S.fg} numberOfLines={2}>
          {title}
        </T>
        {detail ? (
          <T variant="small" color={S.mute} numberOfLines={3}>
            {detail}
          </T>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Note({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warn' | 'error' }) {
  const c = tone === 'error' ? palette.danger : tone === 'warn' ? '#F3C46E' : S.mute;
  return (
    <View style={[styles.note, { borderLeftColor: c }]}>
      <T variant="small" color={tone === 'neutral' ? S.mute : c}>
        {children}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: palette.ink2 },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: space.gutter,
    paddingTop: 22,
    paddingBottom: 14,
    gap: 12,
  },
  closeBtn: {
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
    marginTop: -8,
  },
  footer: { paddingHorizontal: space.gutter, paddingTop: 12, gap: 10 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    fontFamily: fonts.text,
    fontSize: 17,
    color: palette.foam,
    paddingVertical: 10,
    borderBottomWidth: 1.2,
    minHeight: HIT,
  },
  button: {
    minHeight: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  segmented: {
    flexDirection: 'row',
    borderBottomWidth: 1.2,
    borderBottomColor: 'rgba(238,232,218,0.3)',
    flexWrap: 'wrap',
  },
  segmentedScroll: { borderBottomWidth: 1.2, flexGrow: 0 },
  segment: {
    flexGrow: 1,
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    paddingHorizontal: 6,
    gap: 6,
  },
  segDot: { width: 6, height: 6, borderRadius: 3 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: HIT,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: S.faint,
  },
  note: { borderLeftWidth: 2, paddingLeft: 12, paddingVertical: 2 },
});
