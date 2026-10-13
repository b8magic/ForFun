import { useEffect, useMemo } from 'react';
import { AccessibilityInfo, Appearance, AppState, Platform, View, useWindowDimensions } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fontAssets } from '@/ui/theme';
import { useSurface, useThemePref } from '@/ui/useTheme';
import { useApp } from '@/state/store';
import { boot, refreshToday } from '@/state/actions';
import { startAutoExportRuntime } from '@/calendar/autoRuntime';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { T } from '@/ui/T';

// Keep the launch surface visible until fonts and the saved theme are ready.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 280, fade: true });

const sheet = {
  presentation: Platform.OS === 'ios' ? ('formSheet' as const) : ('modal' as const),
  sheetGrabberVisible: true,
  sheetCornerRadius: 22,
};

export default function RootLayout() {
  const S = useSurface();
  const themePref = useThemePref();
  const { height } = useWindowDimensions();
  const jumpDetent = Math.min(1, Math.max(0.72, 560 / height));
  const [fontsLoaded] = useFonts(fontAssets);
  const status = useApp((s) => s.status);
  const bootError = useApp((s) => s.bootError);
  const navigationTheme = useMemo(() => {
    const base = themePref === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: S.bg, card: S.bg, text: S.fg, border: S.faint, primary: S.accent, notification: S.accent } };
  }, [S, themePref]);

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
    if (!fontsLoaded || status === 'booting') return;
    let live = true;
    const colorScheme = themePref === 'dark' ? 'dark' : 'light';
    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined') document.documentElement.style.colorScheme = colorScheme;
    } else {
      // Native keyboards and sheets follow the explicit preference too.
      Appearance.setColorScheme(colorScheme);
    }
    SystemUI.setBackgroundColorAsync(S.bg).catch(() => undefined).then(() => {
      if (live) SplashScreen.hideAsync().catch(() => undefined);
    });
    return () => { live = false; };
  }, [fontsLoaded, status, S.bg, themePref]);

  if (!fontsLoaded || status === 'booting') return <View style={{ flex: 1, backgroundColor: S.bg }} />;
  if (status === 'error')
    return (
      <View style={{ flex: 1, backgroundColor: S.bg, padding: 24, justifyContent: 'center' }}>
        <StatusBar style={themePref === 'dark' ? 'light' : 'dark'} />
        <T variant="heading">Serie non si è avviata</T>
        <T variant="small" color={S.danger} style={{ marginTop: 12 }}>{bootError}</T>
      </View>
    );

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: S.bg }}>
      <SafeAreaProvider>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style={themePref === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: S.bg }, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="details" options={{ ...sheet, sheetAllowedDetents: [0.62, 1] }} />
            <Stack.Screen name="bulk" options={{ ...sheet, sheetAllowedDetents: [1] }} />
            <Stack.Screen name="bulk-day" options={{ ...sheet, sheetAllowedDetents: [1] }} />
            <Stack.Screen name="session/[id]" options={{ ...sheet, sheetAllowedDetents: [1] }} />
            <Stack.Screen name="activities" options={{ ...sheet, sheetAllowedDetents: [1] }} />
            <Stack.Screen name="menu" options={{ ...sheet, sheetAllowedDetents: [0.85, 1] }} />
            <Stack.Screen name="jump" options={{ ...sheet, sheetAllowedDetents: jumpDetent < 1 ? [jumpDetent, 1] : [1] }} />
            <Stack.Screen name="day" options={{ ...sheet, sheetAllowedDetents: [0.7, 1] }} />
            <Stack.Screen name="periods" options={{ ...sheet, sheetAllowedDetents: [1] }} />
            <Stack.Screen name="calendar" options={{ ...sheet, sheetAllowedDetents: [1] }} />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
