/**
 * Importa — one activity per operation:
 *   activity → connection + source calendars → range + filters → review → confirm.
 * Import only reads the source calendar. Nothing is written locally until the
 * user confirms the reviewed selection; the batch id is kept for the whole
 * wizard so a retried confirmation cannot duplicate sessions.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { CalendarProvider, ExternalCalendar, LabelOption, ProviderKind } from '@/calendar/types';
import { ProviderError } from '@/calendar/types';
import {
  buildReview,
  commitImport,
  defaultSelection,
  deselectAll,
  reconcileSelection,
  selectAll,
  selectedItems,
  selectionCounts,
  scopeAll,
  scopeStatus,
  toggleSelected,
  type CommitImportResult,
  type ImportStatus,
  type ReviewItem,
  type ReviewScope,
} from '@/calendar/importEngine';
import type { ID, Session } from '@/domain/types';
import { deviceTimeZone } from '@/domain/zoned';
import { getRepositories } from '@/data/database';
import { newId, nowIso } from '@/platform/ids';
import { useApp } from '@/state/store';
import { afterCommit } from '@/state/hooks';
import { createCategory, focusHistoryMonth, refreshAll, switchActivity } from '@/state/actions';
import { Sheet, Section, Button, Field, Note, Segmented } from '@/ui/controls';
import { T } from '@/ui/T';
import { activityColors, palette, surfaces } from '@/ui/theme';
import { t } from '@/i18n/it';
import { ActivityPicker } from '@/sheets/session/ActivityPicker';
import { nameIssue, suggestLook, errorText } from '@/sheets/manage/helpers';
import { timingSummary } from '@/places/time/format';
import { monthKey, monthOf } from '@/domain/dates';
import { useConnections } from './useConnections';
import { CalendarList, Check, checkRange, DateText, Footer, LabelChips, longDateIt, Pill, presetRange, ProviderChoice, PROVIDER_NAMES, RANGE_PRESETS, Steps, usable, type RangePreset } from './parts';
import { useMountedRef } from './useMountedRef';

const S = surfaces.night;
const STEPS = 4;

type Scope = 'all' | 'new' | 'review' | 'excluded';
const SCOPES: Record<Scope, ReviewScope> = {
  all: scopeAll,
  new: scopeStatus('new'),
  review: (i) => i.selectable && i.status !== 'new',
  excluded: (i) => !i.selectable,
};
const STATUS_TONE: Record<ImportStatus, 'good' | 'warn' | 'neutral' | 'bad' | 'accent'> = {
  new: 'good',
  possible_match: 'warn',
  imported_then_deleted: 'warn',
  already_imported: 'neutral',
  own_export: 'neutral',
  cancelled: 'bad',
};

function providerMessage(e: unknown): string {
  if (e instanceof ProviderError) {
    switch (e.code) {
      case 'offline':
        return 'Sei offline: impossibile leggere il calendario adesso. Riprova quando torna la connessione.';
      case 'unauthorized':
        return 'L’accesso al calendario è scaduto o è stato revocato. Ricollega l’account.';
      case 'forbidden':
        return 'Il calendario non consente la lettura con questo account.';
      case 'rate_limited':
        return 'Il servizio del calendario chiede di rallentare. Riprova tra poco.';
      default:
        return e.message || t.errorGeneric;
    }
  }
  return e instanceof Error && e.message ? e.message : t.errorGeneric;
}

export function ImportWizard() {
  const categories = useApp((s) => s.categories);
  const activeId = useApp((s) => s.activeId);
  const sessions = useApp((s) => s.sessions);
  const today = useApp((s) => s.today);
  const conn = useConnections();

  const [step, setStep] = useState(1);
  // 1 — activity
  const [categoryId, setCategoryId] = useState<ID | null>(activeId);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  // 2 — source
  const [provider, setProvider] = useState<ProviderKind | null>(null);
  const [calsBy, setCalsBy] = useState<Partial<Record<ProviderKind, ExternalCalendar[]>>>({});
  const [calSel, setCalSel] = useState<Set<string>>(new Set());
  const [labels, setLabels] = useState<LabelOption[]>([]);
  const [sourceError, setSourceError] = useState<string | null>(null);
  // 3 — filters
  const [preset, setPreset] = useState<RangePreset>('1y');
  const initial = presetRange('1y', today);
  const [from, setFrom] = useState<string>(initial.from);
  const [to, setTo] = useState<string>(initial.to);
  const [titleText, setTitleText] = useState('');
  const [labelSel, setLabelSel] = useState<Set<string>>(new Set());
  const [fetched, setFetched] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  // 4 — review
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<Scope>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const batchId = useRef(newId());
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [result, setResult] = useState<CommitImportResult | null>(null);

  const category = categories.find((c) => c.id === categoryId) ?? null;
  const p: CalendarProvider | null = provider && conn.providers ? conn.providers[provider] : null;
  const labelsSupported = !!p?.capabilities.eventLabels;

  useEffect(() => () => abort.current?.abort(), []);

  // default provider: the first one that can read (adjusted during render)
  if (!provider) {
    const k = (['google', 'apple'] as ProviderKind[]).find((x) => usable(conn.connections[x], 'read'));
    if (k) setProvider(k);
  }
  const chooseProvider = (k: ProviderKind | null) => {
    setProvider(k);
    setCalSel(new Set());
    setLabelSel(new Set());
    setSourceError(null);
  };

  // calendars + labels of the chosen provider, read once per provider. Storing the calendars re-runs
  // this effect, so a load is never cancelled by a re-run (the labels, read right after, were dropped
  // that way): only an unmount drops the result. A failed load may be retried.
  const mounted = useMountedRef();
  const requested = useRef<Partial<Record<ProviderKind, true>>>({});
  const providerNow = useRef(provider);
  useEffect(() => {
    providerNow.current = provider;
  }, [provider]);
  useEffect(() => {
    if (!p || !usable(conn.connections[p.kind], 'read') || requested.current[p.kind]) return;
    const kind = p.kind;
    requested.current[kind] = true;
    (async () => {
      try {
        const cals = await p.listCalendars();
        if (!mounted.current) return;
        setCalsBy((m) => ({ ...m, [kind]: cals }));
        const readable = cals.filter((c) => c.canRead);
        if (readable.length === 1 && providerNow.current === kind) setCalSel(new Set([readable[0].calendarId]));
        if (p.capabilities.eventLabels) {
          const l = await p.listLabels().catch(() => []);
          if (mounted.current) setLabels(l);
        }
      } catch (e) {
        delete requested.current[kind];
        if (mounted.current) setSourceError(providerMessage(e));
      }
    })();
  }, [p, conn.connections, mounted]);
  const calendars = provider ? (calsBy[provider] ?? null) : null;

  const counts = useMemo(() => selectionCounts(items, selection, SCOPES[scope]), [items, selection, scope]);
  const totalCounts = useMemo(() => selectionCounts(items, selection), [items, selection]);
  const visible = useMemo(() => items.filter(SCOPES[scope]), [items, scope]);
  const scopeCount = useMemo(() => {
    const out: Record<Scope, number> = { all: 0, new: 0, review: 0, excluded: 0 };
    for (const i of items) for (const k of Object.keys(SCOPES) as Scope[]) if (SCOPES[k](i)) out[k]++;
    return out;
  }, [items]);
  const sessionById = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);

  const range = checkRange(from, to, today);

  const runSearch = useCallback(async () => {
    if (!p || !category || !range.ok || !calSel.size) return;
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setFetchError(null);
    setFetched(0);
    try {
      const calendarIds = [...calSel];
      const events = await p.listEvents({ calendarIds, from: range.from, to: range.to, includeCancelled: true, signal: ac.signal, onProgress: (n) => setFetched(n) });
      if (ac.signal.aborted) {
        setFetched(null);
        return;
      }
      const repos = await getRepositories();
      const chosen = (calendars ?? []).filter((c) => calSel.has(c.calendarId));
      const accounts = [...new Set(chosen.map((c) => c.accountId))];
      const provenance = (await Promise.all(accounts.map((a) => repos.provenance.listForCalendars(p.kind, a, chosen.filter((c) => c.accountId === a).map((c) => c.calendarId))))).flat();
      const [localSessions, exportLinks] = await Promise.all([repos.sessions.listAll(), repos.exportLinks.all()]);
      const next = buildReview({
        events,
        filters: { calendarIds, provider: p.kind, titleContains: titleText.trim() || null, labelIds: labelsSupported && labelSel.size ? [...labelSel] : null, from: range.from, to: range.to },
        capabilities: p.capabilities,
        calendars: calendars ?? [],
        provenance,
        localSessions,
        exportLinks,
        category: { id: category.id, name: category.name },
        deviceTimeZone: deviceTimeZone(),
      });
      // keep choices when the same batch is searched again
      setSelection((prev) => (items.length ? reconcileSelection(items, prev, next) : defaultSelection(next)));
      setItems(next);
      setScope('all');
      setFetched(null);
      setStep(4);
    } catch (e) {
      setFetched(null);
      if (ac.signal.aborted) return;
      setFetchError(providerMessage(e));
    }
  }, [p, category, range, calSel, calendars, titleText, labelsSupported, labelSel, items]);

  const confirm = useCallback(async () => {
    if (!category) return;
    setCommitting(true);
    setCommitError(null);
    try {
      const repos = await getRepositories();
      const r = await commitImport(repos, { category: { id: category.id }, items: selectedItems(items, selection), batchId: batchId.current, now: nowIso(), newId });
      await refreshAll();
      // imported sessions go through the same post-commit path (auto export skips them unless forwarding is on)
      afterCommit(r.sessions).catch(() => undefined);
      setResult(r);
      setStep(5);
    } catch (e) {
      setCommitError(errorText(e));
    } finally {
      setCommitting(false);
    }
  }, [category, items, selection]);

  const doCreate = useCallback(async () => {
    const issue = nameIssue(newName, categories);
    if (issue) {
      setCreateError(errorText(issue));
      return;
    }
    try {
      const look = suggestLook(categories, activityColors);
      const c = await createCategory({ name: newName.trim(), ...look });
      setCategoryId(c.id);
      setCreating(false);
      setNewName('');
      setCreateError(null);
    } catch (e) {
      setCreateError(errorText(e));
    }
  }, [newName, categories]);

  // ─── step bodies ───────────────────────────────────────────────────────────

  if (step === 5 && result && category) {
    const n = result.sessions.length;
    const dates = result.sessions.map((s) => s.date).sort();
    return (
      <Sheet
        title={t.importTitle}
        eyebrow="Fatto"
        testID="import-done"
        footer={
          <Footer
            back={{ label: 'Chiudi', onPress: () => router.back() }}
            next={
              <Button
                label={n ? `Vai a ${category.name}` : 'Chiudi'}
                onPress={async () => {
                  if (n) {
                    await switchActivity(category.id);
                    focusHistoryMonth(monthKey(monthOf(dates[dates.length - 1])));
                    router.dismissTo('/');
                  } else router.back();
                }}
                color={category.color}
                testID="import-open-activity"
              />
            }
          />
        }
      >
        <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
          <T variant="hero" color={S.fg}>
            {String(n)}
          </T>
          <T variant="title" color={S.fg}>
            {n ? `${t.importDone(n)} in ${category.name}` : 'Nessuna sessione importata'}
          </T>
          {n ? (
            <T variant="small" color={S.mute}>
              {dates.length > 1 ? `Dal ${longDateIt(dates[0])} al ${longDateIt(dates[dates.length - 1])}.` : `Il ${longDateIt(dates[0])}.`} Titoli originali e orari sono conservati come provenienza.
            </T>
          ) : null}
        </View>
        {result.skipped.length ? (
          <Note>
            {`${result.skipped.length} ${result.skipped.length === 1 ? 'evento saltato' : 'eventi saltati'}: già presenti in Serie o non importabili. Nessun doppione creato.`}
          </Note>
        ) : null}
        <Note>L’importazione legge soltanto: il calendario di origine non è stato modificato.</Note>
      </Sheet>
    );
  }

  if (step === 4) {
    const allSelected = counts.selectable > 0 && counts.selected === counts.selectable;
    const scopeName = { all: 'in elenco', new: 'nuovi', review: 'da verificare', excluded: 'esclusi' }[scope];
    return (
      <Sheet
        title={t.review}
        eyebrow={`${t.importTitle} · ${category?.name ?? ''}`}
        scroll={false}
        testID="import-review"
        footer={
          <View style={{ gap: 8 }}>
            {commitError ? <Note tone="error">{commitError}</Note> : null}
            <Footer
              back={{ label: 'Filtri', onPress: () => setStep(3) }}
              next={<Button label={totalCounts.selected ? t.confirmImport(totalCounts.selected) : 'Nessun evento selezionato'} disabled={!totalCounts.selected} busy={committing} onPress={confirm} color={category?.color} testID="import-confirm" />}
            />
          </View>
        }
      >
        <Steps at={4} of={STEPS} title={t.review} />
        <View style={{ gap: 10 }}>
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { key: 'all', label: `Tutti ${scopeCount.all}` },
              { key: 'new', label: `Nuovi ${scopeCount.new}` },
              { key: 'review', label: `Da verificare ${scopeCount.review}` },
              { key: 'excluded', label: `Esclusi ${scopeCount.excluded}` },
            ]}
            testID="import-scope"
          />
          <View style={styles.countRow}>
            <T variant="dataStrong" color={S.fg} testID="import-count" accessibilityLiveRegion="polite">
              {t.selectedCount(totalCounts.selected, totalCounts.selectable)}
            </T>
            <Pressable
              onPress={() => setSelection((s) => (allSelected ? deselectAll(items, s, SCOPES[scope]) : selectAll(items, s, SCOPES[scope])))}
              disabled={!counts.selectable}
              accessibilityRole="button"
              accessibilityLabel={allSelected ? `Deseleziona tutti quelli ${scopeName} (${counts.selectable})` : `Seleziona tutti quelli ${scopeName} (${counts.selectable})`}
              style={styles.linkBtn}
              testID="import-select-all"
            >
              <T variant="label" color={counts.selectable ? palette.flare : S.faint}>
                {allSelected ? `DESELEZIONA ${scopeName.toUpperCase()}` : `SELEZIONA ${scopeName.toUpperCase()}`} ({counts.selectable})
              </T>
            </Pressable>
          </View>
        </View>
        <FlatList
          data={visible}
          keyExtractor={(i) => i.key}
          style={{ flex: 1, marginHorizontal: -4 }}
          contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 4 }}
          initialNumToRender={14}
          windowSize={9}
          ListEmptyComponent={
            <Note>{items.length ? 'Nessun evento in questo gruppo.' : 'Nessun evento corrisponde: controlla calendari, intervallo e filtri.'}</Note>
          }
          renderItem={({ item }) => (
            <ReviewRow
              item={item}
              on={selection.has(item.key)}
              open={expanded === item.key}
              color={category?.color ?? palette.flare}
              matched={item.matchedSessionId ? (sessionById.get(item.matchedSessionId) ?? null) : null}
              onToggle={() => setSelection((s) => toggleSelected(items, s, item.key))}
              onExpand={() => setExpanded((k) => (k === item.key ? null : item.key))}
            />
          )}
        />
      </Sheet>
    );
  }

  if (step === 3) {
    const searching = fetched != null;
    return (
      <Sheet
        title="Intervallo e filtri"
        eyebrow={`${t.importTitle} · ${category?.name ?? ''}`}
        testID="import-filters"
        footer={
          <Footer
            back={{ label: t.back, onPress: () => (searching ? (abort.current?.abort(), setFetched(null)) : setStep(2)) }}
            next={<Button label={searching ? t.loadingEvents(fetched ?? 0) : t.search} busy={searching} disabled={!range.ok} onPress={runSearch} testID="import-search" />}
          />
        }
      >
        <Steps at={3} of={STEPS} title="Intervallo e filtri" />
        <Section label={t.dateRange}>
          <Segmented
            value={preset}
            onChange={(k) => {
              setPreset(k);
              if (k !== 'custom') {
                const r = presetRange(k, today);
                setFrom(r.from);
                setTo(r.to);
              }
            }}
            options={RANGE_PRESETS}
            testID="import-range"
          />
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <DateText label={t.from} value={from} onChange={(v) => (setFrom(v), setPreset('custom'))} testID="import-from" />
            <DateText label={t.to} value={to} onChange={(v) => (setTo(v), setPreset('custom'))} testID="import-to" />
          </View>
          {range.ok ? (
            <T variant="small" color={S.mute}>
              {`Dal ${longDateIt(range.from)} al ${longDateIt(range.to)}. Gli intervalli lunghi vengono letti a blocchi, pagina dopo pagina, fino alla fine.`}
            </T>
          ) : (
            <Note tone="error">{range.error}</Note>
          )}
        </Section>
        <Section label={t.titleContains} hint={t.titleContainsHint}>
          <Field value={titleText} onChangeText={setTitleText} placeholder="es. surf" autoCapitalize="none" autoCorrect={false} testID="import-title" accessibilityLabel={t.titleContains} />
        </Section>
        <Section label={t.labels}>
          {labelsSupported ? (
            labels.length ? (
              <>
                <LabelChips labels={labels} selected={labelSel} onToggle={(id) => setLabelSel((s) => toggleIn(s, id))} />
                <T variant="small" color={S.mute}>
                  {labelSel.size ? 'Solo eventi con una delle etichette scelte.' : 'Nessuna etichetta scelta: il filtro è spento.'}
                </T>
              </>
            ) : (
              <Note>Nessuna etichetta disponibile per questo account.</Note>
            )
          ) : (
            <Note>{t.labelsUnsupported}</Note>
          )}
        </Section>
        <Note>{t.matchRule}</Note>
        {fetchError ? <Note tone="error">{fetchError}</Note> : null}
      </Sheet>
    );
  }

  if (step === 2) {
    const readable = (calendars ?? []).filter((c) => c.canRead);
    return (
      <Sheet
        title={t.chooseSourceCalendars}
        eyebrow={`${t.importTitle} · ${category?.name ?? ''}`}
        testID="import-source"
        footer={<Footer back={{ label: t.back, onPress: () => setStep(1) }} next={<Button label={calSel.size ? `Continua con ${calSel.size} ${calSel.size === 1 ? 'calendario' : 'calendari'}` : 'Scegli almeno un calendario'} disabled={!calSel.size} onPress={() => setStep(3)} testID="import-next-2" />} />}
      >
        <Steps at={2} of={STEPS} title={t.chooseSourceCalendars} />
        <Section label="Connessione">
          <ProviderChoice connections={conn.connections} value={provider ? [provider] : []} onChange={(v) => chooseProvider(v[0] ?? null)} need="read" busy={conn.busy} onConnect={(k) => conn.connect(k, 'read').then((c) => c && usable(c, 'read') && chooseProvider(k))} />
          {conn.error ? <Note tone="error">{conn.error}</Note> : null}
        </Section>
        {provider && usable(conn.connections[provider], 'read') ? (
          <Section
            label={`Calendari · ${PROVIDER_NAMES[provider]}`}
            right={
              readable.length > 1 ? (
                <Pressable onPress={() => setCalSel(calSel.size === readable.length ? new Set() : new Set(readable.map((c) => c.calendarId)))} accessibilityRole="button" style={styles.linkBtn} testID="import-cal-all">
                  <T variant="label" color={palette.flare}>
                    {calSel.size === readable.length ? 'NESSUNO' : 'TUTTI'}
                  </T>
                </Pressable>
              ) : undefined
            }
          >
            {sourceError ? <Note tone="error">{sourceError}</Note> : calendars == null ? <T variant="small" color={S.mute}>Lettura dei calendari…</T> : <CalendarList calendars={calendars} selected={calSel} need="read" onToggle={(c) => setCalSel((s) => toggleIn(s, c.calendarId))} />}
          </Section>
        ) : (
          <Note>Per importare serve una connessione che possa leggere gli eventi. Serie non chiede nulla finché non tocchi Collega.</Note>
        )}
      </Sheet>
    );
  }

  // step 1 — activity
  return (
    <Sheet
      title={t.chooseDestinationActivity}
      eyebrow={t.importTitle}
      testID="import-activity"
      footer={<Footer next={<Button label={category ? `Importa in ${category.name}` : 'Scegli un’attività'} disabled={!category} onPress={() => setStep(2)} color={category?.color} testID="import-next-1" />} />}
    >
      <Steps at={1} of={STEPS} title={t.chooseDestinationActivity} />
      <Section label="Attività di destinazione" hint="Tutti gli eventi scelti diventano sessioni di questa attività, qualunque sia il loro titolo.">
        {categories.length ? <ActivityPicker categories={categories} value={categoryId ?? ''} original={categoryId ?? ''} onChange={setCategoryId} testID="import-activity" /> : <Note>Non ci sono ancora attività: creane una qui sotto.</Note>}
      </Section>
      {creating ? (
        <Section label="Nuova attività">
          <Field value={newName} onChangeText={(v) => (setNewName(v), setCreateError(null))} placeholder="Nome" autoFocus error={createError} testID="import-new-name" accessibilityLabel="Nome della nuova attività" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button kind="quiet" label={t.cancel} onPress={() => (setCreating(false), setNewName(''), setCreateError(null))} />
            <View style={{ flex: 1 }}>
              <Button kind="secondary" label="Crea attività" onPress={doCreate} disabled={!newName.trim()} testID="import-create" />
            </View>
          </View>
        </Section>
      ) : (
        <Button kind="quiet" label="+ Nuova attività" onPress={() => setCreating(true)} testID="import-new-activity" />
      )}
    </Sheet>
  );
}

function toggleIn(s: ReadonlySet<string>, k: string): Set<string> {
  const n = new Set(s);
  if (n.has(k)) n.delete(k);
  else n.add(k);
  return n;
}

function ReviewRow({
  item,
  on,
  open,
  color,
  matched,
  onToggle,
  onExpand,
}: {
  item: ReviewItem;
  on: boolean;
  open: boolean;
  color: string;
  matched: Session | null;
  onToggle: () => void;
  onExpand: () => void;
}) {
  const pr = item.proposed;
  const when = [longDateIt(pr.date), pr.timeLabel].filter(Boolean).join(' · ');
  const a11y = [item.event.title || 'Senza titolo', item.statusLabel, when, pr.durationLabel, item.sourceLabel, `destinazione ${item.destinationLabel}`, item.selectable ? (on ? 'selezionato' : 'non selezionato') : 'non selezionabile'].join(', ');
  return (
    <View style={styles.item} testID={`import-item-${item.key}`}>
      <Pressable onPress={item.selectable ? onToggle : onExpand} accessibilityRole={item.selectable ? 'checkbox' : 'button'} aria-checked={on} aria-disabled={!item.selectable} accessibilityLabel={a11y} style={styles.itemMain} testID={`import-toggle-${item.key}`}>
        <View style={{ paddingTop: 2 }}>{item.selectable ? <Check on={on} color={color} /> : <View style={styles.dash} />}</View>
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <T variant="bodyStrong" color={item.selectable ? S.fg : S.mute} numberOfLines={2} style={{ flex: 1 }}>
              {item.event.title || 'Senza titolo'}
            </T>
          </View>
          <Pill text={item.statusLabel.toUpperCase()} tone={STATUS_TONE[item.status]} />
          <T variant="data" color={S.fg}>
            {when}
          </T>
          <T variant="small" color={pr.timing.durationSec != null ? S.fg : S.mute}>
            {pr.durationLabel}
          </T>
          {item.sourceWhen && item.sourceWhen !== when ? (
            <T variant="small" color={S.mute}>
              {`Nel calendario: ${item.sourceWhen}`}
            </T>
          ) : null}
          {pr.mappingNote ? (
            <T variant="small" color="#F3C46E">
              {pr.mappingNote}
            </T>
          ) : null}
          {pr.timingNote ? (
            <T variant="small" color={S.mute}>
              {pr.timingNote}
            </T>
          ) : null}
          {item.notesPreview ? (
            <T variant="small" color={S.mute} numberOfLines={open ? undefined : 2}>
              {`Note: ${open && pr.notes ? pr.notes : item.notesPreview}`}
            </T>
          ) : null}
          <T variant="label" color={S.mute} numberOfLines={2}>
            {`${item.sourceLabel.toUpperCase()}  →  ${item.destinationLabel.toUpperCase()}`}
          </T>
          {item.status !== 'new' ? (
            <T variant="small" color={item.status === 'possible_match' ? '#F3C46E' : S.mute}>
              {item.reason}
            </T>
          ) : null}
        </View>
      </Pressable>
      {item.status === 'possible_match' || pr.place || (pr.notes && pr.notes.length > 120) ? (
        <Pressable onPress={onExpand} accessibilityRole="button" accessibilityLabel={open ? 'Nascondi dettagli' : 'Mostra dettagli'} style={styles.expand} testID={`import-expand-${item.key}`}>
          <T variant="label" color={palette.flare}>
            {open ? 'MENO' : 'DETTAGLI'}
          </T>
        </Pressable>
      ) : null}
      {open ? (
        <View style={styles.detail}>
          {pr.place ? (
            <T variant="small" color={S.fg}>
              {`Luogo: ${[pr.place.label, pr.place.address].filter(Boolean).join(' · ') || pr.place.mapUrl}`}
            </T>
          ) : null}
          {matched ? (
            <View style={{ gap: 2 }}>
              <T variant="label" color={S.mute}>
                SESSIONE GIÀ IN SERIE
              </T>
              <T variant="small" color={S.fg}>
                {`${longDateIt(matched.date)} · ${timingSummary(matched)}`}
              </T>
              {matched.notes ? (
                <T variant="small" color={S.mute} numberOfLines={3}>
                  {matched.notes}
                </T>
              ) : null}
              <T variant="small" color={S.mute}>
                Se è la stessa sessione lascialo deselezionato; se sono due sessioni diverse selezionalo.
              </T>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  linkBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  item: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: S.faint, paddingVertical: 12, gap: 6 },
  itemMain: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  dash: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1.2, borderTopColor: 'rgba(238,232,218,0.25)', marginTop: 10 },
  expand: { alignSelf: 'flex-start', marginLeft: 36, minHeight: 44, justifyContent: 'center' },
  detail: { marginLeft: 36, gap: 8, paddingTop: 2 },
});

