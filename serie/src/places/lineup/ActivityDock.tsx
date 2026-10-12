import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { Category } from '@/domain/types';
import { useApp } from '@/state/store';
import { switchActivity } from '@/state/actions';
import { IdentityDisc } from '@/graphics/IdentityDisc';
import { useSurface } from '@/ui/useTheme';
import { palette } from '@/ui/theme';
import { T } from '@/ui/T';
import { softenColor } from '@/ui/calendar/DayMosaic';

export function ActivityDock({ categories, activeId }: { categories: Category[]; activeId: string }) {
  const surface = useSurface();
  const drafts = useApp((state) => state.drafts);
  const ref = useRef<ScrollView>(null);
  const positions = useRef(new Map<string, number>());
  const reveal = () => { const x = positions.current.get(activeId); if (x !== undefined) ref.current?.scrollTo({ x: Math.max(0, x - 8), animated: false }); };
  useEffect(reveal, [activeId]);
  return (
    <View style={styles.row}>
      <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} onContentSizeChange={reveal} style={{ flex: 1 }}>
        {categories.map((category) => {
          const active = category.id === activeId;
          const draftCount = drafts[category.id]?.dates.length ?? 0;
          const ink = active ? palette.ink : surface.fg;
          return (
            <View key={category.id} onLayout={(event) => positions.current.set(category.id, event.nativeEvent.layout.x)} testID={active ? 'activity-switcher' : undefined} accessibilityLabel={active ? `Attività attiva: ${category.name}. Tocca per cambiare attività.` : undefined} aria-expanded={false}>
              <Pressable onPress={() => { void switchActivity(category.id); }} accessibilityRole="button" accessibilityLabel={`${category.name}${active ? ', attività attiva' : ''}${draftCount ? `, ${draftCount} date da salvare` : ''}`} accessibilityState={{ selected: active }} testID={`activity-${category.name}`} style={({ pressed }) => [styles.chip, { backgroundColor: active ? category.color : softenColor(category.color, surface.bg, 0.18), borderColor: active ? surface.fg : 'transparent', opacity: pressed ? 0.7 : 1 }]}>
                <IdentityDisc size={25} pattern={category.pattern} color={ink} stripe={ink} animated={false} />
                <T variant="bodyStrong" color={ink} numberOfLines={1} style={{ maxWidth: 150 }}>{category.name}</T>
                {draftCount ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: ink }} /> : null}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
      <Pressable onPress={() => router.push('/activities')} accessibilityRole="button" accessibilityLabel="Gestisci attività" testID="manage-activities" style={[styles.manage, { backgroundColor: surface.raised }]}>
        {[0, 1, 2].map((row) => <View key={row} style={{ width: 20, height: 6, justifyContent: 'center' }}><View style={{ height: 1.5, backgroundColor: surface.fg }} /><View style={{ position: 'absolute', left: row === 1 ? 12 : 4, width: 5, height: 5, borderRadius: 3, borderWidth: 1.5, borderColor: surface.fg, backgroundColor: surface.raised }} /></View>)}
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, rail: { flexDirection: 'row', gap: 8, paddingRight: 4 }, chip: { minHeight: 48, borderRadius: 24, borderWidth: 1.2, paddingHorizontal: 12, gap: 7, flexDirection: 'row', alignItems: 'center' }, manage: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' } });
