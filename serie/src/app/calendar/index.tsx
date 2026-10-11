/**
 * Calendari — connections and the three exchange tools. Provider, account,
 * calendar and label are always named separately. Nothing here prompts for
 * permission until the user taps Collega.
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { Connection, ProviderKind } from '@/calendar/types';
import { Sheet, Section, Row, Button, Note } from '@/ui/controls';
import { T } from '@/ui/T';
import { palette, surfaces } from '@/ui/theme';
import { Chevron } from '@/ui/glyphs';
import { t } from '@/i18n/it';
import { useApp } from '@/state/store';
import { refreshAll } from '@/state/actions';
import { getRepositories } from '@/data/database';
import { useConnections } from '@/sheets/calendar/useConnections';

const S = surfaces.night;
const NAMES: Record<ProviderKind, string> = { google: t.google, apple: t.apple };

function statusText(c: Connection | undefined): string {
  if (!c) return '…';
  switch (c.status) {
    case 'connected':
      return c.accountLabel ? t.connectedAs(c.accountLabel) : 'Collegato';
    case 'write_only':
      return t.writeOnly;
    case 'denied':
      return c.detail ?? t.permissionDenied;
    case 'not_configured':
      return c.detail ?? t.notConfigured;
    case 'unavailable':
      return c.detail ?? t.unavailablePlatform;
    default:
      return c.detail ?? t.notConnected;
  }
}

export default function CalendarHub() {
  const { connections, busy, error, connect, disconnect, refresh } = useConnections();
  const openJobs = useApp((s) => s.openJobs);
  const [autoOn, setAutoOn] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshAll();
      getRepositories()
        .then((r) => r.settings.get<{ enabled?: boolean } | null>('autoExport', null))
        .then((c) => setAutoOn(!!c?.enabled));
    }, [refresh]),
  );
  useEffect(() => undefined, []);

  return (
    <Sheet title={t.calendars} eyebrow="Google Calendar · Calendari di iPhone" testID="calendar-hub">
      <Section label={t.connections}>
        {(['google', 'apple'] as ProviderKind[]).map((k) => {
          const c = connections[k];
          const canConnect = c && (c.status === 'disconnected' || c.status === 'write_only' || (c.status === 'connected' && !c.canWrite));
          return (
            <View key={k} style={{ gap: 10, paddingVertical: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T variant="bodyStrong" color={S.fg}>
                  {NAMES[k]}
                </T>
                <T variant="label" color={c?.status === 'connected' ? palette.flare : S.mute}>
                  {c?.status === 'connected' ? (c.canWrite ? 'lettura e scrittura' : 'sola lettura') : c?.status === 'write_only' ? 'solo scrittura' : ''}
                </T>
              </View>
              <T variant="small" color={S.mute} testID={`conn-${k}`}>
                {statusText(c)}
              </T>
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                {canConnect ? <Button kind="secondary" label={t.connect} onPress={() => connect(k, 'readwrite')} busy={busy === k} testID={`connect-${k}`} /> : null}
                {c?.status === 'connected' || c?.status === 'write_only' ? <Button kind="quiet" label={t.disconnect} onPress={() => disconnect(k)} busy={busy === k} /> : null}
              </View>
            </View>
          );
        })}
        {error ? <Note tone="error">{error}</Note> : null}
        <Note>Serie chiede l’accesso ai calendari solo quando usi queste funzioni. Le sessioni restano salvate sul dispositivo anche senza calendari collegati.</Note>
      </Section>

      <Section label="Scambio">
        <Row title={t.importTitle} detail="Dal calendario a un’attività: scegli calendari, intervallo e filtri, poi rivedi ogni evento." onPress={() => router.push('/calendar/import')} right={<Chevron dir="right" color={S.mute} size={7} />} testID="go-import" />
        <Row title={t.exportTitle} detail="Da un’attività a uno o due calendari, con revisione e controllo dei doppioni." onPress={() => router.push('/calendar/export')} right={<Chevron dir="right" color={S.mute} size={7} />} testID="go-export" />
        <Row title={t.autoExportTitle} detail={autoOn ? t.autoOn : t.autoOff} onPress={() => router.push('/calendar/auto')} right={<Chevron dir="right" color={S.mute} size={7} />} testID="go-auto" />
        <Row title={t.jobsTitle} detail={openJobs ? `${openJobs} in sospeso o da rivedere` : 'Nessuna esportazione in sospeso'} onPress={() => router.push('/calendar/jobs')} right={<Chevron dir="right" color={S.mute} size={7} />} testID="go-jobs" />
      </Section>
    </Sheet>
  );
}
