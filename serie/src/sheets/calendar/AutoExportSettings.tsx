/**
 * Esportazione automatica — off by default. When on, every eligible session
 * committed locally is queued for the chosen calendars. Saving is never
 * blocked: anything that needs a decision waits in "Da rivedere". Turning it
 * off stops future writes and can cancel pending jobs; exported events are
 * never deleted.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import type { ExternalCalendar, LabelOption, ProviderKind } from '@/calendar/types';
import {
  appleRef,
  defaultConfig,
  disableAutoExport,
  googleRef,
  loadConfig,
  saveConfig,
  validateConfig,
  withBothResolved,
  type AutoExportConfig,
  type DestinationSet,
  type RepresentationRules,
} from '@/calendar/autoExport';
import { OPEN_JOB_STATUSES } from '@/data/repositories';
import { getRepositories } from '@/data/database';
import { useApp } from '@/state/store';
import { refreshAll } from '@/state/actions';
import { Sheet, Section, Button, Field, Note, Segmented, Toggle } from '@/ui/controls';
import { T } from '@/ui/T';
import { palette, surfaces } from '@/ui/theme';
import { t } from '@/i18n/it';
import { IdentityDisc } from '@/graphics/IdentityDisc';
import { useConnections } from './useConnections';
import { useCalendars } from './useCalendars';
import { CalendarList, ChoiceRow, LabelChips, ProviderChoice, PROVIDER_NAMES, usable } from './parts';
import { SPAN_CHOICES } from './exportModel';

const S = surfaces.night;

export function AutoExportSettings() {
  const categories = useApp((s) => s.categories);
  const conn = useConnections();
  const cals = useCalendars(conn.providers, conn.connections, 'write');
  const [config, setConfig] = useState<AutoExportConfig | null>(null);
  const [askCancel, setAskCancel] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [openOverride, setOpenOverride] = useState<string | null>(null);

  useEffect(() => {
    getRepositories()
      .then(loadConfig)
      .then(setConfig)
      .catch(() => setConfig(defaultConfig()));
  }, []);

  // edits are applied to the latest config (ref) and persisted immediately, in order
  const latest = useRef<AutoExportConfig | null>(null);
  useEffect(() => {
    latest.current = config;
  }, [config]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const update = useCallback((fn: (c: AutoExportConfig) => AutoExportConfig) => {
    const next = fn(latest.current ?? defaultConfig());
    latest.current = next;
    setConfig(next);
    queue.current = queue.current.then(async () => {
      const repos = await getRepositories();
      const saved = await saveConfig(repos, next);
      if (latest.current === next) setConfig(saved);
    });
    return queue.current;
  }, []);

  const validation = useMemo(() => (config ? validateConfig(config, cals.all, { categories }) : null), [config, cals.all, categories]);

  if (!config || !validation) return <Sheet title={t.autoExportTitle} testID="auto-export">{null}</Sheet>;

  const setEnabled = async (on: boolean) => {
    const repos = await getRepositories();
    if (on) {
      if (!validation.runnable) return;
      await update((c) => ({ ...c, enabled: true }));
      setFlash('Attiva: le nuove sessioni verranno esportate dopo il salvataggio.');
      return;
    }
    const open = (await repos.exportJobs.list(OPEN_JOB_STATUSES)).filter((j) => j.kind === 'auto').length;
    if (open) {
      setAskCancel(open);
      return;
    }
    setConfig((await disableAutoExport(repos, { cancelPending: false })).config);
    setFlash('Disattivata: nessuna nuova esportazione automatica.');
  };

  const finishDisable = async (cancelPending: boolean) => {
    const repos = await getRepositories();
    const r = await disableAutoExport(repos, { cancelPending });
    setConfig(r.config);
    setAskCancel(null);
    await refreshAll();
    setFlash(cancelPending ? `Disattivata. ${r.cancelled} ${r.cancelled === 1 ? 'esportazione annullata' : 'esportazioni annullate'}. Gli eventi già esportati restano nei calendari.` : 'Disattivata. Le esportazioni già in coda verranno completate.');
  };

  const scopeSome = config.scope !== 'all';
  const scopeIds = config.scope === 'all' ? categories.map((c) => c.id) : config.scope.categoryIds;
  const issues = validation.issues;
  const bothIssue = issues.find((i) => i.code === 'both_unresolved' && i.gate);
  const preview = `${config.title.prefix}${categories[0]?.name ?? 'Surf'}${config.title.suffix}`;
  const rep = config.representation;
  const setRep = (patch: Partial<RepresentationRules>) => update((c) => ({ ...c, representation: { ...c.representation, ...patch } }));

  return (
    <Sheet title={t.autoExportTitle} eyebrow={config.enabled ? t.autoOn : t.autoOff} testID="auto-export">
      <Section label="Modalità">
        <Toggle
          label="Esporta automaticamente dopo il salvataggio"
          value={config.enabled}
          onChange={setEnabled}
          disabled={!config.enabled && !validation.runnable}
          hint={config.enabled ? 'Salvata sul dispositivo ≠ accettata dal calendario ≠ sincronizzata nel cloud: lo stato di ogni esportazione è in “Attività in sospeso”.' : 'Spenta: Serie esporta solo quando lo chiedi tu.'}
          testID="auto-enabled"
        />
        {!config.enabled && !validation.runnable ? <Note>Per attivarla scegli almeno un calendario di destinazione qui sotto.</Note> : null}
        {askCancel != null ? (
          <View style={{ gap: 10 }}>
            <Note tone="warn">{t.autoDisabledPending(askCancel)}</Note>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <Button kind="danger" label={t.cancelPending} onPress={() => finishDisable(true)} testID="auto-cancel-pending" />
              <Button kind="quiet" label={t.keepPending} onPress={() => finishDisable(false)} testID="auto-keep-pending" />
            </View>
          </View>
        ) : null}
        {flash ? <Note>{flash}</Note> : null}
      </Section>

      <Section label="Connessioni">
        <ProviderChoice
          connections={conn.connections}
          value={(['google', 'apple'] as ProviderKind[]).filter((k) => !!config.destinations[k])}
          onChange={(v) => update((c) => ({ ...c, destinations: { ...(v.includes('google') ? { google: c.destinations.google } : {}), ...(v.includes('apple') ? { apple: c.destinations.apple } : {}) } }))}
          need="write"
          multi
          busy={conn.busy}
          onConnect={(k) => conn.connect(k, 'readwrite')}
        />
        {conn.error ? <Note tone="error">{conn.error}</Note> : null}
      </Section>

      <Section label="Destinazioni predefinite">
        <DestinationEditor set={config.destinations} onChange={(d) => update((c) => ({ ...c, destinations: d }))} calendars={cals.calendars} labels={cals.labels} connections={conn.connections} testPrefix="auto" />
        {bothIssue?.gate ? (
          <View style={{ gap: 8 }}>
            <Note tone="warn">{bothIssue.message}</Note>
            <T variant="small" color={S.mute}>
              {bothIssue.gate.equivalence.detail}
            </T>
            <Button
              kind="secondary"
              label="Ho controllato: sono calendari diversi"
              onPress={() => {
                const g = config.destinations.google;
                const a = config.destinations.apple;
                if (g && a) update((c) => withBothResolved(c, googleRef(g), appleRef(a)));
              }}
              testID="auto-resolve-distinct"
            />
          </View>
        ) : null}
        {issues
          .filter((i) => i !== bothIssue)
          .map((i, n) => (
            <Note key={`${i.code}-${n}`} tone={i.severity === 'error' ? 'error' : 'warn'}>
              {`${i.categoryId ? `${categories.find((c) => c.id === i.categoryId)?.name ?? ''}: ` : ''}${i.provider ? `${PROVIDER_NAMES[i.provider]} — ` : ''}${i.message}`}
            </Note>
          ))}
      </Section>

      <Section label="Attività">
        <Segmented
          value={scopeSome ? 'some' : 'all'}
          onChange={(k) => update((c) => ({ ...c, scope: k === 'all' ? 'all' : { categoryIds: categories.map((x) => x.id) } }))}
          options={[
            { key: 'all', label: t.autoScopeAll },
            { key: 'some', label: t.autoScopeSome },
          ]}
          testID="auto-scope"
        />
        {categories.map((c) => {
          const inScope = scopeIds.includes(c.id);
          const override = config.categoryOverrides[c.id];
          return (
            <View key={c.id} style={{ gap: 4 }}>
              <ChoiceRow
                title={c.name}
                detail={!inScope ? 'Non esportata automaticamente' : override ? 'Destinazioni personalizzate' : 'Destinazioni predefinite'}
                on={inScope}
                disabled={!scopeSome}
                color={c.color}
                left={<IdentityDisc size={28} pattern={c.pattern} color={c.color} stripe={palette.foam} animated={false} />}
                onPress={() =>
                  update((cfg) => {
                    const ids = cfg.scope === 'all' ? categories.map((x) => x.id) : cfg.scope.categoryIds;
                    return { ...cfg, scope: { categoryIds: ids.includes(c.id) ? ids.filter((x) => x !== c.id) : [...ids, c.id] } };
                  })
                }
                right={
                  inScope ? (
                    <Button kind="quiet" label={openOverride === c.id ? 'Chiudi' : 'Calendari'} onPress={() => setOpenOverride((k) => (k === c.id ? null : c.id))} testID={`auto-override-${c.id}`} />
                  ) : undefined
                }
                testID={`auto-cat-${c.id}`}
              />
              {openOverride === c.id && inScope ? (
                <View style={{ paddingLeft: 36, gap: 8, paddingBottom: 10 }}>
                  <Segmented
                    value={override ? 'custom' : 'default'}
                    onChange={(k) =>
                      update((cfg) => {
                        const o = { ...cfg.categoryOverrides };
                        if (k === 'default') delete o[c.id];
                        else o[c.id] = { destinations: { ...cfg.destinations } };
                        return { ...cfg, categoryOverrides: o };
                      })
                    }
                    options={[
                      { key: 'default', label: 'Predefinite' },
                      { key: 'custom', label: 'Personalizzate' },
                    ]}
                  />
                  {override ? (
                    <DestinationEditor
                      set={override.destinations}
                      onChange={(d) => update((cfg) => ({ ...cfg, categoryOverrides: { ...cfg.categoryOverrides, [c.id]: { destinations: d } } }))}
                      calendars={cals.calendars}
                      labels={cals.labels}
                      connections={conn.connections}
                      testPrefix={`auto-${c.id}`}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </Section>

      <Section label={t.finalTitle} hint="Titolo = prefisso + nome dell’attività + suffisso.">
        <T variant="title" color={S.fg} testID="auto-title-preview">
          {preview.replace(/ /g, ' ')}
        </T>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Field label={t.prefix} value={config.title.prefix} onChangeText={(v) => update((c) => ({ ...c, title: { ...c.title, prefix: v } }))} autoCorrect={false} autoCapitalize="none" testID="auto-prefix" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t.suffix} value={config.title.suffix} onChangeText={(v) => update((c) => ({ ...c, title: { ...c.title, suffix: v } }))} autoCorrect={false} autoCapitalize="none" testID="auto-suffix" />
          </View>
        </View>
      </Section>

      <Section label="Contenuto">
        <Toggle label={t.includeNotes} value={config.includeNotes} onChange={(v) => update((c) => ({ ...c, includeNotes: v }))} />
        <Toggle label={t.includeLocation} value={config.includeLocation} onChange={(v) => update((c) => ({ ...c, includeLocation: v }))} />
        <Toggle label={t.autoForwardImported} value={config.forwardImported} onChange={(v) => update((c) => ({ ...c, forwardImported: v }))} hint="Mai nel calendario da cui sono state importate." testID="auto-forward" />
      </Section>

      <Section label="Rappresentazione nel calendario" hint="“Da rivedere” mette la sessione in attesa della tua approvazione, senza bloccare il salvataggio.">
        <RuleRow label="Solo data" hint={t.reprDateOnly} value={rep.dateOnly} options={[{ key: 'date_marker', label: 'Indicatore di data' }, { key: 'review', label: 'Da rivedere' }]} onChange={(v) => setRep({ dateOnly: v })} />
        <RuleRow
          label="Solo ora di inizio"
          hint={rep.startOnly.mode === 'span' ? t.reprStartOnlyApproved(rep.startOnly.minutes) : 'Il calendario vuole una fine: senza un intervallo approvato restano da rivedere.'}
          value={rep.startOnly.mode === 'span' ? String(rep.startOnly.minutes) : 'review'}
          options={[{ key: 'review', label: 'Da rivedere' }, ...SPAN_CHOICES.map((m) => ({ key: String(m), label: `${m} min` }))]}
          onChange={(v) => setRep({ startOnly: v === 'review' ? { mode: 'review' } : { mode: 'span', minutes: Number(v) } })}
          testID="auto-start-only"
        />
        <RuleRow label="Inizio e fine" hint={t.reprInterval} value={rep.interval} options={[{ key: 'interval', label: 'Intervallo registrato' }, { key: 'review', label: 'Da rivedere' }]} onChange={(v) => setRep({ interval: v })} />
        <RuleRow label="Solo durata" hint={t.reprDuration('1 h 30 min')} value={rep.durationOnly} options={[{ key: 'duration_marker', label: 'Data + durata' }, { key: 'review', label: 'Da rivedere' }]} onChange={(v) => setRep({ durationOnly: v })} />
        <RuleRow label="Inizio e durata" hint="Fine calcolata dalla durata dichiarata." value={rep.startDuration} options={[{ key: 'derived_end', label: 'Fine calcolata' }, { key: 'review', label: 'Da rivedere' }]} onChange={(v) => setRep({ startDuration: v })} />
      </Section>
      <Note>{`${t.noAttendees} Disattivarla non elimina né modifica gli eventi già esportati.`}</Note>
    </Sheet>
  );
}

function RuleRow<K extends string>({ label, hint, value, options, onChange, testID }: { label: string; hint: string; value: K; options: { key: K; label: string }[]; onChange: (k: K) => void; testID?: string }) {
  return (
    <View style={{ gap: 6, paddingVertical: 4 }}>
      <T variant="bodyStrong" color={S.fg}>
        {label}
      </T>
      <Segmented value={value} options={options} onChange={onChange} testID={testID} />
      <T variant="small" color={S.mute}>
        {hint}
      </T>
    </View>
  );
}

function DestinationEditor({
  set,
  onChange,
  calendars,
  labels,
  connections,
  testPrefix,
}: {
  set: DestinationSet;
  onChange: (d: DestinationSet) => void;
  calendars: Partial<Record<ProviderKind, ExternalCalendar[]>>;
  labels: LabelOption[];
  connections: ReturnType<typeof useConnections>['connections'];
  testPrefix: string;
}) {
  return (
    <View style={{ gap: 16 }}>
      {(['google', 'apple'] as ProviderKind[]).map((k) => {
        const list = calendars[k] ?? [];
        const cur = k === 'google' ? set.google : set.apple;
        const ok = usable(connections[k], 'write');
        return (
          <View key={k} style={{ gap: 4 }}>
            <T variant="label" color={S.mute}>
              {PROVIDER_NAMES[k].toUpperCase()}
            </T>
            {!ok ? (
              <T variant="small" color={S.mute}>
                {cur ? `Calendario scelto (${cur.calendarId}) non verificabile: collega ${PROVIDER_NAMES[k]}.` : 'Non collegato.'}
              </T>
            ) : (
              <>
                <ChoiceRow title="Nessuno" on={!cur} single onPress={() => onChange(k === 'google' ? { ...set, google: undefined } : { ...set, apple: undefined })} testID={`${testPrefix}-${k}-none`} />
                <CalendarList
                  calendars={list}
                  single
                  need="write"
                  selected={new Set(cur ? [cur.calendarId] : [])}
                  onToggle={(c) => onChange(k === 'google' ? { ...set, google: { calendarId: c.calendarId, accountId: c.accountId, labelId: set.google?.labelId ?? null } } : { ...set, apple: { calendarId: c.calendarId, accountId: c.accountId } })}
                  testPrefix={`${testPrefix}-${k}`}
                />
                {k === 'google' && set.google && labels.length ? (
                  <View style={{ gap: 6, paddingTop: 6 }}>
                    <T variant="label" color={S.mute}>
                      {t.labels.toUpperCase()}
                    </T>
                    <LabelChips labels={labels} single selected={new Set(set.google.labelId ? [set.google.labelId] : [])} onToggle={(id) => onChange({ ...set, google: { ...set.google!, labelId: set.google!.labelId === id ? null : id } })} testPrefix={`${testPrefix}-label`} />
                  </View>
                ) : null}
                {k === 'apple' && set.apple ? <Note>I calendari di iPhone non hanno etichette colore: nessuna etichetta verrà applicata.</Note> : null}
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}
