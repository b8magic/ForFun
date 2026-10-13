import { useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, Pressable, StyleSheet, View } from 'react-native';
import type { Category, NamedPeriod, Session } from '@/domain/types';
import { firstOfMonth, lastOfMonth } from '@/domain/dates';
import { sessionsForNamedPeriod } from '@/domain/namedPeriods';
import { summarize } from '@/domain/stats';
import { deleteNamedPeriod, showToast } from '@/state/actions';
import { useApp } from '@/state/store';
import { closeSheet } from '@/sheets/manage/parts';
import { useConfirmDiscard } from '@/sheets/session/useConfirmDiscard';
import { Button, Note, Section, Sheet } from '@/ui/controls';
import { Chevron } from '@/ui/glyphs';
import { T } from '@/ui/T';
import { space } from '@/ui/theme';
import { useSurface } from '@/ui/useTheme';
import { durationLine, shortDate } from '@/places/time/format';
import { activityScopeLabel, draftForPeriod, groupPeriodSessions, type PeriodDraft } from './model';
import { PeriodEditor } from './PeriodEditor';
import { PeriodMosaic } from './PeriodMosaic';
import { PeriodSessionGroup } from './PeriodSessions';
import { PeriodSummary } from './PeriodSummary';

type Mode = { kind: 'list' } | { kind: 'detail'; id: string } | { kind: 'form'; period?: NamedPeriod; draft: PeriodDraft };

export function PeriodsSheet({ initialId }: { initialId?: string }) {
  const C = useSurface();
  const periods = useApp((s) => s.namedPeriods);
  const categories = useApp((s) => s.categories);
  const sessions = useApp((s) => s.sessions);
  const today = useApp((s) => s.today);
  const viewMonth = useApp((s) => s.viewMonth);
  const [mode, setMode] = useState<Mode>(() => initialId ? { kind: 'detail', id: initialId } : { kind: 'list' });
  const backToList = () => setMode({ kind: 'list' });
  const openPeriod = (period: NamedPeriod) => setMode({ kind: 'detail', id: period.id });
  const cards = useMemo(() => periods.map((period) => ({ period, matches: sessionsForNamedPeriod(sessions, period) })), [periods, sessions]);

  const create = () => {
    const from = firstOfMonth(viewMonth);
    const to = lastOfMonth(viewMonth);
    setMode({
      kind: 'form',
      draft: {
        name: '',
        startDate: from > today ? today : from,
        endDate: to > today ? today : to,
        scope: 'all',
        categoryIds: [],
        note: '',
      },
    });
  };

  if (mode.kind === 'form') {
    return (
      <PeriodEditor
        period={mode.period}
        initialDraft={mode.draft}
        categories={categories}
        sessions={sessions}
        onSaved={openPeriod}
        onCancel={() => {
          const period = mode.period && periods.find((p) => p.id === mode.period?.id);
          if (period) openPeriod(period);
          else backToList();
        }}
      />
    );
  }

  if (mode.kind === 'detail') {
    const period = periods.find((p) => p.id === mode.id);
    if (!period) {
      return (
        <Sheet title="Periodo non trovato" onBack={backToList} backLabel="Torna ai periodi" testID="period-missing">
          <T color={C.mute}>Il periodo potrebbe essere stato eliminato. Le sessioni restano nella Storia.</T>
          <Button label="Tutti i periodi" kind="secondary" onPress={backToList} />
        </Sheet>
      );
    }
    return (
      <PeriodDetail
        key={period.id}
        period={period}
        sessions={sessions}
        categories={categories}
        onBack={backToList}
        onEdit={() => setMode({ kind: 'form', period, draft: draftForPeriod(period) })}
        onDeleted={backToList}
      />
    );
  }

  return (
    <Sheet title="Periodi" testID="periods-sheet" scroll={false} footer={<Button label="Crea periodo" onPress={create} testID="periods-create" />}>
      <FlatList
        data={cards}
        keyExtractor={({ period }) => period.id}
        style={{ marginHorizontal: -space.gutter }}
        contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 4, paddingBottom: 24, gap: 18 }}
        renderItem={({ item }) => <PeriodCard period={item.period} sessions={item.matches} categories={categories} onPress={() => openPeriod(item.period)} />}
        ListEmptyComponent={
          <View style={{ gap: 10, paddingVertical: 22 }} testID="periods-empty">
            <T variant="title" color={C.fg}>Dai un nome a un periodo</T>
            <T color={C.mute}>Un viaggio, una stagione, un progetto. Scegli le date e ritrova le sessioni di quel periodo.</T>
          </View>
        }
        testID="periods-list"
      />
    </Sheet>
  );
}

function PeriodCard({ period, sessions, categories, onPress }: {
  period: NamedPeriod;
  sessions: readonly Session[];
  categories: readonly Category[];
  onPress: () => void;
}) {
  const C = useSurface();
  const summary = useMemo(() => summarize(sessions), [sessions]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${period.name}, dal ${shortDate(period.startDate)} al ${shortDate(period.endDate)}, ${activityScopeLabel(period, categories)}, ${summary.sessions} sessioni in ${summary.activeDays} giorni. ${durationLine(summary.duration)}. Apri periodo`}
      style={({ pressed }) => [styles.card, { borderColor: C.faint, backgroundColor: C.raised, opacity: pressed ? 0.75 : 1 }]}
      testID={`period-${period.id}`}
    >
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <T variant="title" color={C.fg} style={{ flex: 1 }}>{period.name}</T>
        <Chevron dir="right" color={C.mute} size={8} />
      </View>
      <T variant="small" color={C.mute}>{`${shortDate(period.startDate)}–${shortDate(period.endDate)}`}</T>
      <T variant="small" color={C.mute}>{activityScopeLabel(period, categories)}</T>
      <PeriodSummary summary={summary} />
      <PeriodMosaic startDate={period.startDate} endDate={period.endDate} sessions={sessions} categories={categories} compact />
    </Pressable>
  );
}

function PeriodDetail({ period, sessions, categories, onBack, onEdit, onDeleted }: {
  period: NamedPeriod;
  sessions: readonly Session[];
  categories: readonly Category[];
  onBack: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const C = useSurface();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const matches = useMemo(() => sessionsForNamedPeriod(sessions, period), [sessions, period]);
  const groups = useMemo(() => groupPeriodSessions(matches), [matches]);
  const summary = useMemo(() => summarize(matches), [matches]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const includedCategories = period.scope === 'all' ? categories : categories.filter((c) => period.categoryIds.includes(c.id));
  useConfirmDiscard(false, { blocked: busy });

  const remove = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await deleteNamedPeriod(period.id);
      showToast('Periodo eliminato. Le sessioni sono conservate.');
      onDeleted();
    } catch {
      setError('Non è stato possibile eliminare il periodo. Riprova.');
      inFlight.current = false;
      setBusy(false);
    }
  };
  const askDelete = () => {
    setConfirmDelete(true);
    AccessibilityInfo.announceForAccessibility(`Eliminare ${period.name}? Le sessioni registrate resteranno in Serie.`);
  };

  const header = (
    <View style={{ gap: 22, paddingBottom: 22 }}>
      <View style={{ gap: 12 }}>
        <T color={C.mute}>{`${shortDate(period.startDate)}–${shortDate(period.endDate)}`}</T>
        <PeriodSummary summary={summary} testID="period-detail-summary" />
        <PeriodMosaic startDate={period.startDate} endDate={period.endDate} sessions={matches} categories={categories} />
      </View>
      <Section label={period.scope === 'all' ? 'Tutte le attività' : 'Attività incluse'}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {includedCategories.map((category) => (
            <View key={category.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <View style={[styles.dot, { backgroundColor: category.color, borderColor: C.faint }]} />
              <T variant="small" color={C.fg}>{category.name}</T>
            </View>
          ))}
          {!includedCategories.length ? <T color={C.mute}>Nessuna attività disponibile.</T> : null}
        </View>
      </Section>
      {period.note ? <T color={C.fg}>{period.note}</T> : null}
      <T variant="small" color={C.mute}>Il periodo include automaticamente le sessioni nelle date e nelle attività scelte.</T>
      <View style={{ gap: 12 }}>
        {error ? <Note tone="error">{error}</Note> : null}
        {confirmDelete ? (
          <View style={{ gap: 12 }} testID="period-delete-question">
            <T variant="bodyStrong" color={C.fg}>{`Eliminare “${period.name}”?`}</T>
            <T color={C.mute}>Verrà eliminato solo questo periodo. Le sessioni registrate resteranno in Serie.</T>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Button label="Annulla" kind="secondary" onPress={() => setConfirmDelete(false)} disabled={busy} testID="period-delete-cancel" /></View>
              <View style={{ flex: 1 }}><Button label="Elimina periodo" kind="danger" onPress={() => void remove()} busy={busy} testID="period-delete-confirm" /></View>
            </View>
          </View>
        ) : (
          <Pressable onPress={askDelete} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }} testID="period-delete">
            <T variant="body" color={C.danger}>Elimina periodo</T>
          </Pressable>
        )}
      </View>
      <T variant="label" color={C.mute}>Sessioni nel periodo</T>
    </View>
  );

  return (
    <Sheet
      title={period.name}
      onBack={() => { if (!inFlight.current) onBack(); }}
      backLabel="Torna ai periodi"
      onClose={() => { if (!inFlight.current) closeSheet(); }}
      scroll={false}
      footer={<Button label="Modifica periodo" onPress={onEdit} disabled={busy} testID="period-edit" />}
      testID="period-detail"
    >
      <FlatList
        data={groups}
        keyExtractor={([date]) => date}
        style={{ marginHorizontal: -space.gutter }}
        contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 4, paddingBottom: 24, gap: 18 }}
        ListHeaderComponent={header}
        ListEmptyComponent={<T color={C.mute}>Nessuna sessione corrisponde a questo periodo.</T>}
        renderItem={({ item: [date, day] }) => <PeriodSessionGroup date={date} sessions={day} catById={catById} />}
        testID="period-detail-sessions"
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth },
});
