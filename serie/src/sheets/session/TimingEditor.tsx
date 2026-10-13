import { useSurface, useThemedStyles } from '@/ui/useTheme';
/**
 * Timing editor — the five representations of a session's time:
 *   Solo data · Ora di inizio · Inizio e fine · Solo durata · Inizio + durata
 *
 * Controlled: the parent owns the TimingForm (raw text) and evaluates it with
 * evaluateTiming(date, form, zone) to get the canonical Timing + validity.
 * This component shows:
 *  - what a mode switch will change before it happens (describeSwitch → Italian),
 *    carrying valid details across (interval → declared duration, visibly);
 *  - the active duration source, the derived end (marked as derived),
 *    validation errors next to their fields, DST notes, and the time zone used.
 * Overnight is never inferred: only the explicit "Termina il giorno dopo" toggle.
 */
import { useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { LocalDate, TimingState } from '@/domain/types';
import { isWallTime } from '@/domain/zoned';
import { Button, Note, Segmented, Toggle } from '@/ui/controls';
import { fonts, HIT, type Surface } from '@/ui/theme';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { useMotionReduced } from '@/state/selectors';
import {
  TIMING_MODES,
  derivedEndCopy,
  durationInputFromParts,
  durationPartsFrom,
  durationSourceCopy,
  evaluateTiming,
  fieldErrorCopy,
  formatTimingDuration,
  modeHasDuration,
  modeHasEnd,
  modeHasStart,
  modeLabel,
  normalizeTimeInput,
  parseFormDuration,
  previewSwitch,
  type SwitchPreview,
  type TimingField,
  type TimingForm,
} from './timingForm';
import { TimeZonePicker } from './TimeZonePicker';

const s = t.sessionSheets;

interface Props {
  /** Session date (DST-correct durations and derived ends depend on it). */
  date: LocalDate;
  value: TimingForm;
  onChange: (f: TimingForm) => void;
  /** Device zone, used when the zone field is blank. */
  deviceZone: string;
  /** Show every error now (e.g. after a save attempt), not only on touched fields. */
  showErrors?: boolean;
  accent?: string;
  testID?: string;
}

export function TimingEditor({ date, value: form, onChange, deviceZone, showErrors = false, accent: accentProp, testID = 'timing' }: Props) {
  const S = useSurface();
  const accent = accentProp ?? S.accent;
  const styles = useThemedStyles(createStyles);
  const reduced = useMotionReduced();
  const [pending, setPending] = useState<SwitchPreview | null>(null);
  const [prefill, setPrefill] = useState<SwitchPreview['prefill']>(null);
  const [touched, setTouched] = useState<Partial<Record<TimingField, boolean>>>({});

  const ev = useMemo(() => evaluateTiming(date, form, deviceZone), [date, form, deviceZone]);
  const enter = reduced ? undefined : FadeIn.duration(180);

  const set = (patch: Partial<TimingForm>) => onChange({ ...form, ...patch });
  const touch = (f: TimingField) => setTouched((x) => (x[f] ? x : { ...x, [f]: true }));
  const visible = (f: TimingField) => showErrors || touched[f] || (f === 'start' && touched.end);
  const err = (f: TimingField) => (ev.errors[f] && visible(f) ? fieldErrorCopy(ev.errors[f]!) : null);

  const choose = (to: TimingState) => {
    if (to === form.mode) {
      setPending(null);
      return;
    }
    const pv = previewSwitch(date, form, to, deviceZone);
    if (pv.needsConfirm) {
      setPending(pv);
      // VoiceOver: the preview appears below the control; say what will change.
      AccessibilityInfo.announceForAccessibility(`${modeLabel(to)}. ${t.timingWillChange(pv.lines.join('; '))}`);
    } else apply(pv);
  };
  const apply = (pv: SwitchPreview) => {
    onChange(pv.next);
    setPrefill(pv.prefill);
    setPending(null);
    setTouched({});
  };

  const blurTime = (f: 'start' | 'end') => {
    touch(f);
    const n = normalizeTimeInput(form[f]);
    if (n !== form[f] && isWallTime(n)) set({ [f]: n });
  };

  const durationParts = durationPartsFrom(form.duration);
  const parsedDuration = parseFormDuration(form.duration);
  const durEcho = parsedDuration.ok ? s.durationEcho(formatTimingDuration(parsedDuration.seconds)) : null;
  const savedSeconds = parsedDuration.ok ? parsedDuration.seconds % 60 : 0;
  const changeDuration = (part: 'hours' | 'minutes', text: string) => {
    set({ duration: durationInputFromParts({ ...durationParts, [part]: text }) });
    if (prefill?.field === 'duration') setPrefill(null);
  };

  const source = ev.ok ? durationSourceCopy(ev.timing) : null;
  const derived = ev.ok && ev.timing?.state === 'start_duration' ? derivedEndCopy(date, ev.timing) : null;
  const degraded = ev.ok && ev.effective && ev.effective !== form.mode && form.mode !== 'date_only';
  const hasStart = modeHasStart(form.mode);
  const fieldErrors = (['start', 'end', 'duration'] as const).map((f) => ({ f, msg: err(f) })).filter((x) => x.msg);

  return (
    <View style={{ gap: 18 }} testID={testID}>
      <Segmented value={pending?.to ?? form.mode} options={TIMING_MODES.map((k) => ({ key: k, label: modeLabel(k) }))} onChange={choose} accent={accent} testID={`${testID}-mode`} />

      {pending ? (
        <Animated.View entering={enter} style={styles.preview} accessibilityLiveRegion="polite" testID={`${testID}-preview`}>
          <T variant="bodyStrong" color={S.fg}>
            {t.timingWillChange('').replace(/\s+$/, '')}
          </T>
          <View style={{ gap: 6 }}>
            {pending.lines.map((line, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={[styles.bullet, { backgroundColor: S.mute }]} />
                <T variant="small" color={S.fg} style={{ flex: 1 }}>
                  {line}
                </T>
              </View>
            ))}
          </View>
          <View style={styles.previewActions}>
            <View style={{ flex: 1 }}>
              <Button label={s.switchMode} kind="secondary" onPress={() => apply(previewSwitch(date, form, pending.to, deviceZone))} testID={`${testID}-confirm`} />
            </View>
            <Pressable onPress={() => setPending(null)} accessibilityRole="button" style={styles.quietBtn} testID={`${testID}-keep`}>
              <T variant="labelStrong" color={S.mute}>
                {s.keepMode}
              </T>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {/* fields for the chosen representation */}
      {form.mode !== 'date_only' ? (
        <View style={{ gap: 14 }}>
          {hasStart ? (
            <View style={styles.fieldRow}>
              <TimeInput
                label={t.start}
                value={form.start}
                onChangeText={(v) => set({ start: v })}
                onBlur={() => blurTime('start')}
                invalid={!!err('start')}
                accessibilityHint={err('start') ?? undefined}
                testID={`${testID}-start`}
              />
              {modeHasEnd(form.mode) ? (
                <TimeInput
                  label={t.end}
                  value={form.end}
                  onChangeText={(v) => {
                    set({ end: v });
                    if (prefill?.field === 'end') setPrefill(null);
                  }}
                  onBlur={() => blurTime('end')}
                  invalid={!!err('end')}
                  accessibilityHint={err('end') ?? (form.nextDay ? t.nextDay : undefined)}
                  suffix={form.nextDay ? s.nextDayShort : null}
                  suffixColor={accent}
                  testID={`${testID}-end`}
                />
              ) : null}
            </View>
          ) : null}
          {modeHasDuration(form.mode) ? (
            <View style={{ gap: 8 }} testID={`${testID}-duration`}>
              <T variant="label" color={S.mute}>{s.durationLabel}</T>
              <View style={styles.fieldRow}>
                <TimeInput
                  label={s.durationHoursLabel}
                  accessibilityLabel={s.durationHoursA11y}
                  value={durationParts.hours}
                  onChangeText={(v) => changeDuration('hours', v)}
                  onBlur={() => touch('duration')}
                  invalid={!!err('duration')}
                  accessibilityHint={err('duration') ?? s.durationPartsHint}
                  placeholder="0"
                  inputMode="numeric"
                  keyboardType="number-pad"
                  maxLength={3}
                  testID={`${testID}-duration-hours`}
                />
                <TimeInput
                  label={s.durationMinutesLabel}
                  accessibilityLabel={s.durationMinutesA11y}
                  value={durationParts.minutes}
                  onChangeText={(v) => changeDuration('minutes', v)}
                  onBlur={() => touch('duration')}
                  invalid={!!err('duration')}
                  accessibilityHint={err('duration') ?? s.durationPartsHint}
                  placeholder="0"
                  inputMode="numeric"
                  keyboardType="number-pad"
                  maxLength={2}
                  testID={`${testID}-duration-minutes`}
                />
              </View>
              {durEcho ? <T variant="small" color={S.mute}>{durEcho}</T> : null}
              {savedSeconds ? <T variant="small" color={S.mute} testID={`${testID}-duration-precision`}>{s.durationSecondsKept(savedSeconds)}</T> : null}
            </View>
          ) : null}

          {fieldErrors.map(({ f, msg }) => (
            <T key={f} variant="small" color={S.danger} accessibilityLiveRegion="polite" testID={`${testID}-error-${f}`}>
              {msg}
            </T>
          ))}

          {modeHasDuration(form.mode) && !form.duration.trim() && !fieldErrors.length ? (
            <T variant="small" color={S.mute}>
              {s.durationPartsHint}
            </T>
          ) : null}

          {modeHasEnd(form.mode) ? (
            <Toggle
              label={t.nextDay}
              hint={s.nextDayHint}
              value={form.nextDay}
              onChange={(v) => {
                set({ nextDay: v });
                if (prefill?.field === 'end') setPrefill(null);
              }}
              testID={`${testID}-nextday`}
            />
          ) : null}

          {derived ? (
            <View style={styles.derived} testID={`${testID}-derived-end`}>
              <View style={[styles.ring, { borderColor: S.mute }]} />
              <T variant="small" color={S.mute} style={{ flex: 1 }}>
                {derived}
              </T>
            </View>
          ) : null}
        </View>
      ) : null}

      {prefill ? (
        <Animated.View entering={enter}>
          <Note>{prefill.field === 'duration' ? s.prefilledDuration(prefill.text) : s.prefilledEnd(prefill.text)}</Note>
        </Animated.View>
      ) : null}

      {/* the active duration source, stated plainly */}
      {source ? (
        <View style={styles.source} accessible accessibilityLabel={source.value ? `${source.text}: ${source.value}` : source.text} testID={`${testID}-source`}>
          <View style={[styles.sourceDot, source.known ? { backgroundColor: accent } : { borderWidth: 1.2, borderColor: S.mute }]} />
          <T variant="small" color={source.known ? S.fg : S.mute} style={{ flex: 1 }}>
            {source.text}
          </T>
          {source.value ? (
            <T variant="dataStrong" color={S.fg}>
              {source.value}
            </T>
          ) : null}
        </View>
      ) : null}

      {degraded && ev.effective ? <Note>{s.savedAsState(modeLabel(ev.effective))}</Note> : null}
      {ev.note ? <Note tone="warn">{ev.note === 'ambiguous_time' ? s.noteAmbiguousTime : s.noteNonexistentTime}</Note> : null}

      {hasStart ? (
        <View style={{ gap: 6 }}>
          <TimeZonePicker
            value={ev.zoneUsed}
            deviceZone={deviceZone}
            invalid={!!ev.errors.zone}
            onChange={(zone) => {
              set({ zone });
              touch('zone');
            }}
            testID={testID}
          />
          {ev.errors.zone ? (
            <T variant="small" color={S.danger} accessibilityLiveRegion="polite">
              {fieldErrorCopy('zone')}
            </T>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function TimeInput({
  label,
  invalid,
  suffix,
  suffixColor,
  ...props
}: TextInputProps & { label: string; invalid?: boolean; suffix?: string | null; suffixColor?: string }) {
  const S = useSurface();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: 6 }, styles.timeCol]}>
      <T variant="label" color={S.mute}>
        {label}
      </T>
      <View style={[styles.timeBox, { borderBottomColor: invalid ? S.danger : focused ? S.fg : S.faint }]}>
        <TextInput
          placeholder={s.timePlaceholder}
          placeholderTextColor={S.mute}
          keyboardAppearance={S.name === 'night' ? 'dark' : 'light'}
          selectionColor={S.accent}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          autoCorrect={false}
          maxFontSizeMultiplier={1.35}
          accessibilityLabel={label}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={styles.timeInput}
        />
        {suffix ? (
          <T variant="labelStrong" color={suffixColor ?? S.mute} numberOfLines={1} style={{ flexShrink: 0 }}>
            {suffix}
          </T>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (S: Surface) => StyleSheet.create({
  preview: { gap: 12, paddingLeft: 14, borderLeftWidth: 2, borderLeftColor: S.faint },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { width: 4, height: 4, borderRadius: 2, marginTop: 8 },
  previewActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  quietBtn: { minHeight: HIT, justifyContent: 'center', paddingHorizontal: 4 },
  fieldRow: { flexDirection: 'row', gap: 20, alignItems: 'flex-end' },
  timeCol: { flex: 1, minWidth: 0 },
  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1.2, minHeight: 52 },
  timeInput: { flex: 1, minWidth: 0, fontFamily: fonts.mono, fontSize: 24, letterSpacing: 0.5, color: S.fg, paddingVertical: 8 },
  derived: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ring: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.2 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  sourceDot: { width: 8, height: 8, borderRadius: 4 },
});
