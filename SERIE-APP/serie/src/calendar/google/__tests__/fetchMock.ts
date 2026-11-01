/** Minimal global-fetch mock for the Google provider tests (not a test file itself). */

export interface FakeReply {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  /** Make `text()` reject (connection dropped while reading the body). */
  bodyFails?: boolean;
}

export interface Call {
  url: string;
  method: string;
  path: string;
  params: URLSearchParams;
  headers: Record<string, string>;
  body: string | undefined;
  json: any;
  form: URLSearchParams | null;
}

export type Handler = (call: Call, init: RequestInit) => FakeReply | Promise<FakeReply> | 'network-error' | 'hang';

export function fakeResponse(r: FakeReply): Response {
  const status = r.status ?? 200;
  const headers = Object.fromEntries(Object.entries(r.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    text: async () => {
      if (r.bodyFails) throw new TypeError('Network request failed');
      return r.body === undefined ? '' : typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    },
  } as unknown as Response;
}

export function installFetch(handler: Handler) {
  const calls: Call[] = [];
  const mock = jest.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const u = new URL(url);
    const headers = { ...((init.headers as Record<string, string>) ?? {}) };
    const body = typeof init.body === 'string' ? init.body : undefined;
    let json: any = null;
    let form: URLSearchParams | null = null;
    if (body) {
      if ((headers['Content-Type'] ?? '').includes('json')) json = JSON.parse(body);
      else form = new URLSearchParams(body);
    }
    const call: Call = { url, method: init.method ?? 'GET', path: u.pathname, params: u.searchParams, headers, body, json, form };
    calls.push(call);
    const reply = await handler(call, init);
    if (reply === 'network-error') throw new TypeError('Network request failed');
    if (reply === 'hang') {
      return new Promise<Response>((_, reject) => {
        init.signal?.addEventListener('abort', () => {
          const e = new Error('Aborted');
          e.name = 'AbortError';
          reject(e);
        });
      });
    }
    return fakeResponse(reply);
  });
  (globalThis as { fetch: unknown }).fetch = mock;
  return { mock, calls };
}

export const googleError = (code: number, reason: string, message = reason) => ({
  error: { code, message, errors: [{ domain: 'usageLimits', reason, message }] },
});
