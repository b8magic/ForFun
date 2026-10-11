/**
 * Platform adapters for Google OAuth (Expo SDK 57):
 *  - expo-auth-session `AuthRequest` (authorization code + PKCE S256) in
 *    ASWebAuthenticationSession on iOS; implicit token flow on web
 *  - expo-secure-store (iOS Keychain, this device only) for credentials
 *
 * Expo's Google guide recommends a native Google Sign-In library; none is
 * installed in this project, so this uses the generic AuthRequest against
 * Google's endpoints with an iOS OAuth client — the same reversed-client-id
 * redirect the native Google Sign-In SDK uses. Swapping in a native library
 * only means providing another `InteractiveAuthorizer`.
 */
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type { AuthorizationOutcome, AuthorizationRequest, InteractiveAuthorizer, TokenStore } from './auth';
import { GOOGLE_OAUTH_ENDPOINTS, MemoryTokenStore } from './auth';

export const GOOGLE_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: GOOGLE_OAUTH_ENDPOINTS.authorization,
  tokenEndpoint: GOOGLE_OAUTH_ENDPOINTS.token,
  revocationEndpoint: GOOGLE_OAUTH_ENDPOINTS.revocation,
  userInfoEndpoint: GOOGLE_OAUTH_ENDPOINTS.userInfo,
};

/** Keychain item name (alphanumerics, '.', '-', '_' only). */
export const GOOGLE_TOKEN_STORE_KEY = 'serie.google.oauth.v1';

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  // Readable by background export after the first unlock; never synced to other devices or backups.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/** Credentials in the iOS Keychain via expo-secure-store. */
export function createSecureTokenStore(): TokenStore {
  return {
    load: () => SecureStore.getItemAsync(GOOGLE_TOKEN_STORE_KEY, SECURE_OPTIONS),
    save: (v) => SecureStore.setItemAsync(GOOGLE_TOKEN_STORE_KEY, v, SECURE_OPTIONS),
    clear: () => SecureStore.deleteItemAsync(GOOGLE_TOKEN_STORE_KEY, SECURE_OPTIONS),
  };
}

/** Keychain on native; memory only on web (expo-secure-store has no web backend — never localStorage). */
export function createPlatformTokenStore(): TokenStore {
  return Platform.OS === 'web' ? new MemoryTokenStore() : createSecureTokenStore();
}

/**
 * Expo Go detection. SDK 57 documents `ExecutionEnvironment.StoreClient` as
 * "Expo Go or a development build built with expo-dev-client", so that value
 * alone would lock development builds — the only builds that can run this
 * flow — out of Google sign-in. Expo Go additionally reports its own version
 * (`expoVersion`, null in apps built from this project) and, deprecated but
 * still native-set, `appOwnership: 'expo'`.
 */
export function detectExpoGo(c: { executionEnvironment?: string | null; expoVersion?: string | null; appOwnership?: string | null }): boolean {
  if (c.executionEnvironment !== ExecutionEnvironment.StoreClient) return false;
  return !!c.expoVersion || c.appOwnership === 'expo';
}

export const isExpoGo = (): boolean => detectExpoGo(Constants);

/**
 * Closes the web auth popup when the app is loaded at the redirect URL.
 * Must run on web at app start (importing `@/calendar/google` does it).
 */
export function completeGoogleAuthRedirect(): void {
  if (Platform.OS === 'web') WebBrowser.maybeCompleteAuthSession();
}

/** Interactive authorization with expo-auth-session. */
export function createExpoAuthorizer(): InteractiveAuthorizer {
  return {
    async authorize(req: AuthorizationRequest): Promise<AuthorizationOutcome> {
      // The native redirect is used verbatim: `makeRedirectUri({ native })` returns it only for the
      // 'bare'/'standalone' environments and would otherwise substitute an app-scheme URL Google rejects.
      // The same string is sent to the token endpoint, so authorization and exchange always match.
      const redirectUri = req.redirectUri ?? AuthSession.makeRedirectUri();
      const isCode = req.flow === 'code_pkce';
      const request = new AuthSession.AuthRequest({
        clientId: req.clientId,
        redirectUri,
        scopes: req.scopes,
        responseType: isCode ? AuthSession.ResponseType.Code : AuthSession.ResponseType.Token,
        usePKCE: isCode,
        codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
        extraParams: req.loginHint ? { login_hint: req.loginHint } : {},
      });
      const result = await request.promptAsync(GOOGLE_DISCOVERY);
      if (result.type === 'success') {
        if (isCode) {
          const code = result.params.code;
          if (!code || !request.codeVerifier) return { type: 'error', error: 'missing_code' };
          return { type: 'code', code, codeVerifier: request.codeVerifier, redirectUri };
        }
        const accessToken = result.params.access_token;
        if (!accessToken) return { type: 'error', error: 'missing_token' };
        const expiresIn = Number(result.params.expires_in);
        return { type: 'token', accessToken, expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : null, scope: result.params.scope ?? null };
      }
      if (result.type === 'error') {
        return { type: 'error', error: result.params?.error ?? result.error?.code ?? 'unknown', description: result.params?.error_description ?? null };
      }
      if (result.type === 'locked') return { type: 'error', error: 'locked' };
      return { type: 'cancel' };
    },
  };
}
