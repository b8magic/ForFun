import { useSurface } from '@/ui/useTheme';
/**
 * An activity's look: colour swatches, motion patterns and the live preview
 * (identity disc + the crest a selected date takes in that colour).
 */
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import type { PatternKind } from '@/domain/types';
import { IdentityDisc } from '@/graphics/IdentityDisc';
import { activityColors, foregroundOn, HIT } from '@/ui/theme';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { PATTERNS } from './helpers';

export const colorName = (hex: string) => activityColors.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex.toUpperCase();

export function ColorSwatches({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const S = useSurface();
  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={t.activityColor} testID="color-presets">
      {activityColors.map((c) => {
        const on = c.hex.toLowerCase() === value.toLowerCase();
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(c.hex)}
            accessibilityRole="radio"
            aria-checked={on}
            accessibilityLabel={t.manage.colorA11y(c.name)}
            testID={`color-${c.id}`}
            style={({ pressed }) => [styles.swatchCell, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.swatchRing, { borderColor: on ? S.fg : 'transparent' }]}>
              <View style={[styles.swatch, { backgroundColor: c.hex, borderColor: S.mute }]}>
                {on ? <View style={[styles.check, { borderColor: foregroundOn(c.hex) }]} /> : null}
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PatternChoices({ value, color, onChange }: { value: PatternKind; color: string; onChange: (p: PatternKind) => void }) {
  const S = useSurface();
  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={t.activityPattern}>
      {PATTERNS.map((p) => {
        const on = p === value;
        return (
          <Pressable
            key={p}
            onPress={() => onChange(p)}
            accessibilityRole="radio"
            aria-checked={on}
            accessibilityLabel={t.manage.patternA11y(t.patterns[p])}
            testID={`pattern-${p}`}
            style={({ pressed }) => [styles.patternCell, pressed && { opacity: 0.7 }]}
          >
            <IdentityDisc size={58} pattern={p} color={on ? color : 'transparent'} stripe={on ? S.fg : S.mute} animated={false} selected={on} ringColor={S.fg} />
            <T variant={on ? 'labelStrong' : 'label'} color={on ? S.fg : S.mute}>
              {t.patterns[p]}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A short week-line lifting into a crest with a dot: how a selected date looks in this colour. */
const Crest = memo(function Crest({ color, width = 168, height = 40 }: { color: string; width?: number; height?: number }) {
  const S = useSurface();
  const { path, cx, cy } = useMemo(() => {
    const base = height - 8;
    const peak = width * 0.64;
    const amp = 15;
    const sigma = width * 0.09;
    const b = Skia.PathBuilder.Make();
    for (let i = 0; i <= 48; i++) {
      const x = (i / 48) * width;
      const y = base - amp * Math.exp(-((x - peak) ** 2) / (2 * sigma * sigma)) + Math.sin(x / 13) * 0.8;
      if (i === 0) b.moveTo(x, y);
      else b.lineTo(x, y);
    }
    return { path: b.build(), cx: peak, cy: base - amp - 7 };
  }, [width, height]);
  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Path path={path} style="stroke" strokeWidth={1.6} color={S.fg} strokeCap="round" />
      <Circle cx={cx} cy={cy} r={4.2} color={color} />
    </Canvas>
  );
});

export function LookPreview({ name, color, pattern }: { name: string; color: string; pattern: PatternKind }) {
  const S = useSurface();
  const shown = name.trim();
  return (
    <View
      style={styles.preview}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${t.manage.preview}: ${shown || t.newActivity}, ${t.patterns[pattern]}, ${colorName(color)}`}
      testID="look-preview"
    >
      <IdentityDisc size={104} pattern={pattern} color={color} stripe={S.fg} />
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        {shown ? <T variant="heading" color={S.fg} numberOfLines={2}>{shown}</T> : null}
        <T variant="label" color={S.mute} numberOfLines={1}>
          {`${t.patterns[pattern]} · ${colorName(color)}`}
        </T>
        <Crest color={color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  swatchCell: { width: '16.666%', minWidth: HIT, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  swatchRing: { width: HIT, height: HIT, borderRadius: HIT / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  check: { width: 12, height: 7, borderLeftWidth: 2, borderBottomWidth: 2, transform: [{ rotate: '-45deg' }], marginTop: -2 },
  patternCell: { width: '33.333%', minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 4 },
});
