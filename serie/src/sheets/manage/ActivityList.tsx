import { useSurface, useThemedStyles } from '@/ui/useTheme';
/**
 * All activities in their order: disc, name, truthful session count, the
 * active marker, and accessible move up / move down controls.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition, ReduceMotion } from 'react-native-reanimated';
import type { Category, ID } from '@/domain/types';
import { reorderCategories } from '@/state/actions';
import { useMotionReduced } from '@/state/selectors';
import { IdentityDisc } from '@/graphics/IdentityDisc';
import { type Surface } from '@/ui/theme';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { errorText, moveId } from './helpers';
import { Caret, IconButton, Tag } from './parts';
import { Note } from '@/ui/controls';

export function ActivityList({ categories, counts, activeId, highlightId, onEdit }: { categories: Category[]; counts: Map<ID, number>; activeId: ID | null; highlightId?: ID | null; onEdit: (id: ID) => void }) {
  const S = useSurface();
  const styles = useThemedStyles(createStyles);
  const reduced = useMotionReduced();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = categories.map((c) => c.id);
  const layout = reduced ? undefined : LinearTransition.duration(240).reduceMotion(ReduceMotion.Never);

  async function move(id: ID, dir: -1 | 1) {
    const next = moveId(ids, id, dir);
    if (!next || busy) return;
    setBusy(true);
    setError(null);
    try {
      await reorderCategories(next);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View testID="activity-list">
      <View style={styles.top} />
      {categories.map((c, i) => {
        const n = counts.get(c.id) ?? 0;
        const active = c.id === activeId;
        return (
          <Animated.View key={c.id} layout={layout} style={styles.row}>
            <Pressable
              onPress={() => onEdit(c.id)}
              accessibilityRole="button"
              accessibilityLabel={t.manage.rowA11y(c.name, n, active)}
              accessibilityHint={t.manage.rowHint}
              testID={`manage-activity-${c.name}`}
              style={({ pressed }) => [styles.main, pressed && { opacity: 0.7 }]}
            >
              <IdentityDisc size={50} pattern={c.pattern} color={c.color} stripe={S.fg} animated={false} />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <T variant="title" color={S.fg} numberOfLines={1}>
                  {c.name}
                </T>
                <View style={styles.meta}>
                  <T variant="label" color={S.mute}>
                    {t.sessions(n)}
                  </T>
                  {active ? <Tag color={S.fg}>{t.manage.activeTag}</Tag> : null}
                  {highlightId === c.id && !active ? <Tag color={S.fg}>{t.manage.newTag}</Tag> : null}
                </View>
              </View>
            </Pressable>
            <View style={styles.arrows}>
              <IconButton label={t.manage.moveUp(c.name)} onPress={() => move(c.id, -1)} disabled={i === 0 || busy} testID={`activity-up-${c.name}`}>
                <Caret dir="up" color={S.fg} />
              </IconButton>
              <IconButton label={t.manage.moveDown(c.name)} onPress={() => move(c.id, 1)} disabled={i === categories.length - 1 || busy} testID={`activity-down-${c.name}`}>
                <Caret dir="down" color={S.fg} />
              </IconButton>
            </View>
          </Animated.View>
        );
      })}
      {error ? (
        <View style={{ marginTop: 12 }}>
          <Note tone="error">{error}</Note>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (S: Surface) => StyleSheet.create({
  top: { height: StyleSheet.hairlineWidth, backgroundColor: S.faint },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: S.faint },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 76, paddingVertical: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  arrows: { flexDirection: 'row', marginRight: -10 },
});
