import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { t } from '@/i18n/it';
import { T } from '@/ui/T';
import { HIT, fonts, type Surface } from '@/ui/theme';
import { useSurface, useThemedStyles } from '@/ui/useTheme';
import { filterTimeZoneOptions, timeZoneOptions, type TimeZoneOption } from './timeZoneOptions';

const s = t.sessionSheets;
const PAGE_SIZE = 8;

interface Props {
  value: string;
  deviceZone: string;
  onChange: (zone: string) => void;
  invalid?: boolean;
  testID: string;
}

export function TimeZonePicker({ value, deviceZone, onChange, invalid, testID }: Props) {
  const S = useSurface();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const expanded = open || !!invalid;
  const choose = (zone: string) => {
    onChange(zone);
    setOpen(false);
  };
  return (
    <View style={{ gap: 12 }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={s.timeZoneA11y(value)}
        style={styles.header}
        testID={`${testID}-zone-open`}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="label" color={S.mute}>{t.timeZone}</T>
          <T variant="data" color={S.fg} numberOfLines={1}>{value}</T>
          {value === deviceZone ? <T variant="small" color={S.mute}>{s.timeZoneDevice}</T> : null}
        </View>
        <T variant="labelStrong" color={S.mute}>{expanded ? t.close : s.editShort}</T>
      </Pressable>
      {expanded ? <ZoneChoices value={value} deviceZone={deviceZone} onChoose={choose} testID={testID} /> : null}
    </View>
  );
}

function ZoneChoices({ value, deviceZone, onChoose, testID }: { value: string; deviceZone: string; onChoose: (zone: string) => void; testID: string }) {
  const S = useSurface();
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const options = useMemo(() => timeZoneOptions(deviceZone, value).filter((option) => option.id !== deviceZone), [deviceZone, value]);
  const results = useMemo(() => filterTimeZoneOptions(options, query), [options, query]);
  const start = page * PAGE_SIZE;
  const visible = results.slice(start, start + PAGE_SIZE);
  return (
    <View style={styles.choices} testID={`${testID}-zone-picker`}>
      <T variant="bodyStrong" color={S.fg}>{s.timeZoneChoose}</T>
      <TextInput
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setPage(0);
        }}
        placeholder={s.timeZoneSearch}
        accessibilityLabel={s.timeZoneSearch}
        placeholderTextColor={S.mute}
        keyboardAppearance={S.name === 'night' ? 'dark' : 'light'}
        selectionColor={S.accent}
        inputMode="search"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.search}
        testID={`${testID}-zone-search`}
      />
      <ZoneChoice option={{ id: deviceZone, city: s.timeZoneUseDevice, search: '' }} selected={value === deviceZone} onPress={() => onChoose(deviceZone)} testID={`${testID}-zone-device`} />
      <View style={styles.list}>
        {visible.map((option) => (
          <ZoneChoice key={option.id} option={option} selected={value === option.id} onPress={() => onChoose(option.id)} testID={`${testID}-zone-option-${option.id}`} />
        ))}
        {!results.length ? <T variant="small" color={S.mute} accessibilityLiveRegion="polite" testID={`${testID}-zone-empty`}>{s.timeZoneNoResults}</T> : null}
      </View>
      {results.length > PAGE_SIZE ? (
        <View style={styles.pages}>
          <Pressable onPress={() => setPage((v) => Math.max(0, v - 1))} disabled={page === 0} accessibilityRole="button" accessibilityState={{ disabled: page === 0 }} style={styles.pageButton} testID={`${testID}-zone-previous`}>
            <T variant="labelStrong" color={page === 0 ? S.faint : S.fg}>{s.timeZonePrevious}</T>
          </Pressable>
          <T variant="small" color={S.mute} style={{ flex: 1, textAlign: 'center' }} accessibilityLiveRegion="polite">{s.timeZoneResults(start + 1, Math.min(start + PAGE_SIZE, results.length), results.length)}</T>
          <Pressable onPress={() => setPage((v) => Math.min(v + 1, Math.ceil(results.length / PAGE_SIZE) - 1))} disabled={start + PAGE_SIZE >= results.length} accessibilityRole="button" accessibilityState={{ disabled: start + PAGE_SIZE >= results.length }} style={styles.pageButton} testID={`${testID}-zone-next`}>
            <T variant="labelStrong" color={start + PAGE_SIZE >= results.length ? S.faint : S.fg}>{s.timeZoneNext}</T>
          </Pressable>
        </View>
      ) : null}
      <T variant="small" color={S.mute}>{s.timeZoneHint}</T>
    </View>
  );
}

function ZoneChoice({ option, selected, onPress, testID }: { option: TimeZoneOption; selected: boolean; onPress: () => void; testID: string }) {
  const S = useSurface();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${option.city}, ${option.id}`} style={styles.option} testID={testID}>
      <View style={[styles.radio, { borderColor: selected ? S.accent : S.mute }]}>{selected ? <View style={[styles.radioDot, { backgroundColor: S.accent }]} /> : null}</View>
      <View style={{ flex: 1, gap: 3 }}>
        <T variant="body" color={S.fg}>{option.city}</T>
        <T variant="small" color={S.mute}>{option.id}</T>
      </View>
    </Pressable>
  );
}

const createStyles = (S: Surface) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: HIT },
  choices: { gap: 12, paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: S.faint },
  search: { fontFamily: fonts.mono, fontSize: 15, color: S.fg, paddingVertical: 10, borderBottomWidth: 1.2, borderBottomColor: S.faint, minHeight: HIT },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: S.faint, gap: 2, paddingTop: 8 },
  option: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  pages: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pageButton: { minHeight: HIT, justifyContent: 'center' },
});
