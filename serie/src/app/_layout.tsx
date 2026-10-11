import { useEffect } from 'react';
import { AccessibilityInfo, AppState, Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fontAssets, palette } from '@/ui/theme';
import { useApp } from '@/state/store';
import { boot, refreshToday } from '@/state/actions';
import { startAutoExportRuntime } from '@/calendar/autoRuntime';
import * as SplashScreen from 'expo-splash-screen';
import { T } from '@/ui/T';

// keep the native splash (same ink as the app) until fonts and the local store are ready,
// so the first frame is the Lineup itself (no-op on web)
SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 280, fade: true });

const sheet = {
  presentation: Platform.OS === 'ios' ? ('formSheet' as const) : ('modal' as const),
  sheetGrabberVisible: true,
  sheetCornerRadius: 22,
  contentStyle: { backgroundColor: palette.ink2 },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontAssets);
  const status = useApp((s) => s.status);
  const bootError = useApp((s) => s.bootError);

  useEffect(() => {
    let stopAuto: (() => void) | null = null;
    let live = true;
    // automatic calendar export starts after the local store is ready; it only acts when enabled
    boot().then(() => {
      if (live) stopAuto = startAutoExportRuntime();
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshToday();
    });
    // follow iOS "Riduci movimento" live, not only at launch
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => useApp.setState({ systemReducedMotion: v }))
      .catch(() => undefined);
    const motionSub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => useApp.setState({ systemReducedMotion: v }));
    // the app may stay open across midnight: the new day must become selectable
    const dayTimer = setInterval(() => {
      if (AppState.currentState === 'active') refreshToday();
    }, 30_000);
    return () => {
      live = false;
      sub.remove();
      motionSub.remove();
      clearInterval(dayTimer);
      stopAuto?.();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded && status !== 'booting') SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, status]);

  if (!fontsLoaded || status === 'booting') return <View style={{ flex: 1, backgroundColor: palette.ink }} />;
  if (status === 'error')
    return (
      <View style={{ flex: 1, backgroundColor: palette.ink, padding: 24, justifyContent: 'center' }}>
        <T variant="heading" color={palette.foam}>Serie non si è avviata</T>
        <T variant="small" color={palette.danger} style={{ marginTop: 12 }}>{bootError}</T>
      </View>
    );

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.ink }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.ink }, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="details" options={{ ...sheet, sheetAllowedDetents: [0.62, 1] }} />
          <Stack.Screen name="session/[id]" options={{ ...sheet, sheetAllowedDetents: [1] }} />
          <Stack.Screen name="activities" options={{ ...sheet, sheetAllowedDetents: [1] }} />
          <Stack.Screen name="menu" options={{ ...sheet, sheetAllowedDetents: [0.55, 1] }} />
          <Stack.Screen name="jump" options={{ ...sheet, sheetAllowedDetents: [0.62, 1] }} />
          <Stack.Screen name="calendar" options={{ ...sheet, sheetAllowedDetents: [1] }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
