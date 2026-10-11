/**
 * expo-auth-session adapter, with `AuthRequest` replaced by a recorder so the
 * configuration handed to the installed SDK 57 package can be checked.
 */
import { ExecutionEnvironment } from 'expo-constants';

const mockCreated: { config: Record<string, unknown>; discovery: unknown }[] = [];
let mockNext: unknown = { type: 'cancel' };

jest.mock('expo-auth-session', () => {
  const actual = jest.requireActual('expo-auth-session');
  class RecordingAuthRequest {
    codeVerifier?: string;
    config: Record<string, unknown>;
    constructor(mockConfig: Record<string, unknown>) {
      this.config = mockConfig;
    }
    async promptAsync(discovery: unknown) {
      mockCreated.push({ config: this.config, discovery });
      if (this.config.usePKCE) this.codeVerifier = 'verifier-from-sdk';
      return mockNext;
    }
  }
  return {
    ...actual,
    AuthRequest: RecordingAuthRequest,
    // What makeRedirectUri returns in a 'storeClient' environment: an app-scheme URL Google would reject.
    makeRedirectUri: jest.fn(() => 'exp+serie://expo-development-client/'),
  };
});

// eslint-disable-next-line import/first
import * as AuthSession from 'expo-auth-session';
// eslint-disable-next-line import/first
import { createExpoAuthorizer, detectExpoGo, GOOGLE_DISCOVERY } from '@/calendar/google/expoAdapters';

const CLIENT = '1234-abc.apps.googleusercontent.com';
const REDIRECT = 'com.googleusercontent.apps.1234-abc:/oauthredirect';

beforeEach(() => {
  mockCreated.length = 0;
  mockNext = { type: 'cancel' };
});

describe('Expo Go detection', () => {
  it('a development build (storeClient without an Expo Go version) is not Expo Go', () => {
    expect(detectExpoGo({ executionEnvironment: ExecutionEnvironment.StoreClient, expoVersion: null, appOwnership: null })).toBe(false);
    expect(detectExpoGo({ executionEnvironment: ExecutionEnvironment.Bare, expoVersion: null, appOwnership: null })).toBe(false);
    expect(detectExpoGo({ executionEnvironment: ExecutionEnvironment.Standalone, expoVersion: null, appOwnership: null })).toBe(false);
  });

  it('Expo Go reports its own version or appOwnership "expo"', () => {
    expect(detectExpoGo({ executionEnvironment: ExecutionEnvironment.StoreClient, expoVersion: '57.0.0', appOwnership: null })).toBe(true);
    expect(detectExpoGo({ executionEnvironment: ExecutionEnvironment.StoreClient, expoVersion: null, appOwnership: 'expo' })).toBe(true);
  });
});

describe('createExpoAuthorizer', () => {
  const req = { clientId: CLIENT, scopes: ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly'], flow: 'code_pkce' as const, redirectUri: REDIRECT, loginHint: 'a@b.c' };

  it('code + PKCE S256 with the native redirect used verbatim (never makeRedirectUri’s substitute)', async () => {
    mockNext = { type: 'success', params: { code: 'the-code', state: 's' }, errorCode: null, authentication: null, url: '' };
    const out = await createExpoAuthorizer().authorize(req);
    expect(out).toEqual({ type: 'code', code: 'the-code', codeVerifier: 'verifier-from-sdk', redirectUri: REDIRECT });
    expect(mockCreated[0].config).toMatchObject({
      clientId: CLIENT,
      redirectUri: REDIRECT,
      scopes: req.scopes,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
      extraParams: { login_hint: 'a@b.c' },
    });
    expect(mockCreated[0].discovery).toBe(GOOGLE_DISCOVERY);
    expect(AuthSession.makeRedirectUri).not.toHaveBeenCalled();
  });

  it('web implicit flow derives the redirect from the page and returns the token', async () => {
    mockNext = { type: 'success', params: { access_token: 'tok', expires_in: '3599', scope: 'openid' }, errorCode: null, authentication: null, url: '' };
    const out = await createExpoAuthorizer().authorize({ ...req, flow: 'implicit', redirectUri: null, loginHint: null });
    expect(out).toEqual({ type: 'token', accessToken: 'tok', expiresIn: 3599, scope: 'openid' });
    expect(mockCreated[0].config).toMatchObject({ responseType: AuthSession.ResponseType.Token, usePKCE: false, extraParams: {}, redirectUri: 'exp+serie://expo-development-client/' });
  });

  it('maps error, locked, dismiss and a success without a code', async () => {
    const a = createExpoAuthorizer();
    mockNext = { type: 'error', params: { error: 'access_denied' }, errorCode: 'access_denied', authentication: null, url: '' };
    expect(await a.authorize(req)).toEqual({ type: 'error', error: 'access_denied', description: null });
    mockNext = { type: 'locked' };
    expect(await a.authorize(req)).toEqual({ type: 'error', error: 'locked' });
    mockNext = { type: 'dismiss' };
    expect(await a.authorize(req)).toEqual({ type: 'cancel' });
    mockNext = { type: 'success', params: {}, errorCode: null, authentication: null, url: '' };
    expect(await a.authorize(req)).toEqual({ type: 'error', error: 'missing_code' });
  });
});
