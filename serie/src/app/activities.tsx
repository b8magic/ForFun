/**
 * Attività — manage activity categories (list, reorder, create, edit, delete).
 * Also the create path for the Lineup empty state: with no activities the
 * create form is shown directly, and saving the first one returns to logging.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { ID } from '@/domain/types';
import { useApp } from '@/state/store';
import { showToast } from '@/state/actions';
import { Button, Note, Sheet } from '@/ui/controls';
import { useSurface } from '@/ui/useTheme';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { countByCategory } from '@/sheets/manage/helpers';
import { ActivityList } from '@/sheets/manage/ActivityList';
import { ActivityForm } from '@/sheets/manage/ActivityForm';
import { DeleteActivity } from '@/sheets/manage/DeleteActivity';
import { closeSheet } from '@/sheets/manage/parts';

type Mode = { kind: 'list' } | { kind: 'create'; first: boolean } | { kind: 'edit'; id: ID } | { kind: 'delete'; id: ID };

export default function ActivitiesSheet() {
  const S = useSurface();
  const categories = useApp((s) => s.categories);
  const sessions = useApp((s) => s.sessions);
  const activeId = useApp((s) => s.activeId);
  const activeNotice = useApp((s) => s.activeNotice);
  const params = useLocalSearchParams<{ mode?: string }>();
  const counts = useMemo(() => countByCategory(sessions), [sessions]);

  const [mode, setMode] = useState<Mode>(() =>
    categories.length === 0 ? { kind: 'create', first: true } : params.mode === 'new' ? { kind: 'create', first: false } : { kind: 'list' },
  );
  const [flash, setFlash] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<ID | null>(null);
  /** Set when this sheet deleted the active activity: the context change is said in plain words, here and on return. */
  const [switched, setSwitched] = useState<{ deleted: string; now: string } | null>(null);
  const switchedRef = useRef(switched);
  useEffect(() => {
    switchedRef.current = switched;
  }, [switched]);

  // The list shows the context change while the sheet is open; once it closes the Lineup
  // (whose header already shows the new activity) also gets it as a toast — unless the user
  // has switched activity since, which clears the store's notice.
  useEffect(
    () => () => {
      const sw = switchedRef.current;
      if (sw && useApp.getState().activeNotice) showToast(t.manage.deletedActive(sw.deleted, sw.now), { ms: 6000 });
    },
    [],
  );
  // The store's wording is written for launch ("the remembered activity no longer exists");
  // after a deletion made here, the plain "Ora registri in …" is the truthful version.
  const notice = activeNotice ? (switched ? t.manage.nowLoggingIn(switched.now) : activeNotice) : null;

  const toList = (message: string | null = null, spoken: string | null = message) => {
    setFlash(message);
    setMode({ kind: 'list' });
    // The notes below are visual; VoiceOver hears the same outcome.
    if (spoken) AccessibilityInfo.announceForAccessibility(spoken);
  };
  const open = (next: Mode) => {
    setFlash(null);
    setHighlight(null);
    setMode(next);
  };

  // Confirmations are transient; the active-context notice stays until the user switches activity.
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 6000);
    return () => clearTimeout(id);
  }, [flash]);

  // No activities (first launch after deleting the last one, or the Lineup empty state): create directly.
  if (categories.length === 0 && mode.kind !== 'create') {
    return <ActivityForm key="first" categories={categories} first onSaved={() => closeSheet()} />;
  }

  if (mode.kind === 'create') {
    return (
      <ActivityForm
        key="create"
        categories={categories}
        first={mode.first}
        onCancel={mode.first ? undefined : () => toList()}
        onSaved={(id) => {
          if (mode.first) return closeSheet();
          setHighlight(id);
          const c = useApp.getState().categories.find((x) => x.id === id);
          toList(c ? t.manage.created(c.name) : null);
        }}
      />
    );
  }

  if (mode.kind === 'edit' || mode.kind === 'delete') {
    const category = categories.find((c) => c.id === mode.id);
    if (category && mode.kind === 'edit') {
      return (
        <ActivityForm
          key={`edit-${category.id}`}
          category={category}
          categories={categories}
          isActive={category.id === activeId}
          onCancel={() => toList()}
          onSaved={(_, kind) => toList(kind === 'updated' ? t.changesSaved : null)}
          onDelete={() => open({ kind: 'delete', id: category.id })}
        />
      );
    }
    if (category) {
      return (
        <DeleteActivity
          key={`delete-${category.id}`}
          category={category}
          categories={categories}
          counts={counts}
          onCancel={() => open({ kind: 'edit', id: category.id })}
          onDeleted={(name) => {
            const st = useApp.getState();
            const now = st.categories.find((c) => c.id === st.activeId);
            const wasActive = category.id === activeId && !!now;
            if (wasActive) setSwitched({ deleted: name, now: now.name });
            toList(t.manage.deleted(name), wasActive ? t.manage.deletedActive(name, now.name) : t.manage.deleted(name));
          }}
        />
      );
    }
    // The activity vanished underneath (deleted elsewhere): fall back to the list.
  }

  return (
    <Sheet
      title={t.activities}
      testID="activities-sheet"
      footer={<Button label={t.newActivity} onPress={() => open({ kind: 'create', first: false })} testID="activity-new" />}
    >
      {notice || flash ? (
        <View style={{ gap: 10 }} accessibilityLiveRegion="polite">
          {flash ? <Note>{flash}</Note> : null}
          {notice ? <Note tone="warn">{notice}</Note> : null}
        </View>
      ) : null}
      <View style={{ gap: 12 }}>
        <ActivityList categories={categories} counts={counts} activeId={activeId} highlightId={highlight} onEdit={(id) => open({ kind: 'edit', id })} />
        <T variant="small" color={S.mute}>
          {t.manage.orderHint}
        </T>
      </View>
    </Sheet>
  );
}
