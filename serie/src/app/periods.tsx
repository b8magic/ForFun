import { useLocalSearchParams } from 'expo-router';
import { PeriodsSheet } from '@/sheets/periods/PeriodsSheet';

export default function PeriodsRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  return <PeriodsSheet initialId={typeof id === 'string' ? id : undefined} />;
}
