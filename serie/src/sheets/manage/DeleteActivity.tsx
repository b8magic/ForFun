import { useSurface } from '@/ui/useTheme';
/**
 * Deleting an activity, with explicit safeguards:
 *  - no sessions → one confirmation;
 *  - sessions → choose "Sposta le sessioni in …" (pick a target) or
 *    "Elimina anche N sessioni", which asks for a second, separate confirmation.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import type { Category, ID } from '@/domain/types';
import type { DeleteStrategy } from '@/data/repositories';
import { deleteCategory } from '@/state/actions';
import { IdentityDisc } from '@/graphics/IdentityDisc';
import { Button, Note, Section, Sheet } from '@/ui/controls';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { errorText, moveTargets } from './helpers';
import { FooterPair, RadioRow } from './parts';

type Choice = 'move' | 'delete' | null;

interface Props {
  category: Category;
  categories: Category[];
  counts: Map<ID, number>;
  onCancel: () => void;
  onDeleted: (name: string) => void;
}

export function DeleteActivity({ category, categories, counts, onCancel, onDeleted }: Props) {
  const S = useSurface();
  const n = counts.get(category.id) ?? 0;
  const targets = moveTargets(categories, category.id);
  const [choice, setChoice] = useState<Choice>(null);
  const [targetId, setTargetId] = useState<ID | null>(targets.length === 1 ? targets[0].id : null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = targets.find((c) => c.id === targetId) ?? null;
  // The second confirmation appears in the same footer slot as the first: it arms after a
  // beat, so a double tap (or a repeated VoiceOver activation) can never pass both at once.
  const [armed, setArmed] = useState(false);
  const [armedFor, setArmedFor] = useState(confirming);
  if (armedFor !== confirming) {
    setArmedFor(confirming);
    setArmed(false);
  }
  useEffect(() => {
    if (!confirming) return;
    AccessibilityInfo.announceForAccessibility(`${t.manage.secondConfirm}. ${t.manage.deleteSummary(n, category.name)} ${t.deleteWithSessionsConfirm}`);
    const id = setTimeout(() => setArmed(true), 700);
    return () => clearTimeout(id);
  }, [confirming, n, category.name]);

  async function run(strategy?: DeleteStrategy) {
    setBusy(true);
    setError(null);
    try {
      await deleteCategory(category.id, strategy);
      onDeleted(category.name);
    } catch (e) {
      setBusy(false);
      setError(errorText(e));
    }
  }

  const stacked = n > 0;
  const cancel = <Button kind={stacked ? 'quiet' : 'secondary'} label={t.cancel} onPress={confirming ? () => setConfirming(false) : onCancel} testID="delete-cancel" />;

  let primary;
  if (n === 0) {
    primary = <Button label={t.delete} color={S.danger} onPress={() => run()} busy={busy} testID="delete-confirm" />;
  } else if (confirming) {
    primary = <Button label={t.manage.deleteForever} color={S.danger} onPress={() => armed && run({ kind: 'delete_sessions' })} disabled={!armed} busy={busy} testID="delete-forever" />;
  } else if (choice === 'delete') {
    primary = <Button label={t.deleteWithSessions(n)} color={S.danger} onPress={() => setConfirming(true)} testID="delete-with-sessions" />;
  } else if (choice === null) {
    // Nothing chosen yet: the action stays visibly unavailable until the user picks what happens to the sessions.
    primary = <Button label={t.deleteActivity} color={S.danger} onPress={() => undefined} disabled testID="delete-pending-choice" />;
  } else {
    primary = (
      <Button
        label={t.manage.moveAndDelete}
        onPress={() => target && run({ kind: 'move', toCategoryId: target.id })}
        disabled={!target}
        busy={busy}
        color={target?.color}
        testID="delete-move"
      />
    );
  }

  return (
    <Sheet title={t.deleteActivity} eyebrow={category.name} testID="activity-delete-sheet" footer={<FooterPair secondary={cancel} primary={primary} stacked={stacked} />}>
      <View style={styles.head}>
        <IdentityDisc size={64} pattern={category.pattern} color={category.color} stripe={S.fg} animated={false} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <T variant="title" color={S.fg} numberOfLines={2}>
            {category.name}
          </T>
          <T variant="label" color={S.mute}>
            {t.sessions(n)}
          </T>
        </View>
      </View>

      {n === 0 ? (
        <T variant="body" color={S.fg}>
          {t.manage.deleteEmptyConfirm(category.name)}
        </T>
      ) : confirming ? (
        <View style={{ gap: 14 }} accessibilityLiveRegion="assertive" testID="delete-second-confirm">
          <T variant="labelStrong" color={S.danger}>
            {t.manage.secondConfirm}
          </T>
          <T variant="bodyStrong" color={S.fg}>
            {t.manage.deleteSummary(n, category.name)}
          </T>
          <Note tone="error">{t.deleteWithSessionsConfirm}</Note>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <T variant="body" color={S.fg}>
            {t.deleteActivityHasSessions(n, category.name)}
          </T>
          <View accessibilityRole="radiogroup" style={{ marginTop: 6 }}>
            <RadioRow
              title={t.moveSessionsTo(target && choice === 'move' ? target.name : '…')}
              detail={targets.length ? null : t.manage.noOtherActivity}
              on={choice === 'move'}
              onPress={() => setChoice('move')}
              disabled={!targets.length}
              accent={target?.color}
              testID="delete-choice-move"
            />
            {choice === 'move' && targets.length ? (
              <View style={styles.targets}>
                <Section label={t.manage.chooseTarget}>
                  <View accessibilityRole="radiogroup">
                    {targets.map((c) => (
                      <RadioRow
                        key={c.id}
                        title={c.name}
                        detail={t.sessions(counts.get(c.id) ?? 0)}
                        on={c.id === targetId}
                        onPress={() => setTargetId(c.id)}
                        accent={c.color}
                        left={<IdentityDisc size={36} pattern={c.pattern} color={c.color} stripe={S.fg} animated={false} />}
                        testID={`delete-target-${c.name}`}
                      />
                    ))}
                  </View>
                </Section>
              </View>
            ) : null}
            <RadioRow title={t.deleteWithSessions(n)} on={choice === 'delete'} onPress={() => setChoice('delete')} accent={S.danger} testID="delete-choice-delete" />
          </View>
          {choice === 'move' && target ? <Note>{t.manage.moveSummary(n, category.name, target.name)}</Note> : null}
        </View>
      )}

      {error ? <Note tone="error">{error}</Note> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  targets: { paddingLeft: 34, paddingBottom: 6 },
});
