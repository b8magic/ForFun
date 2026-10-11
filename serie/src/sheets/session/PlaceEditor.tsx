/**
 * Place editor: name, address, Google Maps link (with Paste), resolution
 * status, map preview, "Apri in Mappe" (the original link, verbatim) and
 * remove. Controlled: `value` is the draft place (or null), `onChange` gets
 * every edit. Nothing here can block saving: an unresolved or unsupported
 * link is kept as-is with an honest status line.
 */
import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { AccessibilityInfo, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { Place } from '@/domain/types';
import { Field, Note } from '@/ui/controls';
import { HIT, palette, surfaces } from '@/ui/theme';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { MapPreview } from './MapPreview';
import { mapsTarget, placeWithLink, resolvePending } from './mapsAdapter';
import { emptyPlace, placeStatus, placeTitle, withManualPin } from './placeForm';

const S = surfaces.night;
const s = t.sessionSheets;
const WARN = '#F3C46E';

interface Props {
  value: Place | null;
  onChange: (p: Place | null) => void;
  accent?: string;
  testID?: string;
}

export function PlaceEditor({ value, onChange, accent = palette.flare, testID = 'place' }: Props) {
  const [linkFocused, setLinkFocused] = useState(false);
  const [pasteMsg, setPasteMsgState] = useState<string | null>(null);
  const setPasteMsg = (m: string | null) => {
    setPasteMsgState(m);
    if (m) AccessibilityInfo.announceForAccessibility(m);
  };
  const [pinning, setPinning] = useState(false);
  const latest = useRef(value);
  const onChangeRef = useRef(onChange);
  // refs follow the latest props after each commit, for the async link resolution below
  useLayoutEffect(() => {
    latest.current = value;
    onChangeRef.current = onChange;
  });

  const p = value ?? emptyPlace();
  const edit = (patch: Partial<Place>) => onChange({ ...(latest.current ?? emptyPlace()), ...patch });

  // Short links resolve over the network; the result is merged into whatever the user typed meanwhile.
  const pendingUrl = p.resolution === 'pending' ? p.mapUrl : null;
  useEffect(() => {
    if (!pendingUrl) return;
    let alive = true;
    const h = setTimeout(async () => {
      const snapshot = latest.current;
      if (!snapshot) return;
      const r = await resolvePending(snapshot);
      const now = latest.current;
      if (!alive || !now || now.mapUrl !== pendingUrl || now.resolution !== 'pending') return;
      onChangeRef.current({
        ...now,
        label: now.label?.trim() ? now.label : r.label,
        address: now.address?.trim() ? now.address : r.address,
        coords: r.coords,
        resolution: r.resolution === 'pending' ? 'unresolved' : r.resolution,
        resolutionNote: r.resolutionNote,
      });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(h);
    };
  }, [pendingUrl]);

  const paste = async () => {
    setPasteMsg(null);
    try {
      const text = (await Clipboard.getStringAsync()).trim();
      if (!text) {
        setPasteMsg(s.pasteEmpty);
        return;
      }
      onChange(placeWithLink(latest.current, text));
    } catch {
      setPasteMsg(s.pasteFailed);
    }
  };

  const target = mapsTarget(value);
  const status = placeStatus(p.resolution);
  // While typing a link by hand, don't nag with "not a maps link" on every keystroke.
  const showStatus = status && !(linkFocused && p.resolution === 'unsupported');
  const hasAny = !!(p.label?.trim() || p.address?.trim() || p.mapUrl?.trim() || p.coords);
  const canPin = Platform.OS === 'ios';
  // Without coordinates a map is only useful where the user can place the pin by hand (iOS).
  const showMap = !!p.coords || (canPin && (pinning || (!!p.mapUrl && p.resolution === 'unresolved')));

  return (
    <View style={{ gap: 18 }} testID={testID}>
      <View style={{ gap: 8 }}>
        {/* placeholders name empty fields; once filled, a mono label keeps each field identifiable */}
        <Field label={p.label ? t.placeName : undefined} value={p.label ?? ''} onChangeText={(v) => edit({ label: v })} placeholder={t.placeName} accessibilityLabel={t.placeName} returnKeyType="done" testID={`${testID}-name`} />
        <Field label={p.address ? t.address : undefined} value={p.address ?? ''} onChangeText={(v) => edit({ address: v })} placeholder={t.address} accessibilityLabel={t.address} returnKeyType="done" testID={`${testID}-address`} />
      </View>

      <View style={{ gap: 6 }}>
        <View style={styles.linkRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Field
              label={p.mapUrl ? t.mapLink : undefined}
              value={p.mapUrl ?? ''}
              onChangeText={(v) => {
                setPasteMsg(null);
                onChange(placeWithLink(latest.current, v));
              }}
              onFocus={() => setLinkFocused(true)}
              onBlur={() => setLinkFocused(false)}
              placeholder={t.mapLinkPlaceholder}
              accessibilityLabel={t.mapLink}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              textContentType="URL"
              returnKeyType="done"
              style={{ fontSize: 15 }}
              testID={`${testID}-link`}
            />
          </View>
          <Pressable onPress={paste} accessibilityRole="button" accessibilityLabel={s.pasteA11y} style={styles.paste} testID={`${testID}-paste`}>
            <T variant="labelStrong" color={accent}>
              {t.paste}
            </T>
          </Pressable>
        </View>
        {pasteMsg ? (
          <T variant="small" color={S.mute} accessibilityLiveRegion="polite">
            {pasteMsg}
          </T>
        ) : null}
        {showStatus && status ? (
          <View style={styles.status} accessibilityLiveRegion="polite" testID={`${testID}-status-${p.resolution}`}>
            <View style={[styles.statusDot, status.tone === 'ok' ? { backgroundColor: accent } : status.tone === 'warn' ? { backgroundColor: WARN } : styles.statusPending]} />
            <T variant="small" color={status.tone === 'warn' ? WARN : status.tone === 'ok' ? S.fg : S.mute} style={{ flex: 1 }}>
              {status.text}
            </T>
          </View>
        ) : null}
      </View>

      {showMap ? (
        <MapPreview
          coords={p.coords}
          label={placeTitle(p)}
          accent={accent}
          onPick={canPin ? (c) => onChange(withManualPin(latest.current, c)) : undefined}
          testID={`${testID}-map`}
        />
      ) : null}

      {/* The maps module's specific "why" (e.g. coordinates taken from the map centre, offline): shown for every state, resolved included. */}
      {p.resolutionNote && p.resolution !== 'none' ? <Note tone="warn">{p.resolutionNote}</Note> : null}

      {target || hasAny || (canPin && !showMap) ? (
        <View style={styles.actions}>
          {p.resolution === 'unresolved' && p.mapUrl ? (
            <Pressable onPress={() => edit({ resolution: 'pending', resolutionNote: null })} accessibilityRole="button" style={styles.quiet} testID={`${testID}-retry`}>
              <T variant="labelStrong" color={S.fg}>
                {s.retryResolve}
              </T>
            </Pressable>
          ) : null}
          {target ? (
            <Pressable
              onPress={() => {
                setPasteMsg(null);
                // The original link, verbatim. If the system can't open it (e.g. no scheme), say so instead of failing silently.
                Linking.openURL(target).catch(() => setPasteMsg(s.openFailed));
              }}
              accessibilityRole="link"
              accessibilityLabel={t.openInMaps}
              style={styles.quiet}
              testID={`${testID}-open`}
            >
              <T variant="labelStrong" color={S.fg}>
                {t.openInMaps}
              </T>
            </Pressable>
          ) : null}
          {canPin && !showMap ? (
            <Pressable onPress={() => setPinning(true)} accessibilityRole="button" style={styles.quiet} testID={`${testID}-pin`}>
              <T variant="labelStrong" color={S.fg}>
                {t.placePin}
              </T>
            </Pressable>
          ) : null}
          {hasAny ? (
            <Pressable
              onPress={() => {
                setPinning(false);
                setPasteMsg(null);
                onChange(null);
              }}
              accessibilityRole="button"
              style={styles.quiet}
              testID={`${testID}-remove`}
            >
              <T variant="labelStrong" color={palette.danger}>
                {t.removePlace}
              </T>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  linkRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  paste: { minHeight: HIT, minWidth: HIT, justifyContent: 'center', alignItems: 'flex-end' },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 7 },
  statusPending: { borderWidth: 1.2, borderColor: S.mute },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 26, rowGap: 0 },
  quiet: { minHeight: HIT, justifyContent: 'center', alignSelf: 'flex-start' },
});
