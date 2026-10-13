import { useLocalSearchParams } from 'expo-router';
import { DaySheet } from '@/sheets/day/DaySheet';

export default function DayRoute() {
  const { date } = useLocalSearchParams<{ date?: string | string[] }>();
  return <DaySheet date={typeof date === 'string' ? date : ''} />;
}
