/** Session rows shared by the monthly archive and the day detail sheet. */
import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { Category, LocalDate, Session } from '@/domain/types';
import { summarize } from '@/domain/stats';
import { useSurface } from '@/ui/useTheme';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { dateLabel, durationLine, timingSummary } from './format';
import { DaySessionRow } from './DaySessionRow';

interface Props {
  date: LocalDate;
  sessions: readonly Session[];
  catById: ReadonlyMap<string, Category>;
  showActivity: boolean;
  /** Day sheets already use the date as their title. */
  showDate?: boolean;
  /** Unsaved period previews show the rows without opening an editor. */
  interactive?: boolean;
  /** Only saved day details offer deletion; the caller confirms before writing. */
  onDelete?: (session: Session) => void;
}

export function DaySessions({ date, sessions, catById, showActivity, showDate = true, interactive = true, onDelete }: Props) {
  const C = useSurface();
  const openedRow = useRef<SwipeableMethods | null>(null);
  const openRow = useCallback((row: SwipeableMethods) => {
    if (openedRow.current !== row) openedRow.current?.close();
    openedRow.current = row;
  }, []);
  const dayDur = durationLine(summarize(sessions).duration);
  return (
    <View style={styles.day}>
      {showDate ? (
        <T variant="label" color={C.mute}>
          {t.sessionsOnDay(dateLabel(date))}
        </T>
      ) : null}
      <T variant="data" color={C.fg} testID="day-total">
        {[t.sessions(sessions.length), dayDur].filter(Boolean).join(' · ')}
      </T>
      {sessions.map((s, i) => {
        const c = catById.get(s.categoryId);
        const place = s.place ? [s.place.label?.trim(), s.place.address?.trim()].filter(Boolean).join(' · ') || (s.place.coords ? 'Posizione salvata' : s.place.mapUrl ? 'Link mappa salvato' : t.sessionSheets.placeUnnamed) : null;
        const detail = [timingSummary(s), place, s.notes ? `“${s.notes}”` : null].filter(Boolean).join('\n');
        return (
          <DaySessionRow
            key={s.id}
            id={s.id}
            title={showActivity && c ? c.name : `Sessione ${i + 1}`}
            detail={detail}
            color={c?.color ?? C.mute}
            interactive={interactive}
            accessibilityLabel={`${showActivity && c ? c.name + ', ' : ''}sessione ${i + 1}: ${detail.replace(/\n/g, ', ')}${interactive ? '. Apri dettagli' : ''}`}
            deleteLabel={`Elimina ${showActivity && c ? c.name + ', ' : ''}sessione ${i + 1}`}
            onDelete={onDelete ? () => onDelete(s) : undefined}
            onOpen={openRow}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  day: { marginTop: 12, gap: 4 },
});
