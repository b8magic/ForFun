/**
 * Building blocks shared by the calendar exchange tools (import, export,
 * automatic export, jobs). Provider, account, calendar and label are always
 * shown as separate things — never folded into one "calendar" word.
 */
import { type ReactNode, useMemo } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { Connection, ExternalCalendar, LabelOption, ProviderKind } from '@/calendar/types';
import type { LocalDate } from '@/domain/types';
import { parseDate } from '@/domain/dates';
import { fonts, HIT, palette, surfaces } from '@/ui/theme';
import { T } from '@/ui/T';
import { Button, Note } from '@/ui/controls';
import { t, MONTHS } from '@/i18n/it';

const S = surfaces.night;
export const PROVIDER_NAMES: Record<ProviderKind, string> = { google: t.google, apple: t.apple };

// ─── atoms ───────────────────────────────────────────────────────────────────

export function Check({ on, color = palette.flare, disabled }: { on: boolean; color?: string; disabled?: boolean }) {
  return (
    <View style={[styles.check, on && { backgroundColor: color, borderColor: color }, disabled && { opacity: 0.35 }]}>
      {on ? <View style={styles.checkMark} /> : null}
    </View>
  );
}

export function Pill({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent' }) {
  const c = tone === 'good' ? '#9FD9A0' : tone === 'warn' ? '#F3C46E' : tone === 'bad' ? palette.danger : tone === 'accent' ? palette.flare : S.mute;
  return (
    <View style={[styles.pill, { borderColor: c }]}>
      <T variant="label" color={c} numberOfLines={1}>
        {text}
      </T>
    </View>
  );
}

export function Steps({ at, of, title }: { at: number; of: number; title: string }) {
  return (
    <View style={{ gap: 8 }} accessible accessibilityLabel={`${t.step(at, of)}: ${title}`}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: of }, (_, i) => (
          <View key={i} style={[styles.stepBar, i < at && { backgroundColor: i === at - 1 ? palette.flare : S.fg }]} />
        ))}
      </View>
      <T variant="label" color={S.mute}>
        {t.step(at, of)}
      </T>
    </View>
  );
}

export function Footer({ back, next }: { back?: { label: string; onPress: () => void } | null; next: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      {back ? (
        <View style={{ flexShrink: 0 }}>
          <Button kind="quiet" label={back.label} onPress={back.onPress} testID="wizard-back" />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>{next}</View>
    </View>
  );
}

/** A tappable row with a checkbox (multi) or radio ring (single). */
export function ChoiceRow({
  title,
  detail,
  on,
  onPress,
  single,
  disabled,
  color,
  left,
  right,
  testID,
  accessibilityLabel,
}: {
  title: string;
  detail?: string | null;
  on: boolean;
  onPress: () => void;
  single?: boolean;
  disabled?: boolean;
  color?: string;
  left?: ReactNode;
  right?: ReactNode;
  testID?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={single ? 'radio' : 'checkbox'}
      aria-checked={on} aria-disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? [title, detail].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.choice, pressed && { opacity: 0.7 }]}
      testID={testID}
    >
      {single ? <View style={[styles.radio, on && { borderColor: color ?? palette.flare }]}>{on ? <View style={[styles.radioDot, { backgroundColor: color ?? palette.flare }]} /> : null}</View> : <Check on={on} color={color} disabled={disabled} />}
      {left}
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <T variant="body" color={disabled ? S.mute : S.fg} numberOfLines={2}>
          {title}
        </T>
        {detail ? (
          <T variant="small" color={S.mute} numberOfLines={3}>
            {detail}
          </T>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

// ─── provider ────────────────────────────────────────────────────────────────

export function connectionLine(c: Connection | undefined): string {
  if (!c) return '…';
  switch (c.status) {
    case 'connected':
      return [c.accountLabel ? t.connectedAs(c.accountLabel) : 'Collegato', c.canWrite ? 'lettura e scrittura' : 'sola lettura'].join(' · ');
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

/** Whether a connection can serve a workflow that needs `need`. */
export function usable(c: Connection | undefined, need: 'read' | 'write'): boolean {
  if (!c) return false;
  if (need === 'read') return c.status === 'connected' && c.canRead;
  return (c.status === 'connected' || c.status === 'write_only') && c.canWrite;
}

/**
 * Provider choice. Only usable providers can be chosen; the others explain
 * why and offer Collega (the only place a permission prompt can start).
 */
export function ProviderChoice({
  connections,
  value,
  onChange,
  need,
  multi,
  busy,
  onConnect,
}: {
  connections: Partial<Record<ProviderKind, Connection>>;
  value: ProviderKind[];
  onChange: (next: ProviderKind[]) => void;
  need: 'read' | 'write';
  multi?: boolean;
  busy: ProviderKind | null;
  onConnect: (k: ProviderKind) => void;
}) {
  return (
    <View>
      {(['google', 'apple'] as ProviderKind[]).map((k) => {
        const c = connections[k];
        const ok = usable(c, need);
        const on = value.includes(k);
        const canConnect = !!c && !ok && (c.status === 'disconnected' || c.status === 'write_only' || (c.status === 'connected' && need === 'write' && !c.canWrite));
        return (
          <View key={k} style={styles.providerBlock}>
            <ChoiceRow
              title={PROVIDER_NAMES[k]}
              detail={connectionLine(c)}
              on={on}
              single={!multi}
              disabled={!ok}
              onPress={() => onChange(multi ? (on ? value.filter((x) => x !== k) : [...value, k]) : [k])}
              testID={`provider-${k}`}
            />
            {canConnect ? (
              <View style={{ paddingLeft: 38, paddingBottom: 8, alignItems: 'flex-start' }}>
                <Button kind="secondary" label={t.connect} onPress={() => onConnect(k)} busy={busy === k} testID={`connect-${k}`} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Connection status rows (not a choice): provider, account, access, and Collega when useful. */
export function ConnectionList({ connections, need, busy, onConnect }: { connections: Partial<Record<ProviderKind, Connection>>; need: 'read' | 'write'; busy: ProviderKind | null; onConnect: (k: ProviderKind) => void }) {
  return (
    <View>
      {(['google', 'apple'] as ProviderKind[]).map((k) => {
        const c = connections[k];
        const ok = usable(c, need);
        const canConnect = !!c && !ok && (c.status === 'disconnected' || c.status === 'write_only' || (c.status === 'connected' && need === 'write' && !c.canWrite));
        return (
          <View key={k} style={[styles.providerBlock, { paddingVertical: 10, gap: 6 }]} accessible={!canConnect} accessibilityLabel={`${PROVIDER_NAMES[k]}: ${connectionLine(c)}`} testID={`connection-${k}`}>
            <T variant="body" color={S.fg}>
              {PROVIDER_NAMES[k]}
            </T>
            <T variant="small" color={S.mute}>
              {connectionLine(c)}
            </T>
            {canConnect ? (
              <View style={{ alignItems: 'flex-start' }}>
                <Button kind="secondary" label={t.connect} onPress={() => onConnect(k)} busy={busy === k} testID={`connect-${k}`} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ─── calendars ───────────────────────────────────────────────────────────────

export function calendarAccess(c: ExternalCalendar): string {
  if (c.canWrite) return 'scrivibile';
  if (c.canRead) return 'sola lettura';
  return 'non leggibile';
}

/** Calendars grouped by account; the account and the calendar are shown separately. */
export function CalendarList({
  calendars,
  selected,
  onToggle,
  single,
  need,
  testPrefix = 'cal',
}: {
  calendars: ExternalCalendar[];
  selected: ReadonlySet<string>;
  onToggle: (c: ExternalCalendar) => void;
  single?: boolean;
  need: 'read' | 'write';
  testPrefix?: string;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, { label: string; items: ExternalCalendar[] }>();
    for (const c of calendars) {
      const key = `${c.provider}:${c.accountId}`;
      const g = m.get(key) ?? { label: [PROVIDER_NAMES[c.provider], c.accountLabel || c.sourceName].filter(Boolean).join(' · '), items: [] };
      g.items.push(c);
      m.set(key, g);
    }
    for (const g of m.values()) g.items.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.title.localeCompare(b.title, 'it'));
    return [...m.values()];
  }, [calendars]);
  if (!calendars.length) return <Note>Nessun calendario disponibile per questo account.</Note>;
  return (
    <View style={{ gap: 16 }}>
      {groups.map((g) => (
        <View key={g.label} style={{ gap: 2 }}>
          <T variant="label" color={S.mute} numberOfLines={1}>
            {`ACCOUNT · ${g.label.toUpperCase()}`}
          </T>
          {g.items.map((c) => {
            const ok = need === 'read' ? c.canRead : c.canWrite;
            return (
              <ChoiceRow
                key={c.calendarId}
                title={c.title + (c.isPrimary ? ' (principale)' : '')}
                detail={calendarAccess(c) + (c.sourceType && c.provider === 'apple' ? ` · ${c.sourceType}` : '')}
                on={selected.has(c.calendarId)}
                single={single}
                disabled={!ok}
                onPress={() => onToggle(c)}
                left={<View style={[styles.swatch, { backgroundColor: c.color ?? S.faint }]} />}
                testID={`${testPrefix}-${c.calendarId}`}
                accessibilityLabel={`Calendario ${c.title}, account ${g.label}, ${calendarAccess(c)}`}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── labels ──────────────────────────────────────────────────────────────────

export function LabelChips({ labels, selected, onToggle, single, testPrefix = 'label' }: { labels: LabelOption[]; selected: ReadonlySet<string>; onToggle: (id: string) => void; single?: boolean; testPrefix?: string }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole={single ? 'radiogroup' : undefined}>
      {labels.map((l) => {
        const on = selected.has(l.id);
        return (
          <Pressable
            key={l.id}
            onPress={() => onToggle(l.id)}
            accessibilityRole={single ? 'radio' : 'checkbox'}
            aria-checked={on}
            accessibilityLabel={`Etichetta ${l.name}`}
            style={[styles.chip, on && { borderColor: S.fg, backgroundColor: 'rgba(238,232,218,0.08)' }]}
            testID={`${testPrefix}-${l.id}`}
          >
            <View style={[styles.chipDot, { backgroundColor: l.color }]} />
            <T variant="small" color={on ? S.fg : S.mute}>
              {l.name}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── dates ───────────────────────────────────────────────────────────────────

export function longDateIt(d: LocalDate): string {
  const { y, m, d: dd } = parseDate(d);
  return `${dd} ${MONTHS[m - 1]} ${y}`;
}

export { checkRange, presetRange, RANGE_PRESETS, type RangeCheck, type RangePreset } from './rangeHelpers';

export function DateText({ label, value, onChange, testID }: { label: string; value: string; onChange: (v: string) => void; testID?: string }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <T variant="label" color={S.mute}>
        {label.toUpperCase()}
      </T>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="AAAA-MM-GG"
        placeholderTextColor={S.mute}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        style={styles.dateInput}
        accessibilityLabel={`${label}, formato anno mese giorno`}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  check: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.2, borderColor: 'rgba(238,232,218,0.45)', alignItems: 'center', justifyContent: 'center' },
  checkMark: { width: 10, height: 5, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: palette.ink, transform: [{ rotate: '-45deg' }], marginTop: -2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.2, borderColor: 'rgba(238,232,218,0.45)', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  stepBar: { flex: 1, height: 2, backgroundColor: S.faint, borderRadius: 1 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: HIT + 8, paddingVertical: 8 },
  providerBlock: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: S.faint },
  swatch: { width: 8, height: 28, borderRadius: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: HIT, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: S.faint },
  chipDot: { width: 10, height: 10, borderRadius: 5 },
  dateInput: { fontFamily: fonts.mono, fontSize: 16, color: palette.foam, paddingVertical: 10, borderBottomWidth: 1.2, borderBottomColor: 'rgba(238,232,218,0.3)', minHeight: HIT },
});
