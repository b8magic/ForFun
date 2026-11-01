import {
  GOOGLE_OAUTH_ENDPOINTS,
  GOOGLE_SCOPES,
  GoogleAuth,
  MemoryTokenStore,
  nativeRedirectUri,
  parseStoredTokens,
  readGoogleEnv,
  resolveGoogleClient,
  reversedClientId,
  type AuthorizationOutcome,
  type AuthorizationRequest,
  type ClientResolution,
  type InteractiveAuthorizer,
} from '@/calendar/google/auth';
import { GOOGLE_STRINGS } from '@/calendar/google/strings';
import { GOOGLE_SETUP } from '@/calendar/google/setup';
import { ProviderError } from '@/calendar/types';
import { t } from '@/i18n/it';
import { installFetch, type Call } from './fetchMock';

const CLIENT = '1234-abc.apps.googleusercontent.com';
const ACCOUNT = 'surfer@example.com';
const IOS: ClientResolution = resolveGoogleClient('ios', { iosClientId: CLIENT, webClientId: undefined });

const realFetch = globalThis.fetch;
// Mutate keys in place: Expo's babel preset reads EXPO_PUBLIC_* through a reference to the original process.env object.
const ENV_KEYS = ['EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  (globalThis as { fetch: unknown }).fetch = realFetch;
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

function authorizer(...outcomes: AuthorizationOutcome[]) {
  const requests: AuthorizationRequest[] = [];
  const a: InteractiveAuthorizer = {
    authorize: jest.fn(async (req: AuthorizationRequest): Promise<AuthorizationOutcome> => {
      requests.push(req);
      return outcomes.shift() ?? { type: 'cancel' };
    }),
  };
  return { a, requests };
}

const code = (c = 'auth-code'): AuthorizationOutcome => ({ type: 'code', code: c, codeVerifier: 'verifier-xyz', redirectUri: nativeRedirectUri(CLIENT) });

/** Google endpoints: token (exchange/refresh), userinfo, revoke. */
function googleServer(opts: { scope?: string; refreshToken?: string | null; tokenStatus?: number; tokenError?: string; email?: string } = {}) {
  let n = 0;
  return installFetch((c: Call) => {
    if (c.url === GOOGLE_OAUTH_ENDPOINTS.token) {
      if (opts.tokenStatus) return { status: opts.tokenStatus, body: { error: opts.tokenError ?? 'server_error' } };
      n++;
      const isRefresh = c.form?.get('grant_type') === 'refresh_token';
      return {
        body: {
          access_token: `access-${n}`,
          expires_in: 3599,
          token_type: 'Bearer',
          scope: opts.scope ?? `openid https://www.googleapis.com/auth/userinfo.email ${GOOGLE_SCOPES.read}`,
          ...(isRefresh || opts.refreshToken === null ? {} : { refresh_token: opts.refreshToken ?? 'refresh-1' }),
        },
      };
    }
    if (c.url === GOOGLE_OAUTH_ENDPOINTS.userInfo) return { body: { sub: '1', email: opts.email ?? 'Surfer@Example.com', email_verified: true } };
    if (c.url === GOOGLE_OAUTH_ENDPOINTS.revocation) return { status: 200 };
    return { status: 404 };
  });
}

function stored(p: Partial<{ accessToken: string; expiresAt: number | null; refreshToken: string | null; scopes: string[]; clientId: string }> = {}) {
  return JSON.stringify({
    v: 1,
    clientId: p.clientId ?? CLIENT,
    accountId: ACCOUNT,
    accessToken: p.accessToken ?? 'access-0',
    expiresAt: p.expiresAt === undefined ? 1_000_000 + 3600_000 : p.expiresAt,
    refreshToken: p.refreshToken === undefined ? 'refresh-0' : p.refreshToken,
    scopes: p.scopes ?? ['openid', 'email', GOOGLE_SCOPES.read],
  });
}

const NOW = 1_000_000;

describe('configuration', () => {
  it('missing EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID → not_configured with an Italian detail, no prompt', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    const env = readGoogleEnv();
    expect(env).toEqual({ iosClientId: undefined, webClientId: undefined });
    const client = resolveGoogleClient('ios', env);
    expect(client).toEqual({ ok: false, status: 'not_configured', detail: t.notConfigured });

    const { a } = authorizer(code());
    const auth = new GoogleAuth({ client, store: new MemoryTokenStore(), authorizer: a });
    const c = await auth.getConnection();
    expect(c).toEqual({ provider: 'google', status: 'not_configured', accountId: null, accountLabel: null, canRead: false, canWrite: false, detail: t.notConfigured });
    expect((await auth.connect('read')).status).toBe('not_configured');
    expect(a.authorize).not.toHaveBeenCalled();
    await expect(auth.getAccessToken()).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('reads and trims the client ids from the environment', () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ` ${CLIENT} `;
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = '';
    expect(readGoogleEnv()).toEqual({ iosClientId: CLIENT, webClientId: undefined });
    expect(resolveGoogleClient('ios', readGoogleEnv())).toEqual({ ok: true, platform: 'ios', clientId: CLIENT, flow: 'code_pkce', redirectUri: 'com.googleusercontent.apps.1234-abc:/oauthredirect' });
  });

  it('reversed client id, malformed ids, web, other platforms, Expo Go', () => {
    expect(reversedClientId(CLIENT)).toBe('com.googleusercontent.apps.1234-abc');
    expect(resolveGoogleClient('ios', { iosClientId: 'not-a-client', webClientId: undefined })).toMatchObject({ ok: false, status: 'not_configured', detail: GOOGLE_STRINGS.invalidClientId });
    expect(resolveGoogleClient('web', { iosClientId: CLIENT, webClientId: undefined })).toMatchObject({ ok: false, status: 'not_configured' });
    expect(resolveGoogleClient('web', { iosClientId: undefined, webClientId: CLIENT })).toMatchObject({ ok: true, flow: 'implicit', redirectUri: null });
    expect(resolveGoogleClient('android', { iosClientId: CLIENT, webClientId: CLIENT })).toMatchObject({ ok: false, status: 'unavailable' });
    expect(resolveGoogleClient('ios', { iosClientId: CLIENT, webClientId: undefined }, { isExpoGo: true })).toMatchObject({ ok: false, status: 'unavailable', detail: GOOGLE_STRINGS.expoGo });
  });

  it('documents the Google Cloud setup', () => {
    expect(GOOGLE_SETUP).toContain('app.serie.ios');
    expect(GOOGLE_SETUP).toContain('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
    expect(GOOGLE_SETUP).toContain('com.googleusercontent.apps.');
  });
});

describe('connect', () => {
  it('read: PKCE code exchange without client secret, account email, Keychain-style storage', async () => {
    const { calls } = googleServer();
    const { a, requests } = authorizer(code());
    const store = new MemoryTokenStore();
    const auth = new GoogleAuth({ client: IOS, store, authorizer: a, now: () => NOW });

    const c = await auth.connect('read');
    expect(requests[0]).toEqual({
      clientId: CLIENT,
      scopes: ['openid', 'email', GOOGLE_SCOPES.read],
      flow: 'code_pkce',
      redirectUri: 'com.googleusercontent.apps.1234-abc:/oauthredirect',
      loginHint: null,
    });
    const exchange = calls.find((x) => x.url === GOOGLE_OAUTH_ENDPOINTS.token)!;
    expect(exchange.method).toBe('POST');
    expect(Object.fromEntries(exchange.form!)).toEqual({
      grant_type: 'authorization_code',
      code: 'auth-code',
      client_id: CLIENT,
      redirect_uri: 'com.googleusercontent.apps.1234-abc:/oauthredirect',
      code_verifier: 'verifier-xyz',
    });
    expect(c).toEqual({ provider: 'google', status: 'connected', accountId: ACCOUNT, accountLabel: ACCOUNT, canRead: true, canWrite: false, detail: null });

    const saved = parseStoredTokens(store.peek());
    expect(saved).toMatchObject({ accountId: ACCOUNT, accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: NOW + 3599_000 });
    expect(await auth.getAccessToken()).toBe('access-1');
  });

  it('readwrite later: requests the union, pre-selects the account, keeps the refresh token', async () => {
    googleServer({ scope: `openid email ${GOOGLE_SCOPES.read} ${GOOGLE_SCOPES.write}`, refreshToken: null });
    const { a, requests } = authorizer(code());
    const store = new MemoryTokenStore(stored());
    const auth = new GoogleAuth({ client: IOS, store, authorizer: a, now: () => NOW });

    const c = await auth.connect('readwrite');
    expect(requests[0].scopes).toEqual(['openid', 'email', GOOGLE_SCOPES.read, GOOGLE_SCOPES.write]);
    expect(requests[0].loginHint).toBe(ACCOUNT);
    expect(c).toMatchObject({ status: 'connected', canRead: true, canWrite: true });
    expect(parseStoredTokens(store.peek())?.refreshToken).toBe('refresh-0');
  });

  it('does not prompt when the stored grant already covers the request', async () => {
    const { a } = authorizer(code());
    const auth = new GoogleAuth({ client: IOS, store: new MemoryTokenStore(stored({ scopes: [GOOGLE_SCOPES.read, GOOGLE_SCOPES.write] })), authorizer: a, now: () => NOW });
    expect((await auth.connect('read')).status).toBe('connected');
    expect((await auth.connect('readwrite')).canWrite).toBe(true);
    expect(a.authorize).not.toHaveBeenCalled();
  });

  it('granular consent with only calendar.events → write_only (no reads)', async () => {
    googleServer({ scope: `openid email ${GOOGLE_SCOPES.write}` });
    const { a } = authorizer(code());
    const auth = new GoogleAuth({ client: IOS, store: new MemoryTokenStore(), authorizer: a, now: () => NOW });
    const c = await auth.connect('readwrite');
    expect(c).toMatchObject({ status: 'write_only', canRead: false, canWrite: true, detail: t.writeOnly });
  });

  it('cancel keeps the previous state; access_denied → denied', async () => {
    const { a } = authorizer({ type: 'cancel' }, { type: 'error', error: 'access_denied' }, { type: 'error', error: 'state_mismatch' });
    const auth = new GoogleAuth({ client: IOS, store: new MemoryTokenStore(), authorizer: a, now: () => NOW });
    expect(await auth.connect('read')).toMatchObject({ status: 'disconnected', detail: GOOGLE_STRINGS.cancelled });
    expect(await auth.connect('read')).toMatchObject({ status: 'denied', detail: GOOGLE_STRINGS.denied });
    expect(await auth.connect('read')).toMatchObject({ status: 'disconnected', detail: GOOGLE_STRINGS.oauthError('state_mismatch') });

    const { a: a2 } = authorizer({ type: 'cancel' });
    const connected = new GoogleAuth({ client: IOS, store: new MemoryTokenStore(stored()), authorizer: a2, now: () => NOW });
    expect(await connected.connect('readwrite')).toMatchObject({ status: 'connected', canWrite: false, detail: null });
  });

  it('an authorizer crash becomes an honest connection detail', async () => {
    const a: InteractiveAuthorizer = { authorize: jest.fn(async () => Promise.reject(new Error('scheme not registered'))) };
    const auth = new GoogleAuth({ client: IOS, store: new MemoryTokenStore(), authorizer: a, now: () => NOW });
    expect(await auth.connect('read')).toMatchObject({ status: 'disconnected', detail: GOOGLE_STRINGS.authorizeFailed });
  });

  it('no account email → error and nothing stored', async () => {
    installFetch((c) => (c.url === GOOGLE_OAUTH_ENDPOINTS.token ? { body: { access_token: 'x', expires_in: 3600, refresh_token: 'r', scope: GOOGLE_SCOPES.read } } : { status: 500 }));
    const { a } = authorizer(code());
    const store = new MemoryTokenStore();
    const auth = new GoogleAuth({ client: IOS, store, authorizer: a, now: () => NOW });
    await expect(auth.connect('read')).rejects.toMatchObject({ code: 'unavailable', message: GOOGLE_STRINGS.noAccount });
    expect(store.peek()).toBeNull();
  });

  it('web implicit flow: token kept in memory, expires without refresh', async () => {
    installFetch((c) => (c.url === GOOGLE_OAUTH_ENDPOINTS.userInfo ? { body: { email: ACCOUNT } } : { status: 404 }));
    let now = NOW;
    const web = resolveGoogleClient('web', { iosClientId: undefined, webClientId: CLIENT });
    const { a, requests } = authorizer({ type: 'token', accessToken: 'web-token', expiresIn: 3600, scope: GOOGLE_SCOPES.read });
    const auth = new GoogleAuth({ client: web, store: new MemoryTokenStore(), authorizer: a, now: () => now });
    expect((await auth.connect('read')).status).toBe('connected');
    expect(requests[0]).toMatchObject({ flow: 'implicit', redirectUri: null });
    now += 3600_000;
    expect(await auth.getConnection()).toMatchObject({ status: 'disconnected', detail: GOOGLE_STRINGS.sessionExpired });
    await expect(auth.getAccessToken()).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('credentials issued to another client id are ignored', async () => {
    const auth = new GoogleAuth({ client: IOS, store: new MemoryTokenStore(stored({ clientId: '999-zzz.apps.googleusercontent.com' })), authorizer: null, now: () => NOW });
    expect((await auth.getConnection()).status).toBe('disconnected');
  });
});

describe('tokens', () => {
  it('refreshes an expired access token once for concurrent callers', async () => {
    const { calls } = googleServer();
    const store = new MemoryTokenStore(stored({ expiresAt: NOW + 30_000 }));
    const auth = new GoogleAuth({ client: IOS, store, authorizer: null, now: () => NOW });
    const [x, y] = await Promise.all([auth.getAccessToken(), auth.getAccessToken()]);
    expect([x, y]).toEqual(['access-1', 'access-1']);
    const refreshes = calls.filter((c) => c.form?.get('grant_type') === 'refresh_token');
    expect(refreshes).toHaveLength(1);
    expect(Object.fromEntries(refreshes[0].form!)).toEqual({ grant_type: 'refresh_token', refresh_token: 'refresh-0', client_id: CLIENT });
    expect(parseStoredTokens(store.peek())).toMatchObject({ accessToken: 'access-1', refreshToken: 'refresh-0' });
  });

  it('a forced refresh is skipped when another caller already replaced the rejected token', async () => {
    const { calls } = googleServer();
    const auth = new GoogleAuth({ client: IOS, store: new MemoryTokenStore(stored()), authorizer: null, now: () => NOW });
    expect(await auth.getAccessToken({ forceRefresh: true, rejectedToken: 'stale' })).toBe('access-0');
    expect(calls).toHaveLength(0);
    expect(await auth.getAccessToken({ forceRefresh: true, rejectedToken: 'access-0' })).toBe('access-1');
  });

  it('invalid_grant deletes credentials and reports a revoked connection', async () => {
    googleServer({ tokenStatus: 400, tokenError: 'invalid_grant' });
    const store = new MemoryTokenStore(stored({ expiresAt: NOW - 1 }));
    const auth = new GoogleAuth({ client: IOS, store, authorizer: null, now: () => NOW });
    const e = await auth.getAccessToken().catch((x) => x);
    expect(e).toBeInstanceOf(ProviderError);
    expect(e.code).toBe('unauthorized');
    expect(store.peek()).toBeNull();
    expect(await auth.getConnection()).toMatchObject({ status: 'disconnected', detail: GOOGLE_STRINGS.revoked });
  });

  it('refresh while offline → offline, credentials kept', async () => {
    installFetch(() => 'network-error');
    const store = new MemoryTokenStore(stored({ expiresAt: NOW - 1 }));
    const auth = new GoogleAuth({ client: IOS, store, authorizer: null, now: () => NOW });
    await expect(auth.getAccessToken()).rejects.toMatchObject({ code: 'offline' });
    expect(parseStoredTokens(store.peek())?.refreshToken).toBe('refresh-0');
  });
});

describe('disconnect', () => {
  it('revokes the refresh token at Google and deletes local credentials', async () => {
    const { calls } = googleServer();
    const store = new MemoryTokenStore(stored());
    const auth = new GoogleAuth({ client: IOS, store, authorizer: null, now: () => NOW });
    expect(await auth.disconnect()).toEqual({ revoked: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(GOOGLE_OAUTH_ENDPOINTS.revocation);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].form?.get('token')).toBe('refresh-0');
    expect(store.peek()).toBeNull();
    expect((await auth.getConnection()).status).toBe('disconnected');
  });

  it('still deletes local credentials when Google cannot be reached', async () => {
    installFetch(() => 'network-error');
    const store = new MemoryTokenStore(stored());
    const auth = new GoogleAuth({ client: IOS, store, authorizer: null, now: () => NOW });
    expect(await auth.disconnect()).toEqual({ revoked: false });
    expect(store.peek()).toBeNull();
  });
});

describe('races and storage failures (regressions)', () => {
  /** Token endpoint that holds every refresh until `release()`; other endpoints answer at once. */
  function gatedServer(refreshReply: () => { status?: number; body: unknown }) {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fetch = installFetch(async (c) => {
      if (c.url === GOOGLE_OAUTH_ENDPOINTS.token && c.form?.get('grant_type') === 'refresh_token') {
        await gate;
        return refreshReply();
      }
      if (c.url === GOOGLE_OAUTH_ENDPOINTS.token) {
        return { body: { access_token: 'access-new', expires_in: 3599, refresh_token: 'refresh-new', scope: `openid email ${GOOGLE_SCOPES.read} ${GOOGLE_SCOPES.write}` } };
      }
      if (c.url === GOOGLE_OAUTH_ENDPOINTS.userInfo) return { body: { email: ACCOUNT } };
      return { status: 200 };
    });
    return { ...fetch, release };
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it('a refresh finishing after disconnect does not write the credentials back', async () => {
    const { release } = gatedServer(() => ({ body: { access_token: 'access-late', expires_in: 3599, scope: GOOGLE_SCOPES.read } }));
    const store = new MemoryTokenStore(stored({ expiresAt: NOW - 1 }));
    const auth = new GoogleAuth({ client: IOS, store, authorizer: null, now: () => NOW });
    const pending = auth.getAccessToken().then(
      (v) => ({ ok: true as const, v }),
      (e: ProviderError) => ({ ok: false as const, code: e.code }),
    );
    await tick();
    expect(await auth.disconnect()).toEqual({ revoked: true });
    release();
    expect(await pending).toEqual({ ok: false, code: 'unauthorized' });
    expect(store.peek()).toBeNull();
    expect((await auth.getConnection()).status).toBe('disconnected');
  });

  it('a refresh finishing after a scope upgrade does not overwrite the new grant', async () => {
    const { release } = gatedServer(() => ({ body: { access_token: 'access-late', expires_in: 3599, scope: GOOGLE_SCOPES.read } }));
    const store = new MemoryTokenStore(stored({ expiresAt: NOW - 1 }));
    const { a } = authorizer(code());
    const auth = new GoogleAuth({ client: IOS, store, authorizer: a, now: () => NOW });
    const pending = auth.getAccessToken();
    await tick();
    expect(await auth.connect('readwrite')).toMatchObject({ status: 'connected', canWrite: true });
    release();
    expect(await pending).toBe('access-new');
    expect(parseStoredTokens(store.peek())).toMatchObject({ accessToken: 'access-new', refreshToken: 'refresh-new', scopes: expect.arrayContaining([GOOGLE_SCOPES.write]) });
    expect((await auth.getConnection()).canWrite).toBe(true);
  });

  it('a stale refresh failing with invalid_grant does not delete newer credentials', async () => {
    const { release } = gatedServer(() => ({ status: 400, body: { error: 'invalid_grant' } }));
    const store = new MemoryTokenStore(stored({ expiresAt: NOW - 1 }));
    const { a } = authorizer(code());
    const auth = new GoogleAuth({ client: IOS, store, authorizer: a, now: () => NOW });
    const pending = auth.getAccessToken().catch((e) => e);
    await tick();
    await auth.connect('readwrite');
    release();
    expect(await pending).toBe('access-new');
    expect(parseStoredTokens(store.peek())?.refreshToken).toBe('refresh-new');
    expect((await auth.getConnection()).status).toBe('connected');
  });

  it('a Keychain read failure is not cached as "disconnected" for the rest of the run', async () => {
    let locked = true;
    const inner = new MemoryTokenStore(stored());
    const store = {
      load: async () => {
        if (locked) throw new Error('errSecInteractionNotAllowed');
        return inner.load();
      },
      save: (v: string) => inner.save(v),
      clear: () => inner.clear(),
    };
    const auth = new GoogleAuth({ client: IOS, store, authorizer: null, now: () => NOW });
    expect((await auth.getConnection()).status).toBe('disconnected');
    locked = false;
    expect(await auth.getConnection()).toMatchObject({ status: 'connected', accountId: ACCOUNT });
  });

  it('when the account email cannot be read, the fresh grant is revoked (nothing left behind)', async () => {
    const { calls } = installFetch((c) =>
      c.url === GOOGLE_OAUTH_ENDPOINTS.token
        ? { body: { access_token: 'x', expires_in: 3600, refresh_token: 'r-orphan', scope: GOOGLE_SCOPES.read } }
        : c.url === GOOGLE_OAUTH_ENDPOINTS.revocation
          ? { status: 200 }
          : { status: 500 },
    );
    const { a } = authorizer(code());
    const store = new MemoryTokenStore();
    const auth = new GoogleAuth({ client: IOS, store, authorizer: a, now: () => NOW });
    await expect(auth.connect('read')).rejects.toMatchObject({ code: 'unavailable' });
    const revoke = calls.find((c) => c.url === GOOGLE_OAUTH_ENDPOINTS.revocation);
    expect(revoke?.form?.get('token')).toBe('r-orphan');
    expect(store.peek()).toBeNull();
  });

  it('a stalled token refresh times out as unavailable (retryable) and keeps the credentials', async () => {
    installFetch(() => 'hang');
    const store = new MemoryTokenStore(stored({ expiresAt: NOW - 1 }));
    const auth = new GoogleAuth({ client: IOS, store, authorizer: null, now: () => NOW, timeoutMs: 20 });
    const e = await auth.getAccessToken().catch((x) => x);
    expect(e).toBeInstanceOf(ProviderError);
    expect(e.code).toBe('unavailable');
    expect(e.retryable).toBe(true);
    expect(parseStoredTokens(store.peek())?.refreshToken).toBe('refresh-0');
  });

  it('a token response whose body is lost is retryable (offline), not "invalid"', async () => {
    installFetch(() => ({ status: 200, bodyFails: true }));
    const auth = new GoogleAuth({ client: IOS, store: new MemoryTokenStore(stored({ expiresAt: NOW - 1 })), authorizer: null, now: () => NOW });
    await expect(auth.getAccessToken()).rejects.toMatchObject({ code: 'offline' });
  });

  it('a stalled revocation does not block disconnect; local credentials are still deleted', async () => {
    installFetch(() => 'hang');
    const store = new MemoryTokenStore(stored());
    const auth = new GoogleAuth({ client: IOS, store, authorizer: null, now: () => NOW, timeoutMs: 20 });
    expect(await auth.disconnect()).toEqual({ revoked: false });
    expect(store.peek()).toBeNull();
  });
});
