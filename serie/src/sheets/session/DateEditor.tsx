import { useSurface, useThemedStyles } from '@/ui/useTheme';
/**
 * Session date: a compact AAAA-MM-GG field with ±1 day steps. Future dates
 * are refused (the step forward stops at today). Controlled on the raw text.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { LocalDate } from '@/domain/types';
import { fonts, HIT, type Surface } from '@/ui/theme';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { checkSessionDate, longDate, shiftDate } from './drafts';

const s = t.sessionSheets;

interface Props {
  value: string;
  onChange: (raw: string) => void;
  today: LocalDate;
  /** Last valid date, used by the step buttons while the text is being edited. */
  fallback: LocalDate;
  showErrors?: boolean;
  testID?: string;
}

export function DateEditor({ value, onChange, today, fallback, showErrors, testID = 'date' }: Props) {
  const S = useSurface();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const check = checkSessionDate(value, today);
  const base = check.ok ? check.date : fallback;
  const atToday = base >= today;
  const error = !check.ok && (touched || showErrors) ? (check.error === 'future' ? s.errDateFuture : check.error === 'too_early' ? s.errDateTooEarly : s.errDateFormat) : null;

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        <Step text="−1" label={s.dayBefore} onPress={() => onChange(shiftDate(base, -1, today))} testID={`${testID}-prev`} />
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setTouched(true);
          }}
          placeholder={s.datePlaceholder}
          placeholderTextColor={S.mute}
          keyboardAppearance={S.name === 'night' ? 'dark' : 'light'}
          selectionColor={S.accent}
          keyboardType="numbers-and-punctuation"
          autoCorrect={false}
          maxLength={10}
          maxFontSizeMultiplier={1.3}
          accessibilityLabel={`${t.date}, ${s.datePlaceholder}`}
          accessibilityHint={check.ok ? longDate(check.date) : undefined}
          style={[styles.input, { borderBottomColor: error ? S.danger : focused ? S.fg : S.faint }]}
          testID={testID}
        />
        <Step text="+1" label={s.dayAfter} disabled={atToday} onPress={() => onChange(shiftDate(base, 1, today))} testID={`${testID}-next`} />
      </View>
      {error ? (
        <T variant="small" color={S.danger} align="center" accessibilityLiveRegion="polite" testID={`${testID}-error`}>
          {error}
        </T>
      ) : (
        <T variant="small" color={S.mute} align="center">
          {check.ok ? longDate(check.date) : ' '}
        </T>
      )}
    </View>
  );
}

function Step({ text, label, onPress, disabled, testID }: { text: string; label: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  const S = useSurface();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={!!disabled}
      style={({ pressed }) => [styles.step, { opacity: disabled ? 0.25 : pressed ? 0.6 : 1 }]}
      testID={testID}
    >
      <T variant="dataStrong" color={S.fg} accessible={false}>
        {text}
      </T>
    </Pressable>
  );
}

const createStyles = (S: Surface) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minWidth: 0, textAlign: 'center', fontFamily: fonts.mono, fontSize: 24, letterSpacing: 1, color: S.fg, paddingVertical: 8, borderBottomWidth: 1.2, minHeight: 52 },
  step: { width: HIT + 4, height: HIT + 4, borderRadius: (HIT + 4) / 2, borderWidth: StyleSheet.hairlineWidth, borderColor: S.faint, alignItems: 'center', justifyContent: 'center' },
});
