import { useLocalSearchParams } from 'expo-router';
import { BulkDaySheet } from '@/sheets/session/BulkDaySheet';

export default function BulkDayRoute() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  return <BulkDaySheet date={typeof date === 'string' ? date : ''} />;
}
