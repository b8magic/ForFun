/** Tiny line glyphs drawn with Views (crisp at any scale, no icon font). */
import { View } from 'react-native';

export function Chevron({ dir, color, size = 9 }: { dir: 'up' | 'down' | 'left' | 'right'; color: string; size?: number }) {
  const rot = { down: '0deg', up: '180deg', left: '90deg', right: '-90deg' }[dir];
  const box = size * 1.6;
  const L = size;
  const off = L * 0.3536; // arms meet exactly at the centre-bottom of the V
  const arm = { position: 'absolute' as const, width: L, height: 1.7, borderRadius: 1, backgroundColor: color, top: box / 2 - 0.85 - L * 0.18, left: box / 2 - L / 2 };
  return (
    <View style={{ width: box, height: box, transform: [{ rotate: rot }] }}>
      <View style={[arm, { transform: [{ translateX: -off }, { rotate: '45deg' }] }]} />
      <View style={[arm, { transform: [{ translateX: off }, { rotate: '-45deg' }] }]} />
    </View>
  );
}

/** Three swell lines: the menu. */
export function MenuGlyph({ color }: { color: string }) {
  return (
    <View style={{ width: 22, height: 14, justifyContent: 'space-between' }}>
      <View style={{ height: 1.8, width: 22, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ height: 1.8, width: 16, backgroundColor: color, borderRadius: 1, alignSelf: 'flex-end' }} />
      <View style={{ height: 1.8, width: 22, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

export function Plus({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: 1.8, backgroundColor: color }} />
      <View style={{ position: 'absolute', width: 1.8, height: size, backgroundColor: color }} />
    </View>
  );
}

export function Close({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size * 1.2, height: 1.8, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', width: size * 1.2, height: 1.8, backgroundColor: color, transform: [{ rotate: '-45deg' }] }} />
    </View>
  );
}
