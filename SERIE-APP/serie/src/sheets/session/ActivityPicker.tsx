/** Move a session to another activity: a radio list of identity discs. */
import { Pressable, StyleSheet, View } from 'react-native';
import type { Category, ID } from '@/domain/types';
import { IdentityDisc } from '@/graphics/IdentityDisc';
import { HIT, palette, surfaces } from '@/ui/theme';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';

const S = surfaces.night;

export function ActivityPicker({ categories, value, original, onChange, testID = 'activity' }: { categories: Category[]; value: ID; original: ID; onChange: (id: ID) => void; testID?: string }) {
  const moved = value !== original ? categories.find((c) => c.id === value) : null;
  return (
    <View style={{ gap: 6 }}>
      <View accessibilityRole="radiogroup" accessibilityLabel={t.activity}>
        {categories.map((c, i) => {
          const on = c.id === value;
          return (
            <Pressable
              key={c.id}
              onPress={() => onChange(c.id)}
              accessibilityRole="radio"
              aria-checked={on}
              accessibilityLabel={t.sessionSheets.activityA11y(c.name, on)}
              style={({ pressed }) => [styles.row, i > 0 && styles.rule, pressed && { opacity: 0.7 }]}
              testID={`${testID}-${c.id}`}
            >
              <IdentityDisc size={40} pattern={c.pattern} color={c.color} stripe={on ? palette.foam : 'rgba(238,232,218,0.55)'} animated={on} />
              <T variant={on ? 'bodyStrong' : 'body'} color={on ? S.fg : S.mute} style={{ flex: 1 }} numberOfLines={1}>
                {c.name}
              </T>
              <View style={[styles.radio, on && { borderColor: c.color }]}>{on ? <View style={[styles.radioDot, { backgroundColor: c.color }]} /> : null}</View>
            </Pressable>
          );
        })}
      </View>
      {moved ? (
        <T variant="small" color={S.mute} accessibilityLiveRegion="polite">
          {t.sessionSheets.movedTo(moved.name)}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: HIT + 10, paddingVertical: 4 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: S.faint },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.2, borderColor: 'rgba(238,232,218,0.35)', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
