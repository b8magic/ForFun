import { useSurface, useThemedStyles } from '@/ui/useTheme';
/**
 * "Modifica sessione" — one saved session. Date, activity, notes, place and
 * timing are each independently optional and can be cleared. Writes go
 * through state actions (updateSession / deleteSession); provenance and
 * export links are read-only lookups. Deleting never touches calendar events.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, Pressable, StyleSheet, View, type ScrollView } from 'react-native';
import { router } from 'expo-router';
import type { Category, Place, Session } from '@/domain/types';
import { deviceTimeZone } from '@/domain/zoned';
import { getRepositories } from '@/data/database';
import { DomainError, type ExportLinkRecord, type ProvenanceRecord } from '@/data/repositories';
import { useApp } from '@/state/store';
import { useMotionReduced } from '@/state/selectors';
import { deleteSession, showToast, updateSession } from '@/state/actions';
import { Button, Field, Note, Section, Sheet } from '@/ui/controls';
import { HIT, type Surface } from '@/ui/theme';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { KeyboardSafe } from '@/sheets/manage/parts';
import { ActivityPicker } from './ActivityPicker';
import { DateEditor } from './DateEditor';
import { PlaceEditor } from './PlaceEditor';
import { SheetScroll } from './SheetScroll';
import { TimingEditor } from './TimingEditor';
import { useConfirmDiscard } from './useConfirmDiscard';
import { buildSessionPatch, checkSessionDate, instantDate, isEmptyPatch, provenanceSpanText, shortDate } from './drafts';
import { evaluateTiming, formFromTiming, type TimingForm } from './timingForm';

const s = t.sessionSheets;

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** Repository failures in words the user can act on. */
function saveErrorText(e: unknown): string {
  if (e instanceof DomainError) {
    if (e.code === 'session_missing') return s.errSessionMissing;
    if (e.code === 'category_missing') return s.errCategoryMissing;
    if (e.code === 'invalid_date') return s.errDateFormat;
  }
  return t.errorGeneric;
}

export function EditSessionSheet({ id }: { id: string }) {
  const S = useSurface();
  const session = useApp((st) => st.sessions.find((x) => x.id === id) ?? null);
  const categories = useApp((st) => st.categories);
  const today = useApp((st) => st.today);
  const [deleting, setDeleting] = useState(false);

  if (!session) {
    // Just deleted: the sheet is closing, don't flash "not found".
    if (deleting) return <View style={{ flex: 1, backgroundColor: S.bg }} />;
    return (
      <Sheet title={s.sessionNotFound} eyebrow={t.session} testID="session-missing">
        <T variant="body" color={S.mute}>
          {s.sessionNotFoundBody}
        </T>
        <Button label={t.close} kind="secondary" onPress={close} testID="session-missing-close" />
      </Sheet>
    );
  }
  return <Editor key={session.id} session={session} categories={categories} today={today} onDeleting={setDeleting} />;
}

function Editor({ session, categories, today, onDeleting }: { session: Session; categories: Category[]; today: string; onDeleting: (v: boolean) => void }) {
  const S = useSurface();
  const styles = useThemedStyles(createStyles);
  const deviceZone = useMemo(() => deviceTimeZone(), []);
  const [dateText, setDateText] = useState(session.date);
  const [categoryId, setCategoryId] = useState(session.categoryId);
  const [notes, setNotes] = useState(session.notes ?? '');
  const [place, setPlace] = useState<Place | null>(session.place);
  const [timing, setTiming] = useState<TimingForm>(() => formFromTiming(session.timing, deviceZone));
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [prov, setProv] = useState<ProvenanceRecord[]>([]);
  const [links, setLinks] = useState<ExportLinkRecord[]>([]);
  const reduced = useMotionReduced();
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef({ date: 0, timing: 0 });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const repos = await getRepositories();
        const [p, l] = await Promise.all([repos.provenance.listBySession(session.id), repos.exportLinks.bySession(session.id)]);
        if (alive) {
          setProv(p);
          setLinks(l);
        }
      } catch {
        /* read-only info: absence is not an error worth blocking on */
      }
    })();
    return () => {
      alive = false;
    };
  }, [session.id]);

  const dateCheck = checkSessionDate(dateText, today);
  const date = dateCheck.ok ? dateCheck.date : session.date;
  const ev = useMemo(() => evaluateTiming(date, timing, deviceZone), [date, timing, deviceZone]);
  const category = categories.find((c) => c.id === categoryId) ?? null;
  const accent = category?.color ?? S.accent;
  const patch = ev.ok && ev.timing ? buildSessionPatch(session, { date, categoryId, notes, place, timing: ev.timing }) : null;
  const dirty = !dateCheck.ok || !ev.ok || (patch != null && !isEmptyPatch(patch));
  const valid = dateCheck.ok && ev.ok;
  const allowLeave = useConfirmDiscard(dirty && busy == null);

  const save = async () => {
    setAttempted(true);
    setError(null);
    if (!valid || !patch) {
      // The marked field may be far up the sheet: bring the first one into view.
      const y = !dateCheck.ok ? sectionY.current.date : sectionY.current.timing;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: !reduced });
      AccessibilityInfo.announceForAccessibility(s.fixToSave);
      return;
    }
    Keyboard.dismiss();
    if (isEmptyPatch(patch)) return close();
    setBusy('save');
    try {
      await updateSession(session.id, patch);
      showToast(t.changesSaved);
      allowLeave();
      close();
    } catch (e) {
      const msg = saveErrorText(e);
      setError(msg);
      AccessibilityInfo.announceForAccessibility(msg);
      setBusy(null);
    }
  };

  const askDelete = () => {
    setConfirmDelete(true);
    // The button that was pressed disappears; tell VoiceOver what is being asked.
    AccessibilityInfo.announceForAccessibility(t.deleteSessionConfirm);
  };

  const remove = async () => {
    setBusy('delete');
    setError(null);
    onDeleting(true);
    try {
      await deleteSession(session.id);
      showToast(s.sessionDeleted);
      allowLeave();
      close();
    } catch (e) {
      onDeleting(false);
      setError(saveErrorText(e));
      setBusy(null);
    }
  };

  const original = categories.find((c) => c.id === session.categoryId);
  const eyebrow = [original?.name, shortDate(session.date)].filter(Boolean).join(' · ');

  return (
    <KeyboardSafe>
      <Sheet
        title={t.editSession}
        eyebrow={eyebrow}
        testID="session-editor"
        scroll={false}
        footer={
          <View style={{ gap: 10 }}>
            {error ? <Note tone="error">{error}</Note> : null}
            {attempted && !valid ? <Note tone="error">{s.fixToSave}</Note> : null}
            <Button label={s.saveChanges} onPress={save} color={accent} disabled={!dirty} busy={busy === 'save'} testID="session-save" />
          </View>
        }
      >
        <SheetScroll ref={scrollRef}>
          {prov.length ? <Provenance records={prov} zone={deviceZone} /> : null}

          <View onLayout={(e) => (sectionY.current.date = e.nativeEvent.layout.y)}>
            <Section label={t.date}>
              <DateEditor value={dateText} onChange={setDateText} today={today} fallback={date} showErrors={attempted} testID="session-date" />
            </Section>
          </View>

          {categories.length > 1 || categoryId !== session.categoryId ? (
            <Section label={t.activity}>
              <ActivityPicker categories={categories} value={categoryId} original={session.categoryId} onChange={setCategoryId} testID="session-activity" />
            </Section>
          ) : null}

          <Section label={t.notes}>
            <Field value={notes} onChangeText={setNotes} multiline accessibilityLabel={t.notes} testID="session-notes" />
          </Section>

          <Section label={t.place}>
            <PlaceEditor value={place} onChange={setPlace} accent={accent} testID="session-place" />
          </Section>

          <View onLayout={(e) => (sectionY.current.timing = e.nativeEvent.layout.y)}>
            <Section label={t.timing}>
              <TimingEditor date={date} value={timing} onChange={setTiming} deviceZone={deviceZone} showErrors={attempted} accent={accent} testID="session-timing" />
            </Section>
          </View>

          {links.length ? <ExportLinks links={links} zone={deviceZone} /> : null}

          <View style={styles.danger}>
            {confirmDelete ? (
              <View style={{ gap: 14 }} accessibilityLiveRegion="polite" testID="session-delete-confirm">
                <T variant="body" color={S.fg}>
                  {t.deleteSessionConfirm}
                </T>
                <View style={styles.dangerRow}>
                  <View style={{ flex: 1 }}>
                    <Button label={t.delete} kind="danger" onPress={remove} busy={busy === 'delete'} testID="session-delete-yes" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button label={t.cancel} kind="secondary" onPress={() => setConfirmDelete(false)} testID="session-delete-no" />
                  </View>
                </View>
              </View>
            ) : (
              <Pressable onPress={askDelete} accessibilityRole="button" style={styles.quiet} testID="session-delete">
                <T variant="labelStrong" color={S.danger}>
                  {t.deleteSession}
                </T>
              </Pressable>
            )}
          </View>
        </SheetScroll>
      </Sheet>
    </KeyboardSafe>
  );
}

function providerLabel(provider: string, accountId: string): string {
  const name = provider === 'google' ? t.google : t.apple;
  return accountId.includes('@') ? `${name} (${accountId})` : name;
}

function Provenance({ records, zone }: { records: ProvenanceRecord[]; zone: string }) {
  const S = useSurface();
  return (
    <Section label={s.provenance}>
      {records.map((r) => {
        const on = instantDate(r.importedAt, zone);
        const span = provenanceSpanText({ allDay: r.sourceAllDay, start: r.sourceStart, end: r.sourceEnd }, zone);
        return (
          <View key={r.id} style={{ gap: 4 }} testID="session-provenance">
            <T variant="body" color={S.fg}>
              {s.importedFrom(providerLabel(r.provider, r.accountId), r.originalTitle)}
            </T>
            <T variant="small" color={S.mute}>
              {[s.importedSpan(span), on ? s.importedOn(shortDate(on)) : null].filter(Boolean).join(' · ')}
            </T>
          </View>
        );
      })}
    </Section>
  );
}

function ExportLinks({ links, zone }: { links: ExportLinkRecord[]; zone: string }) {
  const S = useSurface();
  const styles = useThemedStyles(createStyles);
  return (
    <Section label={s.exportLinks} hint={s.exportLinksNote}>
      {links.map((l, i) => {
        const on = instantDate(l.exportedAt, zone);
        return (
          <View key={l.id} style={[styles.linkRow, i > 0 && styles.linkRule]} testID={`session-export-${l.provider}`}>
            <T variant="body" color={S.fg}>
              {providerLabel(l.provider, l.accountId)}
            </T>
            <T variant="labelStrong" color={S.fg}>
              {[s.exportLinkStatus[l.status] ?? l.status, on ? s.exportLinkOn(shortDate(on)) : null].filter(Boolean).join(' · ')}
            </T>
            {l.snapshot?.title ? (
              <T variant="small" color={S.mute} numberOfLines={2}>
                {l.snapshot.title}
              </T>
            ) : null}
          </View>
        );
      })}
    </Section>
  );
}

const createStyles = (S: Surface) => StyleSheet.create({
  danger: { marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: S.faint },
  dangerRow: { flexDirection: 'row', gap: 12 },
  quiet: { minHeight: HIT, justifyContent: 'center', alignSelf: 'flex-start' },
  linkRow: { gap: 4, paddingVertical: 10 },
  linkRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: S.faint },
});
