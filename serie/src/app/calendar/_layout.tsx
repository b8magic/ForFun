import { Stack } from 'expo-router';
import { useSurface } from '@/ui/useTheme';
export default function CalendarLayout() {
  const S = useSurface();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: S.bg } }} />;
}
