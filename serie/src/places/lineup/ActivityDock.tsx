import { useCallback, useLayoutEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { Category } from '@/domain/types';
import { useApp } from '@/state/store';
import { switchActivity } from '@/state/actions';
import { IdentityDisc } from '@/graphics/IdentityDisc';
import { useSurface } from '@/ui/useTheme';
import { foregroundOn, HIT } from '@/ui/theme';
import { T } from '@/ui/T';
import { softenColor } from '@/ui/calendar/DayMosaic';

export function ActivityDock({ categories, activeId }: { categories: Category[]; activeId: string | null }) {
  const surface = useSurface();
  const drafts = useApp((state) => state.drafts);
  const ref = useRef<ScrollView>(null);
  const positions = useRef(new Map<string, { x: number; width: number }>());
  const viewportWidth = useRef(0);
  const contentWidth = useRef(0);
  const scrollOffset = useRef(0);
  const activeIdRef = useRef(activeId);
  const reveal = useCallback(() => {
    const chip = activeIdRef.current ? positions.current.get(activeIdRef.current) : undefined;
    const viewport = viewportWidth.current;
    if (!chip || !viewport || !contentWidth.current) return;
    const offset = scrollOffset.current;
    let target = offset;
    // Choosing an already visible activity must leave neighbouring chips still.
    if (chip.width >= viewport || chip.x < offset) target = chip.x;
    else if (chip.x + chip.width > offset + viewport) target = chip.x + chip.width - viewport;
    target = Math.max(0, Math.min(target, contentWidth.current - viewport));
    if (Math.abs(target - offset) > 0.5) ref.current?.scrollTo({ x: target, animated: false });
  }, []);
  useLayoutEffect(() => {
    activeIdRef.current = activeId;
    reveal();
  }, [activeId, reveal]);
  return (
    <View style={styles.row} testID="activity-dock">
      <ScrollView
        ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} style={{ flex: 1 }}
        scrollsToTop={false} testID="activity-rail"
        onLayout={(event) => { viewportWidth.current = event.nativeEvent.layout.width; reveal(); }}
        onContentSizeChange={(width) => { contentWidth.current = width; reveal(); }}
        onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.x; }}
        scrollEventThrottle={16}
      >
        {categories.map((category) => {
          const active = category.id === activeId;
          const draftCount = drafts[category.id]?.dates.length ?? 0;
          const ink = active ? foregroundOn(category.color) : surface.fg;
          return (
            <View key={category.id} onLayout={(event) => { const { x, width } = event.nativeEvent.layout; positions.current.set(category.id, { x, width }); if (category.id === activeIdRef.current) reveal(); }} testID={active ? 'activity-switcher' : undefined} accessibilityLabel={active ? `Attività attiva: ${category.name}` : undefined} aria-expanded={false}>
              <Pressable onPress={() => { void switchActivity(active ? null : category.id).catch(() => undefined); }} accessibilityRole="button" accessibilityLabel={`${category.name}${active ? ', attività attiva' : ''}${draftCount ? `, ${draftCount} date da salvare` : ''}`} accessibilityHint={active ? 'Disattiva per vedere tutte le attività a colori pieni' : 'Seleziona per registrare sessioni di questa attività'} accessibilityState={{ selected: active }} testID={`activity-${category.name}`} style={({ pressed }) => [styles.chipTarget, { opacity: pressed ? 0.7 : 1 }]}>
                <View testID={`activity-pill-${category.id}`} style={[styles.chip, { backgroundColor: active ? category.color : softenColor(category.color, surface.bg, 0.18), borderColor: active ? surface.fg : 'transparent' }]}>
                  <IdentityDisc size={22} pattern={category.pattern} color={ink} stripe={ink} animated={false} />
                  <T variant="bodyStrong" color={ink} numberOfLines={1} style={styles.chipName}>{category.name}</T>
                  {draftCount ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: ink }} /> : null}
                </View>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
      <Pressable onPress={() => router.push('/activities')} accessibilityRole="button" accessibilityLabel="Gestisci attività" testID="manage-activities" style={styles.manageTarget}>
        <View style={[styles.manage, { backgroundColor: surface.raised }]}>
          {[0, 1, 2].map((row) => <View key={row} style={{ width: 20, height: 6, justifyContent: 'center' }}><View style={{ height: 1.5, backgroundColor: surface.fg }} /><View style={{ position: 'absolute', left: row === 1 ? 12 : 4, width: 5, height: 5, borderRadius: 3, borderWidth: 1.5, borderColor: surface.fg, backgroundColor: surface.raised }} /></View>)}
        </View>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rail: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 4 },
  // The visual shell is compact; the Pressable keeps a full native touch target.
  chipTarget: { minHeight: HIT, minWidth: HIT, justifyContent: 'center' },
  chip: { minHeight: 36, borderRadius: 18, borderWidth: 1.2, paddingVertical: 5, paddingHorizontal: 10, gap: 5, flexDirection: 'row', alignItems: 'center' },
  chipName: { maxWidth: 150, fontSize: 14, lineHeight: 20 },
  manageTarget: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  manage: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
