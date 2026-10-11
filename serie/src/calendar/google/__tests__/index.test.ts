/**
 * Smoke test of the app wiring under jest-expo: the Expo adapters load with the
 * installed SDK 57 packages (import names/signatures) and an unconfigured build
 * reports an honest status instead of prompting.
 */
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { createGoogleCalendar, GOOGLE_SETUP } from '@/calendar/google';
import { createExpoAuthorizer, createPlatformTokenStore, detectExpoGo, GOOGLE_DISCOVERY, GOOGLE_TOKEN_STORE_KEY } from '@/calendar/google/expoAdapters';

describe('Google Calendar app wiring', () => {
  const saved = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  afterEach(() => {
    if (saved === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    else process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = saved;
  });

  it('loads the Expo adapters with the installed SDK APIs', () => {
    expect(typeof SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY).toBe('number');
    expect(ExecutionEnvironment.StoreClient).toBe('storeClient');
    expect(GOOGLE_DISCOVERY.tokenEndpoint).toBe('https://oauth2.googleapis.com/token');
    expect(GOOGLE_TOKEN_STORE_KEY).toMatch(/^[\w.-]+$/);
    expect(typeof createExpoAuthorizer().authorize).toBe('function');
    expect(typeof createPlatformTokenStore().load).toBe('function');
    expect(GOOGLE_SETUP.length).toBeGreaterThan(100);
  });

  it('without a client id the provider reports not_configured (or unavailable in Expo Go)', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    const { provider } = createGoogleCalendar();
    const c = await provider.getConnection();
    const expoGo = Platform.OS === 'ios' && detectExpoGo(Constants);
    expect(c.status).toBe(Platform.OS !== 'ios' && Platform.OS !== 'web' ? 'unavailable' : expoGo ? 'unavailable' : 'not_configured');
    expect(c.detail).toBeTruthy();
    expect(provider.capabilities.eventLabels).toBe(true);
  });
});
