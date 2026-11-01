/**
 * Google OAuth for Serie — pure logic (no React, no Expo).
 *
 * Flow (iOS, installed app, RFC 8252):
 *   authorization code + PKCE (S256) in ASWebAuthenticationSession, iOS OAuth
 *   client id, redirect to the reversed client id scheme
 *   (`com.googleusercontent.apps.<id>:/oauthredirect`), code exchange at the
 *   token endpoint without a client secret, refresh tokens kept in the Keychain
 *   (expo-secure-store), revocation on disconnect.
 * Web (verification only): implicit token flow with the web client id; no
 *   refresh token, tokens kept in memory only.
 *
 * The interactive browser step and the secure storage are injected
 * (`InteractiveAuthorizer`, `TokenStore`) — see `expoAdapters.ts` for the
 * expo-auth-session / expo-secure-store implementations.
 *
 * Scopes are requested per workflow: read (import, inspection, duplicate
 * checks) → calendar.readonly; write → + calendar.events. Google does not
 * support `include_granted_scopes` for installed apps, so an upgrade requests
 * the explicit union of what was already granted and what is needed now.
 * Granular consent is honoured: the granted scopes returned by Google decide
 * canRead / canWrite (events-only consent → `write_only`).
 */
import type { Connection } from '../types';
import { ProviderError } from '../types';
import { GOOGLE_STRINGS as S } from './strings';

// ─── constants ───────────────────────────────────────────────────────────────

export const GOOGLE_SCOPES = {
  /** Read events & calendar list: import, inspection, duplicate checks. */
  read: 'https://www.googleapis.com/auth/calendar.readonly',
  /** Create/update events (export). */
  write: 'https://www.googleapis.com/auth/calendar.events',
  /** Full calendar scope — never requested, but honoured if already granted. */
  full: 'https://www.googleapis.com/auth/calendar',
} as const;

/** Identity scopes, used only to read the account email (accountId). */
export const GOOGLE_IDENTITY_SCOPES = ['openid', 'email'] as const;

export const GOOGLE_OAUTH_ENDPOINTS = {
  authorization: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  revocation: 'https://oauth2.googleapis.com/revoke',
  userInfo: 'https://openidconnect.googleapis.com/v1/userinfo',
} as const;

/** Path appended to the reversed client id scheme for the native redirect. */
export const NATIVE_REDIRECT_PATH = 'oauthredirect';

/** Refresh a little before Google's expiry to absorb clock skew and request latency. */
export const TOKEN_EXPIRY_SKEW_MS = 2 * 60 * 1000;

/** Bound for each OAuth request (token, userinfo, revoke), including reading the body. */
export const AUTH_REQUEST_TIMEOUT_MS = 30_000;

// ─── configuration ───────────────────────────────────────────────────────────

export interface GoogleEnv {
  iosClientId: string | undefined;
  webClientId: string | undefined;
}

/**
 * Client ids from the build environment. `EXPO_PUBLIC_*` values are inlined
 * at build time only when read with static dot notation, so keep it that way.
 * Client ids identify the app; they are not secrets.
 */
export function readGoogleEnv(): GoogleEnv {
  const ios = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const web = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  return { iosClientId: ios?.trim() || undefined, webClientId: web?.trim() || undefined };
}

export type GoogleFlow = 'code_pkce' | 'implicit';

export type ClientResolution =
  | {
      ok: true;
      platform: 'ios' | 'web';
      clientId: string;
      flow: GoogleFlow;
      /** Native redirect (reversed client id scheme); null on web (derived from the page origin). */
      redirectUri: string | null;
    }
  | { ok: false; status: 'not_configured' | 'unavailable'; detail: string };

const CLIENT_ID_RE = /^([A-Za-z0-9-]+)\.apps\.googleusercontent\.com$/;

export const isGoogleClientId = (id: string | undefined | null): id is string => !!id && CLIENT_ID_RE.test(id);

/** `123-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.123-abc` (iOS URL scheme). */
export function reversedClientId(clientId: string): string {
  const m = CLIENT_ID_RE.exec(clientId);
  if (!m) throw new Error('Invalid Google client id');
  return `com.googleusercontent.apps.${m[1]}`;
}

export function nativeRedirectUri(clientId: string): string {
  return `${reversedClientId(clientId)}:/${NATIVE_REDIRECT_PATH}`;
}

/**
 * Decide whether Google Calendar can run in this build.
 * iOS: needs EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID and a development/production build (not Expo Go).
 * Web: needs EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Other platforms: unavailable.
 */
export function resolveGoogleClient(platform: string, env: GoogleEnv, opts: { isExpoGo?: boolean } = {}): ClientResolution {
  if (platform === 'ios') {
    if (opts.isExpoGo) return { ok: false, status: 'unavailable', detail: S.expoGo };
    if (!env.iosClientId) return { ok: false, status: 'not_configured', detail: S.notConfigured };
    if (!isGoogleClientId(env.iosClientId)) return { ok: false, status: 'not_configured', detail: S.invalidClientId };
    return { ok: true, platform: 'ios', clientId: env.iosClientId, flow: 'code_pkce', redirectUri: nativeRedirectUri(env.iosClientId) };
  }
  if (platform === 'web') {
    if (!env.webClientId) return { ok: false, status: 'not_configured', detail: S.notConfigured };
    if (!isGoogleClientId(env.webClientId)) return { ok: false, status: 'not_configured', detail: S.invalidClientId };
    return { ok: true, platform: 'web', clientId: env.webClientId, flow: 'implicit', redirectUri: null };
  }
  return { ok: false, status: 'unavailable', detail: S.unavailablePlatform };
}

// ─── scopes ──────────────────────────────────────────────────────────────────

export type GoogleAccess = 'read' | 'readwrite';

export function scopesFor(access: GoogleAccess): string[] {
  return access === 'read' ? [GOOGLE_SCOPES.read] : [GOOGLE_SCOPES.read, GOOGLE_SCOPES.write];
}

const CALENDAR_SCOPE_SET = new Set<string>([GOOGLE_SCOPES.read, GOOGLE_SCOPES.write, GOOGLE_SCOPES.full]);

export function parseScopes(scope: string | null | undefined): string[] | null {
  if (scope == null) return null;
  const list = scope.split(/[\s,]+/).filter(Boolean);
  return list.length ? [...new Set(list)] : null;
}

export function scopeCapabilities(scopes: readonly string[]): { canRead: boolean; canWrite: boolean } {
  const has = (s: string) => scopes.includes(s);
  return {
    canRead: has(GOOGLE_SCOPES.read) || has(GOOGLE_SCOPES.full),
    canWrite: has(GOOGLE_SCOPES.write) || has(GOOGLE_SCOPES.full),
  };
}

const covers = (granted: readonly string[], wanted: readonly string[]) => {
  const caps = scopeCapabilities(granted);
  return wanted.every((w) => (w === GOOGLE_SCOPES.read ? caps.canRead : w === GOOGLE_SCOPES.write ? caps.canWrite : granted.includes(w)));
};

// ─── token storage ───────────────────────────────────────────────────────────

/** Opaque persistent slot for the serialized credentials (Keychain on iOS, memory on web). */
export interface TokenStore {
  load(): Promise<string | null>;
  save(value: string): Promise<void>;
  clear(): Promise<void>;
}

/** In-memory store (web, tests). Never persists to plain storage. */
export class MemoryTokenStore implements TokenStore {
  constructor(private value: string | null = null) {}
  async load() {
    return this.value;
  }
  async save(v: string) {
    this.value = v;
  }
  async clear() {
    this.value = null;
  }
  /** Test helper. */
  peek() {
    return this.value;
  }
}

export interface StoredGoogleTokens {
  v: 1;
  /** Client id the tokens were issued to; a different build/client invalidates them. */
  clientId: string;
  accountId: string;
  accessToken: string;
  /** Epoch ms; null when Google did not say (treated as non-expiring until a 401). */
  expiresAt: number | null;
  refreshToken: string | null;
  scopes: string[];
}

export function parseStoredTokens(raw: string | null): StoredGoogleTokens | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<StoredGoogleTokens>;
    if (o?.v !== 1 || typeof o.clientId !== 'string' || typeof o.accountId !== 'string' || typeof o.accessToken !== 'string') return null;
    return {
      v: 1,
      clientId: o.clientId,
      accountId: o.accountId,
      accessToken: o.accessToken,
      expiresAt: typeof o.expiresAt === 'number' && Number.isFinite(o.expiresAt) ? o.expiresAt : null,
      refreshToken: typeof o.refreshToken === 'string' && o.refreshToken ? o.refreshToken : null,
      scopes: Array.isArray(o.scopes) ? o.scopes.filter((s): s is string => typeof s === 'string') : [],
    };
  } catch {
    return null;
  }
}

// ─── interactive authorization (injected) ────────────────────────────────────

export interface AuthorizationRequest {
  clientId: string;
  scopes: string[];
  flow: GoogleFlow;
  /** Native redirect; null → the adapter derives it (web origin). */
  redirectUri: string | null;
  /** Pre-select the already connected account when upgrading scopes. */
  loginHint: string | null;
}

export type AuthorizationOutcome =
  | { type: 'code'; code: string; codeVerifier: string; redirectUri: string }
  | { type: 'token'; accessToken: string; expiresIn: number | null; scope: string | null }
  | { type: 'cancel' }
  | { type: 'error'; error: string; description?: string | null };

export interface InteractiveAuthorizer {
  authorize(req: AuthorizationRequest): Promise<AuthorizationOutcome>;
}

// ─── GoogleAuth ──────────────────────────────────────────────────────────────

export interface GoogleAuthDeps {
  client: ClientResolution;
  store: TokenStore;
  /** null when the platform cannot run the interactive flow. */
  authorizer: InteractiveAuthorizer | null;
  /** Defaults to the global fetch, resolved at call time. */
  fetch?: typeof fetch;
  now?: () => number;
  /** Per-request timeout for the OAuth endpoints. Default AUTH_REQUEST_TIMEOUT_MS. */
  timeoutMs?: number;
}

interface TokenEndpointResponse {
  access_token?: string;
  expires_in?: number | string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

const formBody = (fields: Record<string, string>) =>
  Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

function parseJson<T>(text: string): T | null {
  try {
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

const isAbortError = (e: unknown) => typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError';

export class GoogleAuth {
  private cache: StoredGoogleTokens | null | undefined = undefined;
  private refreshing: Promise<StoredGoogleTokens> | null = null;
  /**
   * Bumped whenever connect/disconnect replaces the credentials. A refresh that
   * started under an older generation must neither write its result back (it
   * would resurrect credentials after a disconnect, or overwrite a newer grant)
   * nor delete the newer credentials when it fails.
   */
  private generation = 0;
  /** Transient explanation for the current non-connected state (e.g. revoked during this run). */
  private note: string | null = null;

  constructor(private readonly deps: GoogleAuthDeps) {}

  get client(): ClientResolution {
    return this.deps.client;
  }

  private get fetchFn(): typeof fetch {
    return this.deps.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  private now() {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  /**
   * Run one OAuth exchange (request and body) under a timeout. A stalled refresh
   * would otherwise block every API call sharing it, background export included.
   */
  private async timed<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.deps.timeoutMs ?? AUTH_REQUEST_TIMEOUT_MS);
    try {
      return await run(ctrl.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  private async load(): Promise<StoredGoogleTokens | null> {
    if (this.cache !== undefined) return this.cache;
    let raw: string | null = null;
    try {
      raw = await this.deps.store.load();
    } catch {
      // Keychain temporarily unreadable (e.g. before the first unlock): report no
      // credentials now, but do not cache that, so the next call reads it again.
      return null;
    }
    const t = parseStoredTokens(raw);
    this.cache = t && this.deps.client.ok && t.clientId === this.deps.client.clientId ? t : null;
    return this.cache;
  }

  private async persist(t: StoredGoogleTokens | null) {
    this.cache = t;
    if (t) await this.deps.store.save(JSON.stringify(t));
    else await this.deps.store.clear();
  }

  /** New credentials from connect/disconnect: invalidates any refresh still in flight. */
  private async replaceCredentials(t: StoredGoogleTokens | null) {
    this.generation++;
    this.refreshing = null;
    await this.persist(t);
  }

  /** Best-effort revocation of a token at Google. */
  private async revoke(token: string): Promise<boolean> {
    try {
      return await this.timed(async (signal) => {
        const res = await this.fetchFn(GOOGLE_OAUTH_ENDPOINTS.revocation, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formBody({ token }),
          signal,
        });
        return res.ok;
      });
    } catch {
      return false;
    }
  }

  private usable(t: StoredGoogleTokens): boolean {
    return !!t.refreshToken || t.expiresAt == null || t.expiresAt - this.now() > TOKEN_EXPIRY_SKEW_MS;
  }

  private base(status: Connection['status'], detail: string | null): Connection {
    return { provider: 'google', status, accountId: null, accountLabel: null, canRead: false, canWrite: false, detail };
  }

  private connectionFrom(t: StoredGoogleTokens | null): Connection {
    const client = this.deps.client;
    if (!client.ok) return this.base(client.status, client.detail);
    if (!t) return this.base('disconnected', this.note ?? S.disconnected);
    if (!this.usable(t)) return this.base('disconnected', S.sessionExpired);
    const caps = scopeCapabilities(t.scopes);
    const status: Connection['status'] = caps.canRead ? 'connected' : caps.canWrite ? 'write_only' : 'denied';
    return {
      provider: 'google',
      status,
      accountId: t.accountId,
      accountLabel: t.accountId,
      canRead: caps.canRead,
      canWrite: caps.canWrite,
      detail: status === 'write_only' ? S.writeOnly : status === 'denied' ? S.scopesMissing : null,
    };
  }

  /** Current connection from stored credentials (no network, no prompt). */
  async getConnection(): Promise<Connection> {
    return this.connectionFrom(await this.load());
  }

  /** Granted scopes of the stored credentials. */
  async grantedScopes(): Promise<string[]> {
    return (await this.load())?.scopes ?? [];
  }

  /**
   * Interactive consent. Requests only what the workflow needs, plus what is
   * already granted (so upgrading to write keeps read). No prompt when the
   * stored grant already covers the request.
   */
  async connect(access: GoogleAccess): Promise<Connection> {
    const client = this.deps.client;
    if (!client.ok) return this.base(client.status, client.detail);
    if (!this.deps.authorizer) return this.base('unavailable', S.unavailablePlatform);

    const current = await this.load();
    const wanted = scopesFor(access);
    if (current && this.usable(current) && covers(current.scopes, wanted)) return this.connectionFrom(current);

    const already = current ? current.scopes.filter((s) => CALENDAR_SCOPE_SET.has(s)) : [];
    const requested = [...new Set<string>([...GOOGLE_IDENTITY_SCOPES, ...already, ...wanted])];
    let outcome: AuthorizationOutcome;
    try {
      outcome = await this.deps.authorizer.authorize({
        clientId: client.clientId,
        scopes: requested,
        flow: client.flow,
        redirectUri: client.redirectUri,
        loginHint: current?.accountId ?? null,
      });
    } catch {
      // e.g. the redirect URL scheme is not registered in this build.
      const c = this.connectionFrom(current);
      return c.status === 'connected' || c.status === 'write_only' ? c : { ...c, detail: S.authorizeFailed };
    }

    if (outcome.type === 'cancel') {
      const c = this.connectionFrom(current);
      return c.status === 'connected' || c.status === 'write_only' ? c : { ...c, detail: S.cancelled };
    }
    if (outcome.type === 'error') {
      const c = this.connectionFrom(current);
      if (c.status === 'connected' || c.status === 'write_only') return c;
      if (outcome.error === 'access_denied') return this.base('denied', S.denied);
      return { ...c, detail: S.oauthError(outcome.error) };
    }

    let tokens: { accessToken: string; expiresIn: number | null; refreshToken: string | null; scope: string | null };
    if (outcome.type === 'code') {
      const r = await this.tokenRequest({
        grant_type: 'authorization_code',
        code: outcome.code,
        client_id: client.clientId,
        redirect_uri: outcome.redirectUri,
        code_verifier: outcome.codeVerifier,
      });
      tokens = { accessToken: r.access_token!, expiresIn: toSeconds(r.expires_in), refreshToken: r.refresh_token ?? null, scope: r.scope ?? null };
    } else {
      tokens = { accessToken: outcome.accessToken, expiresIn: outcome.expiresIn, refreshToken: null, scope: outcome.scope };
    }

    const accountId = await this.fetchAccountEmail(tokens.accessToken);
    if (!accountId) {
      // Nothing is stored, so do not leave a live grant behind at Google either.
      await this.revoke(tokens.refreshToken ?? tokens.accessToken);
      throw new ProviderError('unavailable', S.noAccount);
    }

    const granted = parseScopes(tokens.scope) ?? requested;
    const sameAccount = current && current.accountId === accountId;
    const stored: StoredGoogleTokens = {
      v: 1,
      clientId: client.clientId,
      accountId,
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresIn != null ? this.now() + tokens.expiresIn * 1000 : null,
      // Google may omit the refresh token on re-consent; keep the previous one for the same account.
      refreshToken: tokens.refreshToken ?? (sameAccount ? current!.refreshToken : null),
      scopes: granted,
    };
    await this.replaceCredentials(stored);
    this.note = null;
    return this.connectionFrom(stored);
  }

  /**
   * Revoke the grant at Google (best effort) and delete local credentials.
   * Local credentials are deleted even when revocation cannot reach Google.
   */
  async disconnect(): Promise<{ revoked: boolean }> {
    const t = await this.load();
    // Invalidate first: a refresh completing during the revocation request must not write tokens
    // back, and no caller may pick up these credentials any more.
    this.generation++;
    this.refreshing = null;
    this.cache = null;
    const revoked = t ? await this.revoke(t.refreshToken ?? t.accessToken) : false;
    this.note = null;
    await this.replaceCredentials(null);
    return { revoked };
  }

  /**
   * A valid access token, refreshing when expired. `forceRefresh` is used after
   * a 401; pass the token that was rejected so concurrent callers share one refresh.
   */
  async getAccessToken(opts: { forceRefresh?: boolean; rejectedToken?: string } = {}): Promise<string> {
    const client = this.deps.client;
    if (!client.ok) throw new ProviderError('unavailable', client.detail);
    const t = await this.load();
    if (!t) throw new ProviderError('unauthorized', this.note ?? S.unauthorized);
    if (opts.forceRefresh && opts.rejectedToken && t.accessToken !== opts.rejectedToken) return t.accessToken;
    const fresh = t.expiresAt == null || t.expiresAt - this.now() > TOKEN_EXPIRY_SKEW_MS;
    if (!opts.forceRefresh && fresh) return t.accessToken;
    if (!t.refreshToken) throw new ProviderError('unauthorized', S.sessionExpired);
    return (await this.refresh(t)).accessToken;
  }

  private refresh(t: StoredGoogleTokens): Promise<StoredGoogleTokens> {
    if (this.refreshing) return this.refreshing;
    const gen = this.generation;
    /** Credentials were replaced (connect/disconnect) while this refresh was in flight. */
    const superseded = (): StoredGoogleTokens => {
      if (this.cache) return this.cache;
      throw new ProviderError('unauthorized', this.note ?? S.unauthorized);
    };
    const run = (async () => {
      const client = this.deps.client;
      if (!client.ok) throw new ProviderError('unavailable', client.detail);
      let r: TokenEndpointResponse;
      try {
        r = await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refreshToken!, client_id: client.clientId });
      } catch (e) {
        if (gen !== this.generation) return superseded();
        if (e instanceof ProviderError && e.code === 'unauthorized') {
          // Refresh token revoked/expired: credentials are dead, the user must reconnect.
          this.note = S.revoked;
          await this.persist(null);
        }
        throw e;
      }
      if (gen !== this.generation) return superseded();
      const expiresIn = toSeconds(r.expires_in);
      const next: StoredGoogleTokens = {
        ...t,
        accessToken: r.access_token!,
        expiresAt: expiresIn != null ? this.now() + expiresIn * 1000 : null,
        refreshToken: r.refresh_token ?? t.refreshToken,
        scopes: parseScopes(r.scope) ?? t.scopes,
      };
      await this.persist(next);
      return next;
    })();
    this.refreshing = run;
    const clear = () => {
      if (this.refreshing === run) this.refreshing = null;
    };
    run.then(clear, clear);
    return run;
  }

  /** POST to the token endpoint (code exchange or refresh). No client secret: iOS clients have none. */
  private async tokenRequest(fields: Record<string, string>): Promise<TokenEndpointResponse> {
    let res: Response;
    let text: string;
    try {
      [res, text] = await this.timed(async (signal) => {
        const r = await this.fetchFn(GOOGLE_OAUTH_ENDPOINTS.token, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: formBody(fields),
          signal,
        });
        return [r, await r.text()] as const;
      });
    } catch (e) {
      // Timed out or the connection dropped (also while reading the body): retryable, never "invalid".
      throw isAbortError(e) ? new ProviderError('unavailable', S.unavailable) : new ProviderError('offline', S.offline);
    }
    const body = parseJson<TokenEndpointResponse>(text);
    if (res.ok && body?.access_token) return body;
    if (res.status >= 500) throw new ProviderError('unavailable', S.unavailable);
    if (res.status === 429) throw new ProviderError('rate_limited', S.rateLimited);
    const code = body?.error ?? `http_${res.status}`;
    if (code === 'invalid_grant' || code === 'unauthorized_client' || code === 'invalid_client' || res.status === 401) {
      throw new ProviderError('unauthorized', fields.grant_type === 'refresh_token' ? S.revoked : S.oauthError(code));
    }
    throw new ProviderError('invalid', S.oauthError(code));
  }

  /** Account email for accountId: OpenID userinfo, falling back to the primary calendar id. */
  private async fetchAccountEmail(accessToken: string): Promise<string | null> {
    const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
    try {
      const info = await this.timed(async (signal) => {
        const res = await this.fetchFn(GOOGLE_OAUTH_ENDPOINTS.userInfo, { headers, signal });
        return res.ok ? readJson<{ email?: string }>(res) : null;
      });
      if (info?.email) return info.email.trim().toLowerCase();
    } catch {
      // fall through to the calendar list
    }
    try {
      const cal = await this.timed(async (signal) => {
        const res = await this.fetchFn('https://www.googleapis.com/calendar/v3/users/me/calendarList/primary', { headers, signal });
        return res.ok ? readJson<{ id?: string }>(res) : null;
      });
      if (cal?.id && cal.id.includes('@')) return cal.id.trim().toLowerCase();
    } catch {
      // no account available
    }
    return null;
  }
}

function toSeconds(v: number | string | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
