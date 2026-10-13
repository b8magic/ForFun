import { useSurface } from '@/ui/useTheme';
/**
 * Create or edit an activity: name (required, ≤40, unique), colour and motion
 * pattern with a live identity-disc preview. Writes only through actions.
 */
import { useState } from 'react';
import { AccessibilityInfo, Keyboard, View } from 'react-native';
import type { Category, ID, PatternKind } from '@/domain/types';
import { createCategory, switchActivity, updateCategory } from '@/state/actions';
import { Button, Field, Note, Rule, Section, Sheet } from '@/ui/controls';
import { activityColors } from '@/ui/theme';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { NAME_MAX, errorCode, errorText, isNameCode, nameIssue, suggestLook, type NameIssue } from './helpers';
import { LookPreview, PatternChoices } from './Look';
import { ActivityColorPicker } from './ActivityColorPicker';
import { FooterPair, KeyboardSafe, closeSheet } from './parts';
import { confirmDiscard, useConfirmDiscard } from '../session/useConfirmDiscard';

const discardCopy = { title: t.discardTitle, body: 'Le modifiche a questa attività non sono state salvate.' };

const nameMessage = (code: NameIssue) => (code === 'name_required' ? t.nameRequired : code === 'name_taken' ? t.nameTaken : t.manage.nameTooLong);

interface Props {
  /** Present when editing. */
  category?: Category | null;
  categories: Category[];
  isActive?: boolean;
  /** First activity (empty state): no way back to a list, a short explanation instead. */
  first?: boolean;
  onCancel?: () => void;
  onSaved: (id: ID, kind: 'created' | 'updated' | 'unchanged') => void;
  onDelete?: () => void;
}

export function ActivityForm({ category, categories, isActive, first, onCancel, onSaved, onDelete }: Props) {
  const S = useSurface();
  const editing = !!category;
  const [initial] = useState(() => (category ? { color: category.color, pattern: category.pattern } : suggestLook(categories, activityColors)));
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(initial.color);
  const [colorValid, setColorValid] = useState(true);
  const [pattern, setPattern] = useState<PatternKind>(initial.pattern);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverName, setServerName] = useState<NameIssue | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const issue = nameIssue(name, categories, category?.id);
  // Too long / taken show while typing; "required" only after trying to save.
  // While a write is in flight the store already holds the new row, so live checks pause.
  const shown: NameIssue | null = busy ? null : serverName ?? (issue === 'name_required' ? (tried ? issue : null) : issue);
  const renamed = editing && trimmed !== category!.name;
  const dirty = name !== (category?.name ?? '') || color !== initial.color || pattern !== initial.pattern;
  const allowLeave = useConfirmDiscard(dirty, { ...discardCopy, blocked: busy });
  const leaveStep = (leave: () => void) => {
    if (busy) return;
    if (dirty) confirmDiscard(leave, discardCopy);
    else leave();
  };
  const cancel = onCancel ? () => leaveStep(onCancel) : undefined;

  async function submit() {
    if (!colorValid) return;
    setTried(true);
    setError(null);
    if (issue) {
      // The message appears under the field; VoiceOver users hear it too.
      AccessibilityInfo.announceForAccessibility(nameMessage(issue));
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      if (editing && category) {
        const patch: { name?: string; color?: string; pattern?: PatternKind } = {};
        if (renamed) patch.name = trimmed;
        if (color !== category.color) patch.color = color;
        if (pattern !== category.pattern) patch.pattern = pattern;
        if (!Object.keys(patch).length) {
          allowLeave();
          return onSaved(category.id, 'unchanged');
        }
        await updateCategory(category.id, patch);
        allowLeave();
        onSaved(category.id, 'updated');
      } else {
        const c = await createCategory({ name: trimmed, color, pattern });
        allowLeave();
        onSaved(c.id, 'created');
      }
    } catch (e) {
      setBusy(false);
      const code = errorCode(e);
      if (isNameCode(code)) setServerName(code);
      else setError(errorText(e));
      AccessibilityInfo.announceForAccessibility(isNameCode(code) ? nameMessage(code) : errorText(e));
    }
  }

  const primary = (
    <Button
      label={editing ? t.manage.saveChanges : t.createActivity}
      onPress={submit}
      busy={busy}
      disabled={!colorValid}
      color={color}
      testID="activity-submit"
    />
  );

  return (
    <KeyboardSafe>
      <Sheet
        keyboardInsets={false}
        title={editing ? t.manage.editTitle : first ? t.createActivity : t.newActivity}
        onBack={cancel}
        backLabel="Torna alle attività"
        onClose={() => { if (!busy) closeSheet(); }}
        testID="activity-form"
        footer={<FooterPair secondary={cancel ? <Button kind="secondary" label={t.cancel} onPress={cancel} disabled={busy} testID="activity-cancel" /> : undefined} primary={primary} />}
      >
        {first ? <Note>{t.noActivitiesBody}</Note> : null}

        <LookPreview name={name} color={color} pattern={pattern} />

        <Section
          label={t.activityName}
          right={
            <T variant="label" color={trimmed.length > NAME_MAX ? S.danger : S.mute} accessibilityLabel={t.manage.nameCountA11y(trimmed.length, NAME_MAX)}>
              {t.manage.nameCount(trimmed.length, NAME_MAX)}
            </T>
          }
          hint={editing ? t.renameNote : undefined}
        >
          <Field
            value={name}
            onChangeText={(v) => {
              setName(v);
              setServerName(null);
            }}
            placeholder={t.manage.namePlaceholder}
            accessibilityLabel={t.activityName}
            autoCapitalize="sentences"
            autoCorrect={false}
            returnKeyType="done"
            error={shown ? nameMessage(shown) : null}
            testID="activity-name"
          />
        </Section>

        <Section label={t.activityColor}>
          <ActivityColorPicker value={color} onChange={setColor} onValidityChange={setColorValid} />
        </Section>

        <Section label={t.activityPattern}>
          <PatternChoices value={pattern} color={color} onChange={setPattern} />
        </Section>

        {error ? <Note tone="error">{error}</Note> : null}

        {editing && category ? (
          <View style={{ gap: 4, marginTop: 4 }}>
            <Rule />
            {!isActive ? (
              <Button
                kind="quiet"
                label={t.manage.useActivity(category.name)}
                onPress={() => {
                  leaveStep(() => {
                    setBusy(true);
                    void switchActivity(category.id).then(() => {
                      allowLeave();
                      closeSheet();
                    }).catch((e) => {
                      setBusy(false);
                      setError(errorText(e));
                    });
                  });
                }}
                disabled={busy}
                testID="activity-use"
              />
            ) : null}
            {onDelete ? (
              <View style={{ marginTop: 8 }}>
                <Button kind="danger" label={t.deleteActivity} onPress={() => leaveStep(onDelete)} disabled={busy} testID="activity-delete" />
              </View>
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </KeyboardSafe>
  );
}
