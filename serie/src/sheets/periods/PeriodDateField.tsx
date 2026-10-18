import { useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { EARLIEST_DATE, isLocalDate, todayIn } from '@/domain/dates';
import { dateLabel } from '@/places/time/format';
import { T } from '@/ui/T';
import { useSurface } from '@/ui/useTheme';
import { fromPickerDate, toPickerDate } from './pickerDates';

export interface PeriodDateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string | null;
  testID: string;
}

export function PeriodDateField({ label, value, onChange, disabled = false, error, testID }: PeriodDateFieldProps) {
  const C = useSurface();
  const [open, setOpen] = useState(false);
  const date = isLocalDate(value) ? value : todayIn();
  const ios = Platform.OS === 'ios';

  return (
    <View style={{ gap: 6 }}>
      <View style={[styles.row, { borderBottomColor: error ? C.danger : C.faint, opacity: disabled ? 0.5 : 1 }]}>
        <T variant="label" color={C.mute}>{label}</T>
        {ios || (open && !disabled) ? (
          <DateTimePicker
            value={toPickerDate(date)}
            minimumDate={toPickerDate(EARLIEST_DATE)}
            mode="date"
            display={ios ? 'compact' : 'default'}
            locale={ios ? 'it-IT' : undefined}
            themeVariant={C.name === 'night' ? 'dark' : 'light'}
            accentColor={C.accent}
            disabled={disabled}
            onTouchStart={Keyboard.dismiss}
            onValueChange={(_event, selected) => {
              setOpen(false);
              if (disabled) return;
              const next = fromPickerDate(selected);
              if (next) onChange(next);
            }}
            onDismiss={() => setOpen(false)}
            accessibilityLabel={label}
            accessibilityHint={error ?? undefined}
            style={styles.picker}
            testID={ios ? testID : `${testID}-picker`}
          />
        ) : null}
        {!ios ? (
          <Pressable
            disabled={disabled}
            onPress={() => { Keyboard.dismiss(); setOpen(true); }}
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${dateLabel(date)}`}
            accessibilityHint={error ?? 'Scegli la data'}
            accessibilityState={{ disabled }}
            style={styles.trigger}
            testID={testID}
          >
            <T color={C.fg}>{dateLabel(date)}</T>
          </Pressable>
        ) : null}
      </View>
      {error ? <T variant="small" color={C.danger} accessibilityLiveRegion="polite" testID={`${testID}-error`}>{error}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, minHeight: 52, paddingVertical: 4, borderBottomWidth: 1 },
  picker: { minHeight: 44 },
  trigger: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
});
