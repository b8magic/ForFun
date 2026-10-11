/** Route: "Modifica sessione" sheet for one saved session. */
import { useLocalSearchParams } from 'expo-router';
import { EditSessionSheet } from '@/sheets/session/EditSessionSheet';

export default function SessionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditSessionSheet id={typeof id === 'string' ? id : ''} />;
}
