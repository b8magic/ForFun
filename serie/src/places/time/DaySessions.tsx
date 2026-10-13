/** Session rows shared by the monthly archive and the day detail sheet. */
import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { Category, LocalDate, Session } from '@/domain/types';
import { summarize } from '@/domain/stats';
import { useSurface } from '@/ui/useTheme';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { compactDurationLine, dateLabel, durationLine, placeSummary, recordedTimingSummary, sessionPreview } from './format';
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
  /** Browsing a calendar day keeps each field visible and notes to one line. */
  preview?: boolean;
  /** Only saved day details offer deletion; the caller confirms before writing. */
  onDelete?: (session: Session) => void;
  /** Only the first row bounds the initial inline reveal, however long the day is. */
  onFirstRowLayout?: (node: View) => void;
}

export function DaySessions({ date, sessions, catById, showActivity, showDate = true, interactive = true, preview = false, onDelete, onFirstRowLayout }: Props) {
  const C = useSurface();
  const openedRow = useRef<SwipeableMethods | null>(null);
  const openRow = useCallback((row: SwipeableMethods) => {
    if (openedRow.current !== row) openedRow.current?.close();
    openedRow.current = row;
  }, []);
  const duration = summarize(sessions).duration;
  const fullTotal = [t.sessions(sessions.length), durationLine(duration)].filter(Boolean).join(' · ');
  const total = preview ? [t.sessions(sessions.length), compactDurationLine(duration)].filter(Boolean).join(' · ') : fullTotal;
  return (
    <View style={styles.day}>
      {showDate ? (
        <T variant="label" color={C.mute}>
          {t.sessionsOnDay(dateLabel(date))}
        </T>
      ) : null}
      <T variant="data" color={C.fg} accessibilityLabel={preview ? total : undefined} testID="day-total">
        {total}
      </T>
      {sessions.map((s, i) => {
        const c = catById.get(s.categoryId);
        const compact = preview ? sessionPreview(s) : undefined;
        const detail = (compact
          ? [compact.timing, compact.place, compact.notes]
          : [recordedTimingSummary(s), placeSummary(s.place), s.notes?.trim() ? `“${s.notes}”` : null]).filter(Boolean).join('\n');
        return (
          <DaySessionRow
            key={s.id}
            id={s.id}
            title={showActivity && c ? c.name : `Sessione ${i + 1}`}
            detail={detail}
            preview={compact}
            color={c?.color ?? C.mute}
            interactive={interactive}
            accessibilityLabel={`${showActivity && c ? c.name + ', ' : ''}sessione ${i + 1}${detail ? `: ${detail.replace(/\n/g, ', ')}` : ''}${interactive ? '. Apri dettagli' : ''}`}
            deleteLabel={`Elimina ${showActivity && c ? c.name + ', ' : ''}sessione ${i + 1}`}
            onDelete={onDelete ? () => onDelete(s) : undefined}
            onOpen={openRow}
            onLayoutReady={i === 0 ? onFirstRowLayout : undefined}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  day: { marginTop: 12, gap: 4 },
});
