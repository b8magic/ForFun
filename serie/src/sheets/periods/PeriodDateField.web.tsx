import { useState } from 'react';
import { View } from 'react-native';
import { EARLIEST_DATE } from '@/domain/dates';
import { T } from '@/ui/T';
import { fonts } from '@/ui/theme';
import { useSurface } from '@/ui/useTheme';
import type { PeriodDateFieldProps } from './PeriodDateField';

export function PeriodDateField({ label, value, onChange, disabled = false, error, testID }: PeriodDateFieldProps) {
  const C = useSurface();
  const [focused, setFocused] = useState(false);
  const errorID = `${testID}-error`;

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, minHeight: 52, borderBottomWidth: 1, borderBottomColor: error ? C.danger : focused ? C.fg : C.faint, opacity: disabled ? 0.5 : 1 }}>
        <T variant="label" color={C.mute}>{label}</T>
        <input
          type="date"
          lang="it"
          value={value}
          min={EARLIEST_DATE}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label={label}
          aria-invalid={!!error}
          aria-describedby={error ? errorID : undefined}
          data-testid={testID}
          style={{ colorScheme: C.name === 'night' ? 'dark' : 'light', color: C.fg, accentColor: C.accent, backgroundColor: 'transparent', border: 0, outline: 'none', boxSizing: 'border-box', minWidth: 0, maxWidth: '100%', minHeight: 44, padding: '8px 0 8px 8px', fontFamily: fonts.text, fontSize: 16 }}
        />
      </View>
      {error ? <T nativeID={errorID} variant="small" color={C.danger} accessibilityLiveRegion="polite" testID={errorID}>{error}</T> : null}
    </View>
  );
}
