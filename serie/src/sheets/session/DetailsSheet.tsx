/**
 * Optional details for the CURRENT SELECTION, before saving. Nothing here is
 * required. "Applica" stores them as pendingDetails; the actual write happens
 * from the Lineup Save button (one copy per date, each editable afterwards).
 */
import { useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View, type ScrollView } from 'react-native';
import { router } from 'expo-router';
import type { Place } from '@/domain/types';
import { deviceTimeZone } from '@/domain/zoned';
import { DATE_ONLY } from '@/domain/timing';
import { useApp } from '@/state/store';
import { useActive, useMotionReduced } from '@/state/selectors';
import { setPendingDetails } from '@/state/actions';
import { Button, Field, Note, Section, Sheet } from '@/ui/controls';
import { HIT, palette, surfaces } from '@/ui/theme';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { PlaceEditor } from './PlaceEditor';
import { SheetScroll } from './SheetScroll';
import { TimingEditor } from './TimingEditor';
import { buildDetailsDraft, datesSummary } from './drafts';
import { compactPlace } from './placeForm';
import { emptyTimingForm, evaluateTiming, formFromTiming, isTimingFormEmpty, type TimingForm } from './timingForm';

const S = surfaces.night;
const s = t.sessionSheets;

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

export function DetailsSheet() {
  const selection = useApp((st) => st.selection);
  const pending = useApp((st) => st.pendingDetails);
  const today = useApp((st) => st.today);
  const active = useActive();
  const deviceZone = useMemo(() => deviceTimeZone(), []);

  const [notes, setNotes] = useState(pending?.notes ?? '');
  const [place, setPlace] = useState<Place | null>(pending?.place ?? null);
  const [timing, setTiming] = useState<TimingForm>(() => formFromTiming(pending?.timing ?? DATE_ONLY, deviceZone));
  const [attempted, setAttempted] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const reduced = useMotionReduced();
  const scrollRef = useRef<ScrollView>(null);
  const timingY = useRef(0);

  const n = selection.length;
  // Durations are re-derived for every selected date when saving; validate against the first one.
  const refDate = selection[0] ?? today;
  const ev = useMemo(() => evaluateTiming(refDate, timing, deviceZone), [refDate, timing, deviceZone]);
  const accent = active?.color ?? palette.flare;
  const empty = !notes.trim() && !compactPlace(place) && isTimingFormEmpty(timing);

  const apply = () => {
    setAttempted(true);
    if (!ev.ok) {
      // Only timing fields can be invalid here: bring them into view.
      scrollRef.current?.scrollTo({ y: Math.max(0, timingY.current - 8), animated: !reduced });
      AccessibilityInfo.announceForAccessibility(s.fixToSave);
      return;
    }
    setPendingDetails(buildDetailsDraft({ notes, place, timing: ev.timing }));
    close();
  };

  const clear = () => {
    setNotes('');
    setPlace(null);
    setTiming(emptyTimingForm(deviceZone));
    setAttempted(false);
    setFormKey((k) => k + 1); // resets touched/preview state inside the editors
    setPendingDetails(null);
  };

  const title = n > 0 ? t.detailsForSelection(n) : s.detailsTitle;
  const eyebrow = [t.detailsOptional, active?.name, n ? datesSummary(selection) : null].filter(Boolean).join(' · ');
  const primary = n > 1 ? t.applyToAll(n) : n === 1 ? s.applyToOne : s.keepDetails;

  return (
    <Sheet
      title={title}
      eyebrow={eyebrow}
      testID="details-sheet"
      scroll={false}
      footer={
        <View style={{ gap: 6 }}>
          {attempted && !ev.ok ? <Note tone="error">{s.fixToSave}</Note> : null}
          <Button label={primary} onPress={apply} color={accent} testID="details-apply" />
          {pending || !empty ? (
            <Pressable onPress={clear} accessibilityRole="button" style={styles.clear} testID="details-clear">
              <T variant="labelStrong" color={S.mute}>
                {s.clearDetails}
              </T>
            </Pressable>
          ) : null}
        </View>
      }
    >
      <SheetScroll ref={scrollRef}>
        {n === 0 ? <Note>{s.detailsNoSelection}</Note> : null}

        <Section label={t.notes}>
          <Field value={notes} onChangeText={setNotes} placeholder={t.notesPlaceholder} multiline accessibilityLabel={t.notes} testID="details-notes" />
        </Section>

        <Section label={t.place}>
          <PlaceEditor key={`p${formKey}`} value={place} onChange={setPlace} accent={accent} testID="details-place" />
        </Section>

        <View onLayout={(e) => (timingY.current = e.nativeEvent.layout.y)}>
          <Section label={t.timing}>
            <TimingEditor key={`t${formKey}`} date={refDate} value={timing} onChange={setTiming} deviceZone={deviceZone} showErrors={attempted} accent={accent} testID="details-timing" />
          </Section>
        </View>

        <View style={styles.notes}>
          {n !== 1 ? (
            <T variant="small" color={S.fg} testID="details-duration-note">
              {n > 1 ? t.applyDurationNote(n) : s.durationEachNote}
            </T>
          ) : null}
          <T variant="small" color={S.mute}>
            {t.eachSessionEditable}
          </T>
          <T variant="small" color={S.mute}>
            {s.detailsSaveHint}
          </T>
        </View>
      </SheetScroll>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  notes: { gap: 6, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: S.faint },
  clear: { minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
});
