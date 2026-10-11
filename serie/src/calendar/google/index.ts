/**
 * Google Calendar provider — app entry point (wires the Expo adapters).
 * Tests import auth.ts / api.ts / provider.ts directly; this module imports Expo.
 */
import { Platform } from 'react-native';
import { GoogleCalendarApi } from './api';
import { GoogleAuth, readGoogleEnv, resolveGoogleClient } from './auth';
import { GoogleCalendarProvider } from './provider';
import { completeGoogleAuthRedirect, createExpoAuthorizer, createPlatformTokenStore, isExpoGo } from './expoAdapters';

export { GoogleCalendarProvider } from './provider';
export { GoogleAuth } from './auth';
export { GoogleCalendarApi } from './api';
export { GOOGLE_SETUP } from './setup';
export { completeGoogleAuthRedirect } from './expoAdapters';

completeGoogleAuthRedirect();

export interface GoogleCalendarBundle {
  provider: GoogleCalendarProvider;
  auth: GoogleAuth;
  api: GoogleCalendarApi;
}

/** Build the Google provider for this platform/build (client ids from EXPO_PUBLIC_* env). */
export function createGoogleCalendar(): GoogleCalendarBundle {
  const client = resolveGoogleClient(Platform.OS, readGoogleEnv(), { isExpoGo: Platform.OS === 'ios' && isExpoGo() });
  const auth = new GoogleAuth({
    client,
    store: createPlatformTokenStore(),
    authorizer: client.ok ? createExpoAuthorizer() : null,
  });
  const api = new GoogleCalendarApi({ getAccessToken: (o) => auth.getAccessToken(o) });
  return { provider: new GoogleCalendarProvider({ auth, api }), auth, api };
}

export function createGoogleCalendarProvider(): GoogleCalendarProvider {
  return createGoogleCalendar().provider;
}
