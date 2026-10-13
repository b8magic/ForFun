import { useSurface } from '@/ui/useTheme';
/**
 * Esportazioni in sospeso — every export job with its real state. "Salvata sul
 * dispositivo", "Accettato dal calendario" and cloud sync are different
 * things and are named separately. Review decisions are explicit; nothing
 * here deletes or edits an existing calendar event.
 */
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { ExternalEvent } from '@/calendar/types';
import { JOB_STATUS_LABELS, parsePayload, resolveReviewJob, summarizeJobs, type ReviewAction } from '@/calendar/autoExport';
import { OPEN_JOB_STATUSES, type ExportJobRecord } from '@/data/repositories';
import type { ExportJobStatus } from '@/domain/types';
import { getRepositories } from '@/data/database';
import { runAutoExportNow } from '@/calendar/autoRuntime';
import { useApp } from '@/state/store';
import { refreshAll } from '@/state/actions';
import { Sheet, Section, Button, Note, Segmented } from '@/ui/controls';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { errorText } from '@/sheets/manage/helpers';
import { timingSummary } from '@/places/time/format';
import { useConnections } from './useConnections';
import { useCalendars } from './useCalendars';
import { longDateIt, Pill, PROVIDER_NAMES } from './parts';
import { SPAN_CHOICES } from './exportModel';

type Filter = 'open' | 'review' | 'done' | 'cancelled';
const FILTERS: Record<Filter, (s: ExportJobStatus) => boolean> = {
  open: (s) => OPEN_JOB_STATUSES.includes(s) && s !== 'needs_review',
  review: (s) => s === 'needs_review',
  done: (s) => s === 'succeeded',
  cancelled: (s) => s === 'cancelled',
};
const TONE: Record<ExportJobStatus, 'good' | 'warn' | 'neutral' | 'bad' | 'accent'> = {
  pending: 'neutral',
  running: 'accent',
  succeeded: 'good',
  failed: 'bad',
  uncertain: 'warn',
  needs_review: 'warn',
  cancelled: 'neutral',
};

function when(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function JobsScreen() {
  const S = useSurface();
  const sessions = useApp((s) => s.sessions);
  const categories = useApp((s) => s.categories);
  const conn = useConnections();
  const cals = useCalendars(conn.providers, conn.connections, 'read');
  const [jobs, setJobs] = useState<ExportJobRecord[] | null>(null);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'neutral' | 'error'; text: string } | null>(null);
  const [candidates, setCandidates] = useState<Record<string, ExternalEvent[]>>({});

  const load = useCallback(async () => {
    const repos = await getRepositories();
    const list = await repos.exportJobs.list();
    list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    setJobs(list);
    await refreshAll();
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const summary = useMemo(() => summarizeJobs(jobs ?? []), [jobs]);
  const active: Filter = filter ?? (summary.needsReview ? 'review' : summary.open ? 'open' : 'done');
  const shown = (jobs ?? []).filter((j) => FILTERS[active](j.status));
  const sessionById = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const calTitle = (j: ExportJobRecord) => cals.all.find((c) => c.provider === j.provider && c.calendarId === j.calendarId)?.title ?? j.calendarId;

  const act = async (j: ExportJobRecord, action: ReviewAction, runAfter = true) => {
    setBusy(j.id);
    setMsg(null);
    try {
      const repos = await getRepositories();
      await resolveReviewJob(repos, j.id, action);
      if (runAfter && action.kind !== 'skip') await runAutoExportNow();
      await load();
    } catch (e) {
      setMsg({ tone: 'error', text: errorText(e) });
    } finally {
      setBusy(null);
    }
  };

  const cancelManual = async (j: ExportJobRecord) => {
    setBusy(j.id);
    try {
      const repos = await getRepositories();
      await repos.exportJobs.update(j.id, { status: 'cancelled', nextAttemptAt: null });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const loadCandidates = async (j: ExportJobRecord, ids: string[]) => {
    const p = conn.providers?.[j.provider];
    if (!p) return;
    const out: ExternalEvent[] = [];
    for (const id of ids) {
      const ev = await p.getEvent(j.calendarId, id).catch(() => null);
      if (ev) out.push(ev);
    }
    setCandidates((m) => ({ ...m, [j.id]: out }));
  };

  return (
    <Sheet title={t.jobsTitle} eyebrow={summary.badge.label ?? 'Nessuna esportazione in sospeso'} testID="jobs">
      <Segmented
        value={active}
        onChange={setFilter}
        options={[
          { key: 'review', label: `Da rivedere ${summary.counts.needs_review}` },
          { key: 'open', label: `In corso ${summary.open - summary.counts.needs_review}` },
          { key: 'done', label: `Accettate ${summary.counts.succeeded}` },
          { key: 'cancelled', label: `Annullate ${summary.counts.cancelled}` },
        ]}
        testID="jobs-filter"
      />
      {msg ? <Note tone={msg.tone === 'error' ? 'error' : 'neutral'}>{msg.text}</Note> : null}
      {jobs == null ? (
        <T variant="small" color={S.mute}>
          …
        </T>
      ) : shown.length === 0 ? (
        <Note>{active === 'review' ? 'Niente da rivedere.' : active === 'open' ? 'Nessuna esportazione in attesa.' : active === 'done' ? 'Ancora nessuna esportazione accettata.' : 'Nessuna esportazione annullata.'}</Note>
      ) : (
        shown.map((j) => {
          const s = sessionById.get(j.sessionId);
          const payload = parsePayload(j.payload);
          const cat = s ? catById.get(s.categoryId) : null;
          const code = payload?.review?.code ?? null;
          const isAuto = j.kind === 'auto';
          return (
            <Section key={j.id} label={`${PROVIDER_NAMES[j.provider].toUpperCase()} · ${calTitle(j).toUpperCase()}`}>
              <View style={{ gap: 4 }} testID={`job-${j.id}`}>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  <Pill text={JOB_STATUS_LABELS[j.status].toUpperCase()} tone={TONE[j.status]} />
                  <Pill text={isAuto ? 'AUTOMATICA' : 'MANUALE'} />
                </View>
                <T variant="bodyStrong" color={S.fg}>
                  {s ? `${cat?.name ?? payload?.categoryName ?? ''} · ${longDateIt(s.date)}` : 'Sessione non più presente'}
                </T>
                {s ? (
                  <T variant="small" color={S.mute}>
                    {`${t.savedLocally} · ${timingSummary(s)}`}
                  </T>
                ) : null}
                {j.reviewReason ? (
                  <T variant="small" color={S.warning}>
                    {j.reviewReason}
                  </T>
                ) : null}
                {j.lastError && j.status !== 'succeeded' ? (
                  <T variant="small" color={S.mute}>
                    {j.lastError}
                  </T>
                ) : null}
                <T variant="label" color={S.mute}>
                  {[j.attempts ? `${j.attempts} ${j.attempts === 1 ? 'TENTATIVO' : 'TENTATIVI'}` : null, j.nextAttemptAt && j.status !== 'needs_review' && OPEN_JOB_STATUSES.includes(j.status) && j.nextAttemptAt > new Date().toISOString() ? `PROSSIMO ${when(j.nextAttemptAt)}` : null, `AGGIORNATO ${when(j.updatedAt)}`].filter(Boolean).join(' · ')}
                </T>
                {j.status === 'succeeded' ? <Note>{t.exportNotCloud}</Note> : null}
              </View>

              {isAuto && OPEN_JOB_STATUSES.includes(j.status) && j.status !== 'running' ? (
                <View style={{ gap: 8 }}>
                  {code === 'start_only_not_approved' ? (
                    <View style={{ gap: 6 }}>
                      <T variant="small" color={S.fg}>
                        Approva un intervallo di pianificazione solo per il calendario (la durata resta sconosciuta):
                      </T>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                        {SPAN_CHOICES.map((m) => (
                          <Button key={m} kind="secondary" label={`${m} min`} busy={busy === j.id} onPress={() => act(j, { kind: 'approve_span', minutes: m })} testID={`job-span-${m}-${j.id}`} />
                        ))}
                      </View>
                    </View>
                  ) : null}
                  {code === 'possible_duplicate' ? (
                    <View style={{ gap: 6 }}>
                      {candidates[j.id] ? (
                        candidates[j.id].map((ev) => (
                          <View key={ev.eventId} style={{ gap: 4 }}>
                            <T variant="small" color={S.fg}>
                              {`${t.existingEvent} (${calTitle(j)}): ${ev.title} · ${longDateIt(ev.start.date)}${ev.start.time ? ` ${ev.start.time}` : ''}`}
                            </T>
                            {ev.notes ? (
                              <T variant="small" color={S.mute} numberOfLines={3}>
                                {ev.notes}
                              </T>
                            ) : null}
                            {s && payload ? (
                              <T variant="small" color={S.fg}>
                                {`${t.proposedEvent}: ${payload.title.prefix}${cat?.name ?? payload.categoryName}${payload.title.suffix} · ${longDateIt(s.date)} · ${timingSummary(s)}`}
                              </T>
                            ) : null}
                            <Button kind="secondary" label={t.actionLink} busy={busy === j.id} onPress={() => act(j, { kind: 'link', event: ev }, false)} />
                          </View>
                        ))
                      ) : (
                        <Button kind="quiet" label="Mostra l’evento simile" onPress={() => loadCandidates(j, payload?.review?.eventIds ?? [])} disabled={!payload?.review?.eventIds.length} />
                      )}
                      <Button kind="secondary" label={t.actionCreate} busy={busy === j.id} onPress={() => act(j, { kind: 'create_separate' })} testID={`job-create-${j.id}`} />
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                    {code !== 'start_only_not_approved' && code !== 'possible_duplicate' ? <Button kind="secondary" label="Riprova ora" busy={busy === j.id} onPress={() => act(j, { kind: 'retry' })} testID={`job-retry-${j.id}`} /> : null}
                    <Button kind="quiet" label={t.actionSkip} busy={busy === j.id} onPress={() => act(j, { kind: 'skip' }, false)} testID={`job-skip-${j.id}`} />
                  </View>
                </View>
              ) : null}
              {!isAuto && OPEN_JOB_STATUSES.includes(j.status) ? (
                <View style={{ gap: 8 }}>
                  <Note>Esportazione manuale non completata. Rifalla da Esporta: gli eventi già scritti vengono riconosciuti e non ricreati.</Note>
                  <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                    <Button kind="secondary" label="Apri Esporta" onPress={() => router.push('/calendar/export')} />
                    <Button kind="quiet" label={t.cancel} busy={busy === j.id} onPress={() => cancelManual(j)} />
                  </View>
                </View>
              ) : null}
            </Section>
          );
        })
      )}
    </Sheet>
  );
}
