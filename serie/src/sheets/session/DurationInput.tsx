import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { t } from '@/i18n/it';
import { T } from '@/ui/T';
import { fonts, type Surface } from '@/ui/theme';
import { useSurface, useThemedStyles } from '@/ui/useTheme';
import { durationEntryText, editDurationEntry, type DurationSelection } from './durationEntry';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error: string | null;
  testID: string;
}

/** A single accessible numeric input, formatted as hours and minutes while typing. */
export function DurationInput({ value, onChange, onBlur, error, testID }: Props) {
  const S = useSurface();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  const [selection, setSelection] = useState<DurationSelection | undefined>();
  const selectionRef = useRef<DurationSelection>({ start: 0, end: 0 });
  const text = durationEntryText(value);

  return (
    <View style={{ gap: 6 }}>
      <T variant="label" color={S.mute}>{t.sessionSheets.durationLabel}</T>
      <TextInput
        value={text}
        onChangeText={(nextText) => {
          const edit = editDurationEntry(value, nextText, selectionRef.current);
          selectionRef.current = edit.selection;
          setSelection(edit.selection);
          if (edit.value !== value) onChange(edit.value);
        }}
        selection={selection ? { start: Math.min(selection.start, text.length), end: Math.min(selection.end, text.length) } : undefined}
        onSelectionChange={({ nativeEvent }) => {
          selectionRef.current = nativeEvent.selection;
          setSelection((current) => current?.start === nativeEvent.selection.start && current.end === nativeEvent.selection.end ? current : nativeEvent.selection);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setSelection(undefined);
          onBlur();
        }}
        inputMode="numeric"
        keyboardType="number-pad"
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect={false}
        spellCheck={false}
        smartInsertDelete={false}
        keyboardAppearance={S.name === 'night' ? 'dark' : 'light'}
        selectionColor={S.accent}
        underlineColorAndroid="transparent"
        maxFontSizeMultiplier={1.35}
        accessibilityLabel={t.sessionSheets.durationInputA11y}
        accessibilityHint={error ?? t.sessionSheets.durationInputHint}
        style={[styles.input, { borderBottomColor: error ? S.danger : focused ? S.fg : S.faint }]}
        testID={testID}
      />
    </View>
  );
}

const createStyles = (S: Surface) => StyleSheet.create({
  input: { minHeight: 52, borderBottomWidth: 1.2, fontFamily: fonts.mono, fontSize: 24, letterSpacing: 0.5, color: S.fg, paddingVertical: 8 },
});
