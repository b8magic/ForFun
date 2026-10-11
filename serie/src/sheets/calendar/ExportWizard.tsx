/**
 * Esporta — one activity per operation:
 *   activity → destinations (Google, iPhone or both, each with its own
 *   calendar and label) → titles, content and representation → review per
 *   destination (duplicate checks against the real calendar) → results.
 *
 * Review edits change the outgoing event only. Applying an edit back to the
 * stored session is a separate, explicit action. Nothing is written before
 * the final confirmation, and a retry never recreates successful items
 * (operation ids + stored links).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { CalendarProvider, ExternalCalendar, LabelOption, ProviderKind } from '@/calendar/types';
import { buildExportPlan, eventsOf, executePlan, loadAllDestinationEvents, mergeChoices, setRowChoice, setSelection, type DestinationRead, type ExecuteResult, type ExportDestinationInput, type ExportPlan, type ExportPlanRow, type PlanDestination } from '@/calendar/exportEngine';
import { gateBothDestinations, pairKey, type BothGate } from '@/calendar/equivalence';
import { destinationKey } from '@/calendar/opId';
import { resolveTitle } from '@/calendar/titles';
import type { ExportLinkRecord, ProvenanceRecord } from '@/data/repositories';
import type { ID, LocalDate } from '@/domain/types';
import { compareDates } from '@/domain/dates';
import { deviceTimeZone } from '@/domain/zoned';
import { getRepositories } from '@/data/database';
import { useApp } from '@/state/store';
import { refreshAll } from '@/state/actions';
import { Sheet, Section, Button, Field, Note, Segmented, Toggle } from '@/ui/controls';
import { T } from '@/ui/T';
import { palette, surfaces } from '@/ui/theme';
import { t } from '@/i18n/it';
import { ActivityPicker } from '@/sheets/session/ActivityPicker';
import { errorText } from '@/sheets/manage/helpers';
import { useConnections } from './useConnections';
import { CalendarList, checkRange, DateText, Footer, LabelChips, longDateIt, Pill, presetRange, ProviderChoice, PROVIDER_NAMES, Steps, usable } from './parts';
import { DEFAULT_SETTINGS, editSettings, linkSettings, resetAllTitles, ROW_FILTERS, SPAN_CHOICES, startOnlyCount, toOptions, type DestSettings, type ReviewFilter, type SettingsMap } from './exportModel';
import { ExportRow } from './ExportRow';

const S = surfaces.night;
const STEPS = 4;
type RangeKey = 'all' | '1y' | 'custom';

export function ExportWizard() {
  const categories = useApp((s) => s.categories);
  const activeId = useApp((s) => s.activeId);
  const allSessions = useApp((s) => s.sessions);
  const today = useApp((s) => s.today);
  const conn = useConnections();
  const zone = useMemo(() => deviceTimeZone(), []);

  const [step, setStep] = useState(1);
  const [categoryId, setCategoryId] = useState<ID | null>(activeId);
  // destinations
  const [chosen, setChosen] = useState<ProviderKind[]>([]);
  const [cals, setCals] = useState<Partial<Record<ProviderKind, ExternalCalendar[] | null>>>({});
  const [calErr, setCalErr] = useState<Partial<Record<ProviderKind, string>>>({});
  const [calSel, setCalSel] = useState<Partial<Record<ProviderKind, string>>>({});
  const [labels, setLabels] = useState<LabelOption[]>([]);
  const [labelSel, setLabelSel] = useState<Partial<Record<ProviderKind, string | null>>>({});
  const [resolved, setResolved] = useState<Record<string, true>>({});
  // settings
  const [range, setRange] = useState<RangeKey>('all');
  const [from, setFrom] = useState<string>(presetRange('1y', today).from);
  const [to, setTo] = useState<string>(today);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [linked, setLinked] = useState(true);
  const [editing, setEditing] = useState<ProviderKind | null>(null);
  // review
  const [reads, setReads] = useState<Record<string, DestinationRead> | null>(null);
  const [links, setLinks] = useState<ExportLinkRecord[]>([]);
  const [prov, setProv] = useState<ProvenanceRecord[]>([]);
  const [plan, setPlan] = useState<ExportPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [tab, setTab] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<string | null>(null);
  // execute
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const category = categories.find((c) => c.id === categoryId) ?? null;
  const rangeCheck = range === 'custom' ? checkRange(from, to) : null;
  const sessions = useMemo(() => {
    const own = allSessions.filter((s) => s.categoryId === categoryId);
    if (range === 'all') return own;
    const r = range === '1y' ? presetRange('1y', today) : rangeCheck?.ok ? rangeCheck : null;
    if (!r) return [];
    return own.filter((s) => compareDates(s.date, r.from) >= 0 && compareDates(s.date, r.to) <= 0);
  }, [allSessions, categoryId, range, today, rangeCheck]);
  const countFor = useCallback((id: ID) => allSessions.filter((s) => s.categoryId === id).length, [allSessions]);

  // default destination: the first provider that can write
  useEffect(() => {
    if (chosen.length) return;
    const k = (['google', 'apple'] as ProviderKind[]).find((x) => usable(conn.connections[x], 'write'));
    if (k) setChosen([k]);
  }, [conn.connections, chosen.length]);

  // calendars (and Google labels) for each chosen provider
  useEffect(() => {
    let live = true;
    for (const k of chosen) {
      const p = conn.providers?.[k];
      if (!p || !usable(conn.connections[k], 'write') || cals[k] !== undefined) continue;
      setCals((m) => ({ ...m, [k]: null }));
      (async () => {
        try {
          const list = await p.listCalendars();
          if (!live) return;
          setCals((m) => ({ ...m, [k]: list }));
          const writable = list.filter((c) => c.canWrite);
          const primary = writable.find((c) => c.isPrimary) ?? (writable.length === 1 ? writable[0] : null);
          if (primary) setCalSel((m) => (m[k] ? m : { ...m, [k]: primary.calendarId }));
          if (p.capabilities.eventLabels) {
            const l = await p.listLabels().catch(() => []);
            if (live) setLabels(l);
          }
        } catch (e) {
          if (!live) return;
          setCals((m) => ({ ...m, [k]: [] }));
          setCalErr((m) => ({ ...m, [k]: e instanceof Error ? e.message : String(e) }));
        }
      })();
    }
    return () => {
      live = false;
    };
  }, [chosen, conn.providers, conn.connections, cals]);

  const calOf = useCallback((k: ProviderKind) => (cals[k] ?? []).find((c) => c.calendarId === calSel[k]) ?? null, [cals, calSel]);

  const gate: BothGate | null = useMemo(() => {
    if (chosen.length < 2) return null;
    const g = calOf('google');
    const a = calOf('apple');
    if (!g || !a) return null;
    return gateBothDestinations(g, a, resolved[pairKey(g, a)] ? 'resolved_distinct' : null, { googleCalendars: cals.google ?? undefined });
  }, [chosen, calOf, resolved, cals.google]);

  const destReady = chosen.length > 0 && chosen.every((k) => usable(conn.connections[k], 'write') && !!calOf(k)) && (!gate || gate.allowed);

  const destInputs: ExportDestinationInput[] = useMemo(() => {
    if (!conn.providers) return [];
    const out: ExportDestinationInput[] = [];
    for (const k of chosen) {
      const c = calOf(k);
      const connection = conn.connections[k];
      if (!c || !connection) continue;
      const p: CalendarProvider = conn.providers[k];
      out.push({
        ref: { provider: k, accountId: c.accountId, calendarId: c.calendarId },
        calendar: c,
        connection,
        labelId: p.capabilities.eventLabels ? (labelSel[k] ?? null) : null,
        labelsSupported: p.capabilities.eventLabels,
        options: toOptions(settings[k] ?? DEFAULT_SETTINGS, zone),
      });
    }
    return out;
  }, [chosen, calOf, conn.providers, conn.connections, labelSel, settings, zone]);

  // rebuild the plan whenever settings change, keeping the user's row choices
  useEffect(() => {
    if (!reads || !category || !destInputs.length) return;
    try {
      const next = buildExportPlan({
        sessions,
        category: { id: category.id, name: category.name },
        destinations: destInputs,
        options: toOptions(settings[chosen[0]] ?? DEFAULT_SETTINGS, zone),
        links,
        destinationEvents: eventsOf(reads),
        provenance: prov,
      });
      setPlan((prev) => (prev ? mergeChoices(prev, next) : next));
    } catch (e) {
      setLoadErr(errorText(e));
    }
  }, [reads, destInputs, sessions, category, links, prov, settings, chosen, zone]);

  const loadReview = useCallback(async () => {
    if (!conn.providers || !destInputs.length) return;
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setLoading(true);
    setLoadErr(null);
    try {
      const repos = await getRepositories();
      const allLinks = await repos.exportLinks.all();
      const provenance = (await Promise.all(destInputs.map((d) => repos.provenance.listForCalendars(d.ref.provider, d.ref.accountId, [d.ref.calendarId])))).flat();
      const overrides = Object.assign({}, ...destInputs.map((d) => d.options?.overrides ?? {}));
      const r = await loadAllDestinationEvents(conn.providers, destInputs, sessions, allLinks, { overrides, signal: ac.signal });
      if (ac.signal.aborted) return;
      setLinks(allLinks);
      setProv(provenance);
      setReads(r);
      setTab((cur) => cur ?? destinationKey(destInputs[0].ref));
      setStep(4);
    } catch (e) {
      if (!ac.signal.aborted) setLoadErr(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [conn.providers, destInputs, sessions]);

  const execute = useCallback(async () => {
    if (!plan || !conn.providers) return;
    const ac = new AbortController();
    abort.current = ac;
    const total = plan.destinations.reduce((n, d) => n + d.rows.filter((r) => r.selected).length, 0);
    setRunning({ done: 0, total });
    try {
      const repos = await getRepositories();
      const done: Record<string, number> = {};
      const r = await executePlan({
        plan,
        providers: conn.providers,
        repos,
        signal: ac.signal,
        onProgress: (p) => {
          done[p.destinationKey] = p.done;
          setRunning({ done: Object.values(done).reduce((a, b) => a + b, 0), total });
        },
      });
      await refreshAll();
      setResult(r);
      setStep(5);
    } catch (e) {
      setRowErr(errorText(e));
    } finally {
      setRunning(null);
    }
  }, [plan, conn.providers]);

  const editKind = editing && chosen.includes(editing) ? editing : chosen[0];
  const cur = (editKind && settings[editKind]) || DEFAULT_SETTINGS;
  const edit = useCallback((fn: (s: DestSettings) => DestSettings, target?: ProviderKind) => setSettings((m) => editSettings(m, chosen, target ?? editKind, linked, fn)), [chosen, editKind, linked]);

  // ─── results ───────────────────────────────────────────────────────────────
  if (step === 5 && result && plan) {
    const anyRetry = result.destinations.some((d) => d.counts.failed + d.counts.pending > 0);
    return (
      <Sheet
        title="Risultati"
        eyebrow={`${t.exportTitle} · ${plan.categoryName}`}
        testID="export-done"
        footer={
          <Footer
            back={anyRetry ? { label: 'Rivedi e riprova', onPress: () => (setResult(null), loadReview()) } : null}
            next={<Button label={t.done} onPress={() => router.back()} testID="export-finish" />}
          />
        }
      >
        {result.destinations.map((d) => {
          const pd = plan.destinations.find((x) => x.key === d.key);
          const c = d.counts;
          const lines: [string, number][] = [
            [t.resultCreated, c.created],
            [t.resultLinked, c.linked],
            [t.resultUpdated, c.updated],
            [t.resultSkipped, c.skipped],
            [t.resultFailed, c.failed],
            [t.resultPending, c.pending],
          ];
          const problems = d.rows.filter((o) => o.result === 'failed' || o.result === 'pending');
          return (
            <Section key={d.key} label={pd ? destLabel(pd) : d.key}>
              <View style={styles.counts} testID={`export-result-${d.ref.provider}`}>
                {lines.map(([l, n]) => (
                  <View key={l} style={styles.countCell} accessible accessibilityLabel={`${l}: ${n}`}>
                    <T variant="heading" color={n && (l === t.resultFailed || l === t.resultPending) ? '#F3C46E' : S.fg}>
                      {String(n)}
                    </T>
                    <T variant="label" color={S.mute}>
                      {l.toUpperCase()}
                    </T>
                  </View>
                ))}
              </View>
              {problems.slice(0, 8).map((o) => {
                const s = pd?.rows.find((r) => r.session.id === o.sessionId)?.session;
                return (
                  <Note key={o.key} tone={o.result === 'failed' ? 'error' : 'warn'}>
                    {`${s ? longDateIt(s.date) : ''} — ${o.message ?? o.code}`}
                  </Note>
                );
              })}
              {problems.length > 8 ? <Note>{`…e altri ${problems.length - 8}.`}</Note> : null}
            </Section>
          );
        })}
        <Note>{t.exportNotCloud}</Note>
        {anyRetry ? <Note>Riprovare non ricrea gli eventi già scritti: Serie li riconosce dall’identificativo dell’operazione.</Note> : null}
      </Sheet>
    );
  }

  // ─── review ────────────────────────────────────────────────────────────────
  if (step === 4 && plan) {
    const dest = plan.destinations.find((d) => d.key === tab) ?? plan.destinations[0];
    const totalSel = plan.destinations.reduce((n, d) => n + d.rows.filter((r) => r.selected).length, 0);
    const rows = dest ? dest.rows.filter(ROW_FILTERS[filter]) : [];
    const selInDest = dest ? dest.rows.filter((r) => r.selected).length : 0;
    const scopeSelectable = rows.filter((r) => r.action !== 'skip').length;
    const allOn = scopeSelectable > 0 && rows.every((r) => r.action === 'skip' || r.selected);
    const kind = dest?.ref.provider;
    const set = kind ? (settings[kind] ?? DEFAULT_SETTINGS) : DEFAULT_SETTINGS;
    return (
      <Sheet
        title={t.review}
        eyebrow={`${t.exportTitle} · ${plan.categoryName}`}
        testID="export-review"
        footer={
          <View style={{ gap: 8 }}>
            {rowErr ? <Note tone="error">{rowErr}</Note> : null}
            <Footer
              back={{ label: 'Opzioni', onPress: () => setStep(3) }}
              next={<Button label={running ? `Esportazione… ${running.done}/${running.total}` : totalSel ? t.confirmExport(totalSel) : 'Nessuna sessione selezionata'} busy={!!running} disabled={!totalSel} onPress={execute} color={category?.color} testID="export-confirm" />}
            />
          </View>
        }
      >
        <Steps at={4} of={STEPS} title={t.review} />
        {plan.destinations.length > 1 ? (
          <Segmented value={dest.key} onChange={(k) => (setTab(k), setExpanded(null))} options={plan.destinations.map((d) => ({ key: d.key, label: `${PROVIDER_NAMES[d.ref.provider]} ${d.rows.filter((r) => r.selected).length}` }))} testID="export-tab" />
        ) : null}
        {dest ? <DestinationHeader d={dest} read={reads?.[dest.key] ?? null} /> : null}
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'all', label: `Tutte ${dest?.rows.length ?? 0}` },
            { key: 'selected', label: `Selezionate ${selInDest}` },
            { key: 'attention', label: `Da decidere ${dest ? dest.rows.filter(ROW_FILTERS.attention).length : 0}` },
          ]}
          testID="export-filter"
        />
        <View style={styles.countRow}>
          <T variant="dataStrong" color={S.fg} testID="export-count" accessibilityLiveRegion="polite">
            {t.selectedCount(selInDest, dest?.rows.length ?? 0)}
          </T>
          <Pressable
            onPress={() => dest && setPlan((p) => p && setSelection(p, dest.key, !allOn, ROW_FILTERS[filter]))}
            disabled={!scopeSelectable}
            accessibilityRole="button"
            accessibilityLabel={`${allOn ? 'Deseleziona' : 'Seleziona'} tutte quelle in elenco per ${dest ? PROVIDER_NAMES[dest.ref.provider] : ''} (${scopeSelectable})`}
            style={styles.linkBtn}
            testID="export-select-all"
          >
            <T variant="label" color={scopeSelectable ? palette.flare : S.faint}>
              {`${allOn ? 'DESELEZIONA' : 'SELEZIONA'} IN ELENCO (${scopeSelectable})`}
            </T>
          </Pressable>
        </View>
        {rows.length === 0 ? <Note>{dest?.rows.length ? 'Nessuna sessione in questo gruppo.' : 'Nessuna sessione da esportare.'}</Note> : null}
        <View>
          {rows.map((r) => (
            <ExportRow
              key={r.key}
              row={r}
              dest={dest}
              settings={set}
              categoryName={plan.categoryName}
              color={category?.color ?? palette.flare}
              open={expanded === r.key}
              onExpand={() => setExpanded((k) => (k === r.key ? null : r.key))}
              onChoice={(choice) => {
                try {
                  setRowErr(null);
                  setPlan((p) => p && setRowChoice(p, dest.key, r.session.id, choice));
                } catch (e) {
                  setRowErr(errorText(e));
                }
              }}
              onEdit={(fn) => edit(fn, dest.ref.provider)}
              linked={linked && chosen.length > 1}
            />
          ))}
        </View>
        <Note>{t.noAttendees}</Note>
      </Sheet>
    );
  }

  // ─── options ───────────────────────────────────────────────────────────────
  if (step === 3) {
    const sample = sessions[sessions.length - 1];
    const preview = resolveTitle({ prefix: cur.prefix, suffix: cur.suffix, categoryName: category?.name ?? '', override: sample ? (cur.overrides[sample.id]?.baseTitle ?? null) : null });
    const nStartOnly = startOnlyCount(sessions);
    return (
      <Sheet
        title="Titoli e contenuti"
        eyebrow={`${t.exportTitle} · ${category?.name ?? ''}`}
        testID="export-options"
        footer={
          <View style={{ gap: 8 }}>
            {loadErr ? <Note tone="error">{loadErr}</Note> : null}
            <Footer
              back={{ label: t.back, onPress: () => setStep(2) }}
              next={<Button label={loading ? 'Controllo dei calendari…' : sessions.length ? `Rivedi ${sessions.length} ${sessions.length === 1 ? 'sessione' : 'sessioni'}` : 'Nessuna sessione'} busy={loading} disabled={!sessions.length} onPress={() => (setPlan(null), loadReview())} testID="export-next-3" />}
            />
          </View>
        }
      >
        <Steps at={3} of={STEPS} title="Titoli e contenuti" />
        <Section label="Sessioni">
          <Segmented
            value={range}
            onChange={setRange}
            options={[
              { key: 'all', label: 'Tutte' },
              { key: '1y', label: 'Ultimo anno' },
              { key: 'custom', label: 'Scegli' },
            ]}
            testID="export-range"
          />
          {range === 'custom' ? (
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <DateText label={t.from} value={from} onChange={setFrom} testID="export-from" />
              <DateText label={t.to} value={to} onChange={setTo} testID="export-to" />
            </View>
          ) : null}
          {rangeCheck && !rangeCheck.ok ? <Note tone="error">{rangeCheck.error}</Note> : <T variant="small" color={S.mute}>{`${sessions.length} ${sessions.length === 1 ? 'sessione' : 'sessioni'} di ${category?.name ?? ''}.`}</T>}
        </Section>
        {chosen.length > 1 ? (
          <Section label="Destinazioni">
            <Toggle label="Stesse impostazioni per entrambe" value={linked} onChange={(v) => (setLinked(v), v && editKind && setSettings((m) => linkSettings(m, chosen, editKind)))} hint="Spegni per usare titoli e contenuti diversi su ciascun calendario." testID="export-linked" />
            {!linked ? <Segmented value={editKind} onChange={(k) => setEditing(k)} options={chosen.map((k) => ({ key: k, label: PROVIDER_NAMES[k] }))} testID="export-editing" /> : null}
          </Section>
        ) : null}
        <Section label={t.finalTitle} hint="Titolo finale = prefisso + titolo + suffisso. Spazi e caratteri restano esattamente come li scrivi.">
          <View style={styles.titlePreview} accessible accessibilityLabel={`Anteprima del titolo: ${preview.final}`}>
            <T variant="title" color={S.fg} testID="export-title-preview">
              <T variant="title" color={palette.flare}>
                {visibleSpaces(preview.prefix)}
              </T>
              {preview.base}
              <T variant="title" color={palette.flare}>
                {visibleSpaces(preview.suffix)}
              </T>
            </T>
          </View>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Field label={t.prefix} value={cur.prefix} onChangeText={(v) => edit((s) => ({ ...s, prefix: v }))} autoCorrect={false} autoCapitalize="none" placeholder="es. 🏄 " testID="export-prefix" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t.suffix} value={cur.suffix} onChangeText={(v) => edit((s) => ({ ...s, suffix: v }))} autoCorrect={false} autoCapitalize="none" placeholder="es.  · Serie" testID="export-suffix" />
            </View>
          </View>
          {Object.values(cur.overrides).some((o) => o.baseTitle) ? <Button kind="quiet" label="Ripristina tutti i titoli" onPress={() => edit(resetAllTitles)} /> : null}
        </Section>
        <Section label="Contenuto">
          <Toggle label={t.includeNotes} value={cur.includeNotes} onChange={(v) => edit((s) => ({ ...s, includeNotes: v }))} hint="Le note diventano la descrizione dell’evento." testID="export-notes" />
          <Toggle label={t.includeLocation} value={cur.includeLocation} onChange={(v) => edit((s) => ({ ...s, includeLocation: v }))} hint="Indirizzo nel campo luogo; il link di Maps resta nella descrizione." testID="export-location" />
        </Section>
        {nStartOnly ? (
          <Section label={t.schedulingSpan}>
            <T variant="small" color={S.fg}>
              {`${nStartOnly} ${nStartOnly === 1 ? 'sessione ha' : 'sessioni hanno'} solo l’ora di inizio. Il calendario vuole anche una fine: approva un intervallo di pianificazione oppure lasciale in sospeso.`}
            </T>
            <Segmented
              value={cur.startOnlySpanMin == null ? 'none' : String(cur.startOnlySpanMin)}
              onChange={(k) => edit((s) => ({ ...s, startOnlySpanMin: k === 'none' ? null : Number(k) }))}
              options={[{ key: 'none', label: 'In sospeso' }, ...SPAN_CHOICES.map((m) => ({ key: String(m), label: `${m} min` }))]}
              testID="export-span"
            />
            <Note>{cur.startOnlySpanMin == null ? 'Senza approvazione queste sessioni restano “in attesa” nella revisione.' : t.reprStartOnlyApproved(cur.startOnlySpanMin)}</Note>
          </Section>
        ) : null}
        <Note>{`${t.noAttendees} Le date senza orario diventano indicatori di giornata intera, senza inventare orari o durate.`}</Note>
      </Sheet>
    );
  }

  // ─── destinations ──────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <Sheet
        title="Dove esportare?"
        eyebrow={`${t.exportTitle} · ${category?.name ?? ''}`}
        testID="export-dest"
        footer={<Footer back={{ label: t.back, onPress: () => setStep(1) }} next={<Button label={destReady ? 'Continua' : 'Scegli il calendario di destinazione'} disabled={!destReady} onPress={() => setStep(3)} testID="export-next-2" />} />}
      >
        <Steps at={2} of={STEPS} title="Destinazione" />
        <Section label="Servizio" hint="Puoi scegliere Google Calendar, i calendari di iPhone o entrambi.">
          <ProviderChoice connections={conn.connections} value={chosen} onChange={setChosen} need="write" multi busy={conn.busy} onConnect={(k) => conn.connect(k, 'readwrite').then((c) => c && usable(c, 'write') && setChosen((v) => (v.includes(k) ? v : [...v, k])))} />
          {conn.error ? <Note tone="error">{conn.error}</Note> : null}
        </Section>
        {chosen.map((k) => (
          <Section key={k} label={`${t.destinationCalendar} · ${PROVIDER_NAMES[k]}`}>
            {calErr[k] ? (
              <Note tone="error">{calErr[k]}</Note>
            ) : cals[k] == null ? (
              <T variant="small" color={S.mute}>
                Lettura dei calendari…
              </T>
            ) : (
              <CalendarList calendars={cals[k] ?? []} selected={new Set(calSel[k] ? [calSel[k] as string] : [])} single need="write" onToggle={(c) => setCalSel((m) => ({ ...m, [k]: c.calendarId }))} testPrefix={`dest-${k}`} />
            )}
            {conn.connections[k]?.status === 'write_only' ? <Note tone="warn">{t.writeOnly}</Note> : null}
            {k === 'google' && labels.length ? (
              <View style={{ gap: 8 }}>
                <T variant="label" color={S.mute}>
                  {`${t.labels.toUpperCase()} · FACOLTATIVA`}
                </T>
                <LabelChips labels={labels} selected={new Set(labelSel.google ? [labelSel.google] : [])} single onToggle={(id) => setLabelSel((m) => ({ ...m, google: m.google === id ? null : id }))} testPrefix="dest-label" />
              </View>
            ) : null}
            {k === 'apple' ? <Note>{t.labelsUnsupported.replace('il filtro non è disponibile', 'nessuna etichetta verrà applicata')}</Note> : null}
          </Section>
        ))}
        {gate ? <GateNote gate={gate} onResolve={() => setResolved((m) => ({ ...m, [pairKey(calOf('google')!, calOf('apple')!)]: true }))} onPick={(k) => setChosen([k])} /> : null}
      </Sheet>
    );
  }

  // ─── activity ──────────────────────────────────────────────────────────────
  return (
    <Sheet
      title="Quale attività esportare?"
      eyebrow={t.exportTitle}
      testID="export-activity"
      footer={<Footer next={<Button label={category ? `Esporta ${category.name}` : 'Scegli un’attività'} disabled={!category || !countFor(category.id)} onPress={() => setStep(2)} color={category?.color} testID="export-next-1" />} />}
    >
      <Steps at={1} of={STEPS} title="Attività" />
      <Section label="Attività">
        <ActivityPicker categories={categories} value={categoryId ?? ''} original={categoryId ?? ''} onChange={setCategoryId} testID="export-activity" />
      </Section>
      {category ? (
        <T variant="small" color={S.mute}>
          {countFor(category.id) ? `${countFor(category.id)} ${countFor(category.id) === 1 ? 'sessione' : 'sessioni'} registrate. Ogni sessione diventa un evento separato.` : 'Questa attività non ha ancora sessioni.'}
        </T>
      ) : null}
    </Sheet>
  );
}

function visibleSpaces(s: string) {
  return s.replace(/ /g, ' ');
}

export function destLabel(d: Pick<PlanDestination, 'ref' | 'calendar'>): string {
  return [PROVIDER_NAMES[d.ref.provider], d.calendar.accountLabel || d.calendar.sourceName, d.calendar.title].filter(Boolean).join(' · ');
}

function DestinationHeader({ d, read }: { d: PlanDestination; read: DestinationRead | null }) {
  return (
    <View style={styles.destHead} testID={`export-dest-${d.ref.provider}`}>
      <T variant="label" color={S.mute}>
        {`${PROVIDER_NAMES[d.ref.provider].toUpperCase()} · ACCOUNT ${(d.calendar.accountLabel || d.calendar.sourceName || '').toUpperCase()}`}
      </T>
      <T variant="bodyStrong" color={S.fg}>
        {`Calendario: ${d.calendar.title}`}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Pill text={d.checked ? 'DOPPIONI CONTROLLATI' : 'NON VERIFICATO'} tone={d.checked ? 'good' : 'warn'} />
        <Pill text={d.writable ? 'SCRIVIBILE' : 'SOLA LETTURA'} tone={d.writable ? 'neutral' : 'bad'} />
        {d.colorId ? <Pill text={`ETICHETTA ${d.colorId}`} /> : null}
      </View>
      {!d.checked ? <Note tone="warn">{`${t.exportStatusNotChecked}.${read?.error ? ` ${read.error}` : ''}`}</Note> : null}
      {d.labelNote ? <Note>{d.labelNote}</Note> : null}
    </View>
  );
}

function GateNote({ gate, onResolve, onPick }: { gate: BothGate; onResolve: () => void; onPick: (k: ProviderKind) => void }) {
  const e = gate.equivalence;
  const side = (x: typeof e.details.google) => `${x.providerLabel} · account ${x.accountLabel}${x.sourceType ? ` (${x.sourceType}${x.sourceName ? `, ${x.sourceName}` : ''})` : ''} · calendario “${x.calendarTitle}”`;
  return (
    <Section label="Entrambi i calendari">
      <Note tone={gate.allowed ? 'neutral' : 'warn'}>{gate.message}</Note>
      <T variant="small" color={S.mute}>
        {e.detail}
      </T>
      <View style={{ gap: 4 }}>
        <T variant="small" color={S.fg}>
          {side(e.details.google)}
        </T>
        <T variant="small" color={S.fg}>
          {side(e.details.apple)}
        </T>
      </View>
      {!gate.allowed && gate.code === 'unresolved' ? <Button kind="secondary" label="Ho controllato: sono calendari diversi" onPress={onResolve} testID="export-resolve-distinct" /> : null}
      {!gate.allowed ? (
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Button kind="quiet" label="Solo Google" onPress={() => onPick('google')} testID="export-only-google" />
          <Button kind="quiet" label="Solo iPhone" onPress={() => onPick('apple')} testID="export-only-apple" />
        </View>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  linkBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  titlePreview: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: 'rgba(238,232,218,0.06)' },
  destHead: { gap: 6, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: S.faint },
  counts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  countCell: { width: '33.33%', gap: 2 },
});

export type { ExportPlanRow, LocalDate };
