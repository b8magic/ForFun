import { useState, type KeyboardEvent } from 'react';
import { Platform, Pressable, StyleSheet, View, type GestureResponderEvent, type ViewStyle } from 'react-native';
import { Canvas, LinearGradient, RoundedRect, vec } from '@shopify/react-native-skia';
import { Field } from '@/ui/controls';
import { T } from '@/ui/T';
import { activityColors, HIT } from '@/ui/theme';
import { useSurface } from '@/ui/useTheme';
import { ColorSwatches, colorName } from './Look';
import { clamp, colorSliderKey, hexToHsv, hsvToHex, normalizeHex, type ColorChannel, type Hsv } from './activityColor';

const LABEL_HEIGHT = 28;
const ROW_HEIGHT = LABEL_HEIGHT + HIT + 8;
const TRACK_HEIGHT = 14;
const THUMB_SIZE = 28;
const INSET = THUMB_SIZE / 2;
const HUE_COLORS = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'];
const CHANNELS = [
  { key: 'h', label: 'Tonalità', max: 360, unit: '°' },
  { key: 's', label: 'Saturazione', max: 100, unit: '%' },
  { key: 'v', label: 'Luminosità', max: 100, unit: '%' },
] as const;
const INVALID_HEX = 'Usa 3 o 6 cifre esadecimali, per esempio #3366CC.';

/** All three gradient tracks share one graphics surface, regardless of palette size. */
function ColorTracks({ hsv, width }: { hsv: Hsv; width: number }) {
  const colors = [
    HUE_COLORS,
    [hsvToHex({ ...hsv, s: 0 }), hsvToHex({ ...hsv, s: 1 })],
    ['#000000', hsvToHex({ ...hsv, v: 1 })],
  ];
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {colors.map((stops, i) => {
        const y = i * ROW_HEIGHT + LABEL_HEIGHT + (HIT - TRACK_HEIGHT) / 2;
        return (
          <RoundedRect key={i} x={INSET} y={y} width={Math.max(1, width - 2 * INSET)} height={TRACK_HEIGHT} r={TRACK_HEIGHT / 2}>
            <LinearGradient start={vec(INSET, y)} end={vec(width - INSET, y)} colors={stops} />
          </RoundedRect>
        );
      })}
    </Canvas>
  );
}

function ColorSlider({ channel, value, width, color, onChange }: {
  channel: (typeof CHANNELS)[number];
  value: number;
  width: number;
  color: string;
  onChange: (value: number) => void;
}) {
  const S = useSurface();
  const [focused, setFocused] = useState(false);
  const shown = Math.round(value);
  const trackWidth = Math.max(1, width - 2 * INSET);
  const move = (event: GestureResponderEvent) => onChange(clamp((event.nativeEvent.locationX - INSET) / trackWidth) * channel.max);
  const webProps = Platform.OS === 'web' ? {
    onKeyDown: (event: KeyboardEvent) => {
      const next = colorSliderKey(value, channel.max, event.key, event.shiftKey);
      if (next === null) return;
      event.preventDefault();
      onChange(next);
    },
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  } : {};
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderLabel} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <T variant="label" color={S.fg}>{channel.label}</T>
        <T variant="label" color={S.mute}>{shown}{channel.unit}</T>
      </View>
      <View
        {...webProps}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={channel.label}
        accessibilityHint="Scorri per regolare il colore."
        accessibilityValue={{ min: 0, max: channel.max, now: shown, text: `${shown}${channel.unit}` }}
        aria-valuemin={0}
        aria-valuemax={channel.max}
        aria-valuenow={shown}
        aria-valuetext={`${shown}${channel.unit}`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'increment') onChange(clamp(value + 1, channel.max));
          else if (nativeEvent.actionName === 'decrement') onChange(clamp(value - 1, channel.max));
        }}
        tabIndex={0}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={move}
        onResponderMove={move}
        onResponderTerminationRequest={() => false}
        testID={`color-slider-${channel.key}`}
        style={[styles.sliderTouch, Platform.OS === 'web' && styles.webTouch, { borderColor: focused ? S.fg : 'transparent' }]}
      >
        <View pointerEvents="none" style={[styles.thumb, { left: INSET + (value / channel.max) * trackWidth - THUMB_SIZE / 2, backgroundColor: color }]}>
          <View style={styles.thumbInside} />
        </View>
      </View>
    </View>
  );
}

/** Presets and free RGB colours share the same value; no stored colour is remapped. */
export function ActivityColorPicker({ value, onChange, onValidityChange }: {
  value: string;
  onChange: (hex: string) => void;
  onValidityChange: (valid: boolean) => void;
}) {
  const S = useSurface();
  const [mode, setMode] = useState<'palette' | 'custom'>(() => activityColors.some((c) => c.hex.toLowerCase() === value.toLowerCase()) ? 'palette' : 'custom');
  const [editor, setEditor] = useState(() => ({ hex: value.toLowerCase(), hsv: hexToHsv(value) }));
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const hsv = editor.hex === value.toLowerCase() ? editor.hsv : hexToHsv(value, editor.hsv);
  const hexText = hexDraft ?? value.toUpperCase();
  const validHex = normalizeHex(hexText) !== null;

  const pick = (next: string, nextHsv = hexToHsv(next, hsv)) => {
    setEditor({ hex: next.toLowerCase(), hsv: nextHsv });
    if (next.toLowerCase() !== value.toLowerCase()) onChange(next);
  };
  const changeChannel = (channel: ColorChannel, amount: number) => {
    const next = { ...hsv, [channel]: channel === 'h' ? amount : amount / 100 };
    setHexDraft(null);
    onValidityChange(true);
    pick(hsvToHex(next), next);
  };

  return (
    <View style={styles.picker} testID="activity-color-picker">
      <View style={[styles.modes, { borderBottomColor: S.faint }]} accessibilityRole="tablist" accessibilityLabel="Scelta del colore">
        {([{ key: 'palette', label: 'Palette' }, { key: 'custom', label: 'Colore libero' }] as const).map((choice) => (
          <Pressable
            key={choice.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === choice.key }}
            aria-selected={mode === choice.key}
            onPress={() => { setMode(choice.key); setHexDraft(null); onValidityChange(true); }}
            testID={`color-mode-${choice.key}`}
            style={({ pressed }) => [styles.mode, { borderBottomColor: mode === choice.key ? S.fg : 'transparent', opacity: pressed ? 0.65 : 1 }]}
          >
            <T variant={mode === choice.key ? 'labelStrong' : 'label'} color={mode === choice.key ? S.fg : S.mute}>{choice.label}</T>
          </Pressable>
        ))}
      </View>

      <View style={styles.current} accessible accessibilityLabel={`Colore scelto: ${colorName(value)}, ${value.toUpperCase()}`} testID="color-current">
        <View style={[styles.currentSwatch, { backgroundColor: value, borderColor: S.mute }]} />
        <T variant="small" color={S.fg}>{colorName(value)}</T>
        {colorName(value) !== value.toUpperCase() ? <T variant="label" color={S.mute}>{value.toUpperCase()}</T> : null}
      </View>

      {mode === 'palette' ? (
        <ColorSwatches value={value} onChange={(next) => { setHexDraft(null); onValidityChange(true); pick(next); }} />
      ) : (
        <View style={styles.custom}>
          <View onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}>
            {width > 2 * INSET ? <ColorTracks hsv={hsv} width={width} /> : null}
            {CHANNELS.map((channel) => (
              <ColorSlider
                key={channel.key}
                channel={channel}
                value={channel.key === 'h' ? hsv.h : hsv[channel.key] * 100}
                width={width}
                color={channel.key === 'h' ? hsvToHex({ h: hsv.h, s: 1, v: 1 }) : value}
                onChange={(amount) => changeChannel(channel.key, amount)}
              />
            ))}
          </View>
          <Field
            label="Codice HEX"
            value={hexText}
            onChangeText={(raw) => {
              setHexDraft(raw);
              const next = normalizeHex(raw);
              onValidityChange(next !== null);
              if (next) pick(next);
            }}
            onBlur={() => { if (validHex) setHexDraft(null); }}
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            maxLength={7}
            returnKeyType="done"
            accessibilityLabel="Codice colore esadecimale"
            error={validHex ? null : INVALID_HEX}
            testID="color-hex"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: 12 },
  modes: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  mode: { flex: 1, minHeight: HIT, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 2 },
  current: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', minHeight: 30, gap: 10 },
  currentSwatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 1 },
  custom: { gap: 8 },
  sliderRow: { height: ROW_HEIGHT },
  sliderLabel: { height: LABEL_HEIGHT, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 },
  sliderTouch: { height: HIT, borderWidth: 1, borderRadius: 8 },
  webTouch: { touchAction: 'none', cursor: 'pointer' } as ViewStyle,
  thumb: { position: 'absolute', top: (HIT - THUMB_SIZE) / 2 - 1, width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2, borderWidth: 1, borderColor: '#000000', padding: 1 },
  thumbInside: { flex: 1, borderWidth: 2, borderColor: '#FFFFFF', borderRadius: THUMB_SIZE / 2 },
});
