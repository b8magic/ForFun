/** Session rows shared by the monthly archive and the day detail sheet. */
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { Category, LocalDate, Session } from '@/domain/types';
import { summarize } from '@/domain/stats';
import type { Surface } from '@/ui/theme';
import { useSurface } from '@/ui/useTheme';
import { T } from '@/ui/T';
import { Chevron } from '@/ui/glyphs';
import { t } from '@/i18n/it';
import { dateLabel, durationLine, timingSummary } from './format';

interface Props {
  date: LocalDate;
  sessions: readonly Session[];
  catById: ReadonlyMap<string, Category>;
  showActivity: boolean;
  /** Day sheets already use the date as their title. */
  showDate?: boolean;
  /** Unsaved period previews show the rows without opening an editor. */
  interactive?: boolean;
}

export function DaySessions({ date, sessions, catById, showActivity, showDate = true, interactive = true }: Props) {
  const C = useSurface();
  const styles = useMemo(() => makeStyles(C), [C]);
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
          <Pressable
            key={s.id}
            onPress={() => router.push(`/session/${s.id}`)}
            disabled={!interactive}
            accessibilityRole={interactive ? 'button' : undefined}
            accessibilityLabel={`${showActivity && c ? c.name + ', ' : ''}sessione ${i + 1}: ${detail.replace(/\n/g, ', ')}${interactive ? '. Apri dettagli' : ''}`}
            style={styles.dayRow}
            testID={`session-${s.id}`}
          >
            <View style={[styles.dayDot, { backgroundColor: c?.color ?? C.mute }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="bodyStrong" color={C.fg}>
                {showActivity && c ? c.name : `Sessione ${i + 1}`}
              </T>
              <T variant="small" color={C.mute}>
                {detail}
              </T>
            </View>
            {interactive ? <Chevron dir="right" color={C.mute} size={7} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (C: Surface) => StyleSheet.create({
  day: { marginTop: 12, gap: 4 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.faint },
  dayDot: { width: 10, height: 10, borderRadius: 5 },
});
