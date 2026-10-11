/**
 * Moment A — switching activity.
 * The week-lines draw back, the activity discs rise onto a swell arc, the
 * active disc (drawn by the water canvas) travels into its slot. Choosing a
 * disc flows it back to the header; its stripes then pour into the lines.
 */
import { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedReaction, useAnimatedStyle, runOnJS, type SharedValue } from 'react-native-reanimated';
import { router } from 'expo-router';
import type { Category } from '@/domain/types';
import { IdentityDisc } from '@/graphics/IdentityDisc';
import { palette, surfaces, HIT } from '@/ui/theme';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { easeFlow, clamp01 } from '@/motion/grammar';
import type { LineupLayout } from './layout';

export interface Slot {
  x: number;
  y: number;
  r: number;
}

/** Disc positions on a swell arc (two rows beyond five activities). */
export function arcSlots(n: number, L: LineupLayout): Slot[] {
  const perRow = n <= 5 ? Math.max(n, 1) : Math.ceil(n / 2);
  const rows = Math.ceil(n / perRow);
  const r = Math.min(30, ((L.W - 2 * L.G) / perRow) * 0.3);
  const out: Slot[] = [];
  for (let k = 0; k < n; k++) {
    const row = Math.floor(k / perRow);
    const idx = k % perRow;
    const inRow = Math.min(perRow, n - row * perRow);
    const u = (idx + 0.5) / inRow;
    const x = L.G + (L.W - 2 * L.G) * (0.06 + 0.88 * u);
    const y = L.titleTop + 92 + row * 128 - Math.sin(Math.PI * u) * 22;
    out.push({ x, y, r });
  }
  return rows ? out : out;
}

interface Props {
  L: LineupLayout;
  categories: Category[];
  activeId: string | null;
  open: boolean;
  sw: SharedValue<number>;
  onPick: (id: string) => void;
  onClose: () => void;
}

function SwitcherImpl({ L, categories, activeId, open, sw, onPick, onClose }: Props) {
  const [mounted, setMounted] = useState(open);
  // mount as soon as it opens (adjusted during render); unmounted after the close animation
  if (open && !mounted) setMounted(true);
  useAnimatedReaction(
    () => sw.value,
    (v, prev) => {
      if (v === 0 && prev !== null && prev > 0) runOnJS(setMounted)(false);
    },
  );
  const backdrop = useAnimatedStyle(() => ({ opacity: sw.value }));
  if (!mounted) return null;
  const slots = arcSlots(categories.length, L);
  const lastY = slots.length ? Math.max(...slots.map((s) => s.y)) : L.titleTop + 92;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t.close} />
      <Animated.View style={[styles.head, { top: L.titleTop + 8, left: L.G }, backdrop]} pointerEvents="none">
        <T variant="label" color={surfaces.night.mute}>
          {t.switchActivity}
        </T>
      </Animated.View>
      {categories.map((c, k) => (
        <SwitcherDisc key={c.id} c={c} k={k} slot={slots[k]} active={c.id === activeId} sw={sw} onPick={onPick} />
      ))}
      <Animated.View style={[styles.manage, { top: lastY + 92, left: L.G, right: L.G }, backdrop]}>
        <Pressable
          onPress={() => {
            onClose();
            router.push('/activities');
          }}
          accessibilityRole="button"
          style={styles.manageBtn}
          hitSlop={8}
        >
          <T variant="labelStrong" color={palette.foam}>
            {t.manageActivities}
          </T>
          <View style={styles.manageRule} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const SwitcherDisc = memo(function SwitcherDisc({ c, k, slot, active, sw, onPick }: { c: Category; k: number; slot: Slot; active: boolean; sw: SharedValue<number>; onPick: (id: string) => void }) {
  const style = useAnimatedStyle(() => {
    const p = easeFlow(clamp01((sw.value - k * 0.06) / 0.8));
    return { opacity: p, transform: [{ translateY: (1 - p) * 34 }] };
  });
  const size = slot.r * 2 + slot.r * 0.9;
  return (
    <Animated.View style={[styles.slot, { left: slot.x - 52, top: slot.y - slot.r - slot.r * 0.45, width: 104 }, style]}>
      <Pressable
        onPress={() => onPick(c.id)}
        accessibilityRole="button"
        accessibilityLabel={active ? `${c.name}, attività attiva` : c.name}
        aria-selected={active}
        style={styles.slotBtn}
        testID={`activity-${c.name}`}
      >
        <View style={{ width: size, height: size, opacity: active ? 0 : 1 }}>
          <IdentityDisc size={size} pattern={c.pattern} color={c.color} stripe={palette.foam} />
        </View>
        <T variant="bodyStrong" color={palette.foam} align="center" numberOfLines={2} style={{ marginTop: 6 }}>
          {c.name}
        </T>
        <T variant="label" color={active ? c.color : 'transparent'} style={{ marginTop: 2 }}>
          {active ? 'attiva' : ' '}
        </T>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  head: { position: 'absolute' },
  slot: { position: 'absolute', alignItems: 'center' },
  slotBtn: { alignItems: 'center', minHeight: HIT, minWidth: HIT, paddingHorizontal: 4 },
  manage: { position: 'absolute', alignItems: 'center' },
  manageBtn: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, minHeight: HIT },
  manageRule: { marginTop: 6, height: 1, width: 40, backgroundColor: palette.foam, opacity: 0.5 },
});

export const Switcher = memo(SwitcherImpl);
