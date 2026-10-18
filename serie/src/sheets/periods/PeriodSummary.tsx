import { View } from 'react-native';
import type { PeriodSummary as Summary } from '@/domain/types';
import { durationLine } from '@/places/time/format';
import { t } from '@/i18n/it';
import { T } from '@/ui/T';
import { useSurface } from '@/ui/useTheme';

export function PeriodSummary({ summary, testID }: { summary: Summary; testID?: string }) {
  const C = useSurface();
  const duration = durationLine(summary.duration);
  return (
    <View style={{ gap: 4 }} testID={testID}>
      <T variant="bodyStrong" color={C.fg}>{`${t.sessions(summary.sessions)} · ${t.activeDays(summary.activeDays)}`}</T>
      {duration ? <T variant="small" color={C.mute}>{duration}</T> : null}
    </View>
  );
}
