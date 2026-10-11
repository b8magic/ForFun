import { Stack } from 'expo-router';
import { palette } from '@/ui/theme';
export default function CalendarLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.ink2 } }} />;
}
