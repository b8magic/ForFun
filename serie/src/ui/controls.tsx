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
import { foregroundOn, fonts, HIT, space } from './theme';
import { useSurface } from './useTheme';
import { T } from './T';
import { Chevron, Close } from './glyphs';
import { t } from '@/i18n/it';

export function Sheet({
  title,
  accessibleTitle,
  eyebrow,
  children,
  footer,
  onClose,
  onBack,
  backLabel = t.back,
  scroll = true,
  keyboardInsets = true,
  testID,
}: {
  title?: string;
  /** A heading for assistive technology when the visible content already names the sheet. */
  accessibleTitle?: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  onBack?: () => void;
  backLabel?: string;
  scroll?: boolean;
  /** iOS: keep the focused field above the keyboard (off when a parent already pads for it). */
  keyboardInsets?: boolean;
  testID?: string;
}) {
  const S = useSurface();
  const insets = useSafeAreaInsets();
  const close = onClose ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  const body = <View style={[{ paddingHorizontal: space.gutter, paddingBottom: 32, gap: 22 }, !scroll && { flex: 1, paddingBottom: 0 }]}>{children}</View>;
  // collapsable={false}: on Fabric a view that only has a background is drawn, but its children
  // are mounted next to it in the parent. In an iOS form sheet that made the ScrollView a direct
  // child of react-native-screens' SafeAreaView, which then resized it to the whole sheet (over the
  // header and the footer) or, next to a sibling it took for a header, to zero height. As real
  // containers, the sheet and its header keep the ScrollView out of that search: plain flex layout.
  return (
    <View style={[styles.sheet, { backgroundColor: S.bg, paddingBottom: Math.max(insets.bottom, 12) }]} testID={testID} collapsable={false}>
      <View style={styles.sheetHead} collapsable={false}>
        {onBack ? (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={backLabel} style={styles.backBtn} hitSlop={8} testID="sheet-back">
            <Chevron dir="left" color={S.fg} size={11} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1, gap: 4, minHeight: !title && accessibleTitle ? HIT : undefined }} accessible={!title && !!accessibleTitle} accessibilityRole={!title && accessibleTitle ? 'header' : undefined} accessibilityLabel={!title ? accessibleTitle : undefined}>
          {eyebrow ? (
            <T variant="label" color={S.mute}>
              {eyebrow}
            </T>
          ) : null}
          {title ? <T variant="heading" color={S.fg} accessibilityRole="header">{title}</T> : null}
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
  const S = useSurface();
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
  const S = useSurface();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: S.faint }, style]} />;
}

export function Field({ label, error, style, ...props }: TextInputProps & { label?: string; error?: string | null }) {
  const S = useSurface();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <T variant="label" color={S.mute}>
          {label}
        </T>
      ) : null}
      <TextInput
        placeholderTextColor={S.mute}
        selectionColor={S.accent}
        keyboardAppearance={S.name === 'night' ? 'dark' : 'light'}
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
            color: S.fg,
            borderBottomColor: error ? S.danger : focused ? S.fg : S.faint,
          },
          props.multiline && { minHeight: 84, textAlignVertical: 'top' },
          style,
        ]}
      />
      {error ? (
        <T variant="small" color={S.danger} accessibilityLiveRegion="polite">
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
  const S = useSurface();
  const bg = kind === 'primary' ? (color ?? S.accent) : 'transparent';
  const fg = kind === 'primary' ? (color ? foregroundOn(color) : S.onAccent) : kind === 'danger' ? S.danger : S.fg;
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
          borderColor: S.danger,
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
  accent,
  testID,
}: {
  value: K;
  options: { key: K; label: string }[];
  onChange: (k: K) => void;
  accent?: string;
  testID?: string;
  tone?: 'night' | 'calm';
}) {
  const S = useSurface();
  const selectedColor = accent ?? S.accent;
  const items = options.map((o) => {
    const on = o.key === value;
    return (
      <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="radio" aria-checked={on} style={styles.segment} testID={testID ? `${testID}-${o.key}` : undefined}>
        <View style={[styles.segDot, { backgroundColor: on ? selectedColor : 'transparent' }]} />
        <T variant={on ? 'labelStrong' : 'label'} color={on ? S.fg : S.mute} align="center" numberOfLines={1}>
          {o.label}
        </T>
      </Pressable>
    );
  });
  const line = {
    borderBottomColor: S.faint,
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
  const S = useSurface();
  // react-native-web also has a separate active-thumb colour.
  const webSwitch = (Platform.OS === 'web' ? { activeThumbColor: S.bg } : {}) as object;
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
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ false: S.faint, true: S.accent }} thumbColor={S.bg} ios_backgroundColor={S.faint} {...webSwitch} />
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
  const S = useSurface();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.row, { borderBottomColor: S.faint }, pressed && onPress ? { opacity: 0.7 } : null]}
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
  const S = useSurface();
  const c = tone === 'error' ? S.danger : tone === 'warn' ? S.warning : S.mute;
  return (
    <View style={[styles.note, { borderLeftColor: c }]}>
      <T variant="small" color={tone === 'neutral' ? S.mute : c}>
        {children}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
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
  backBtn: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center', marginLeft: -12, marginTop: -8 },
  footer: { paddingHorizontal: space.gutter, paddingTop: 12, gap: 10 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    fontFamily: fonts.text,
    fontSize: 17,
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
  },
  note: { borderLeftWidth: 2, paddingLeft: 12, paddingVertical: 2 },
});
