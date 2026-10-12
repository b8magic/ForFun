/**
 * Riepilogo di un periodo — sessions, active days and recorded hours (with
 * completeness) for today, a week, the last 30 days, the year or any range.
 * Sessions and their full recorded duration count on their recorded date.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { LocalDate, Session } from '@/domain/types';
import { addDays, compareDates, isLocalDate, startOfWeek } from '@/domain/dates';
import { summarize } from '@/domain/stats';
import { Segmented } from '@/ui/controls';
import { T } from '@/ui/T';
import { fonts, HIT, type Surface } from '@/ui/theme';
import { useSurface } from '@/ui/useTheme';
import { t } from '@/i18n/it';
import { countsLine, durationLine, shortDate } from './format';

type Preset = 'today' | 'week' | 'lastWeek' | 'days30' | 'year' | 'custom';

export function presetPeriod(p: Exclude<Preset, 'custom'>, today: LocalDate): { from: LocalDate; to: LocalDate } {
  const mon = startOfWeek(today);
  switch (p) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return { from: mon, to: today };
    case 'lastWeek':
      return { from: addDays(mon, -7), to: addDays(mon, -1) };
    case 'days30':
      return { from: addDays(today, -29), to: today };
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

export function PeriodSummary({ sessions, today, accent }: { sessions: readonly Session[]; today: LocalDate; accent: string }) {
  const C = useSurface();
  const [preset, setPreset] = useState<Preset>('week');
  const [from, setFrom] = useState<string>(presetPeriod('days30', today).from);
  const [to, setTo] = useState<string>(today);
  const range = useMemo(() => {
    if (preset !== 'custom') return presetPeriod(preset, today);
    const a = from.trim();
    const b = to.trim();
    return isLocalDate(a) && isLocalDate(b) && compareDates(a, b) <= 0 ? { from: a, to: b } : null;
  }, [preset, from, to, today]);
  const summary = useMemo(() => (range ? summarize(sessions.filter((s) => compareDates(s.date, range.from) >= 0 && compareDates(s.date, range.to) <= 0)) : null), [sessions, range]);
  const dur = summary ? durationLine(summary.duration) : '';
  const span = range ? (range.from === range.to ? shortDate(range.from) : `${shortDate(range.from)} – ${shortDate(range.to)}`) : '';

  return (
    <View style={{ gap: 12 }} testID="period-summary">
      <T variant="label" color={C.mute}>
        RIEPILOGO DI UN PERIODO
      </T>
      <Segmented
        tone="calm"
        accent={accent}
        value={preset}
        onChange={setPreset}
        options={[
          { key: 'today', label: 'Oggi' },
          { key: 'week', label: 'Settimana' },
          { key: 'lastWeek', label: 'Scorsa' },
          { key: 'days30', label: '30 giorni' },
          { key: 'year', label: 'Anno' },
          { key: 'custom', label: 'Scegli' },
        ]}
        testID="period"
      />
      {preset === 'custom' ? (
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <DateField label={t.from} value={from} onChange={setFrom} testID="period-from" />
          <DateField label={t.to} value={to} onChange={setTo} testID="period-to" />
        </View>
      ) : null}
      {summary ? (
        <View style={{ gap: 4 }} accessible accessibilityLabel={`${span}: ${countsLine(summary)}${dur ? `. ${dur}` : ''}`} accessibilityLiveRegion="polite" testID="period-result">
          <T variant="data" color={C.mute}>
            {span.toUpperCase()}
          </T>
          <T variant="title" color={C.fg}>
            {countsLine(summary)}
          </T>
          {dur ? (
            <T variant="small" color={summary.duration.knownCount ? C.fg : C.mute}>
              {dur}
            </T>
          ) : null}
        </View>
      ) : (
        <T variant="small" color={C.mute}>
          Date non valide: usa AAAA-MM-GG, con la prima non dopo la seconda.
        </T>
      )}
      <T variant="small" color={C.mute}>
        Ogni sessione, con tutta la sua durata registrata, conta nel giorno in cui è registrata, anche se finisce dopo mezzanotte.
      </T>
    </View>
  );
}

function DateField({ label, value, onChange, testID }: { label: string; value: string; onChange: (v: string) => void; testID: string }) {
  const C = useSurface();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <T variant="label" color={C.mute}>
        {label.toUpperCase()}
      </T>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="AAAA-MM-GG"
        placeholderTextColor={C.mute}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        maxFontSizeMultiplier={1.4}
        style={styles.input}
        accessibilityLabel={`${label}, formato anno mese giorno`}
        testID={testID}
      />
    </View>
  );
}

const makeStyles = (C: Surface) => StyleSheet.create({
  input: { fontFamily: fonts.mono, fontSize: 16, color: C.fg, paddingVertical: 10, borderBottomWidth: 1.2, borderBottomColor: C.line, minHeight: HIT },
});
