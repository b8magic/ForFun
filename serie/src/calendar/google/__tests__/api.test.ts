import {
  GoogleCalendarApi,
  backoffDelay,
  buildQuery,
  chunkWindow,
  parseRetryAfter,
  yearChunks,
  type GCalEventBody,
  type GoogleApiOptions,
} from '@/calendar/google/api';
import { ProviderError } from '@/calendar/types';
import { googleError, installFetch } from './fetchMock';

const realFetch = globalThis.fetch;
afterEach(() => {
  (globalThis as { fetch: unknown }).fetch = realFetch;
});

function mkApi(opts: Partial<GoogleApiOptions> = {}) {
  const sleeps: number[] = [];
  let current = 'tok-1';
  const getAccessToken = jest.fn(async (o: { forceRefresh?: boolean; rejectedToken?: string }) => {
    if (o.forceRefresh) current = 'tok-2';
    return current;
  });
  const api = new GoogleCalendarApi({
    getAccessToken,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    random: () => 0.5,
    ...opts,
  });
  return { api, sleeps, getAccessToken };
}

const body: GCalEventBody = {
  summary: 'Surf',
  start: { date: '2026-10-10' },
  end: { date: '2026-10-11' },
  reminders: { useDefault: false, overrides: [] },
  extendedProperties: { private: { serie_v: '1' } },
};

async function rejection(p: Promise<unknown>): Promise<ProviderError> {
  try {
    await p;
  } catch (e) {
    return e as ProviderError;
  }
  throw new Error('expected a rejection');
}

describe('range helpers', () => {
  it('splits a multi-year range into calendar-year chunks', () => {
    expect(yearChunks('2022-03-15', '2024-06-30')).toEqual([
      { from: '2022-03-15', to: '2022-12-31' },
      { from: '2023-01-01', to: '2023-12-31' },
      { from: '2024-01-01', to: '2024-06-30' },
    ]);
    expect(yearChunks('2026-10-10', '2026-10-10')).toEqual([{ from: '2026-10-10', to: '2026-10-10' }]);
    expect(yearChunks('2026-10-11', '2026-10-10')).toEqual([]);
  });

  it('widens each chunk to cover every zone (UTC+14 … UTC−12)', () => {
    expect(chunkWindow({ from: '2023-01-01', to: '2023-12-31' })).toEqual({ timeMin: '2023-01-01T00:00:00+14:00', timeMax: '2024-01-01T00:00:00-12:00' });
  });

  it('encodes query values and repeats array parameters', () => {
    expect(buildQuery({ a: 'x y', b: undefined, c: ['k=v', 'z'], d: true })).toBe('?a=x%20y&c=k%3Dv&c=z&d=true');
  });

  it('parses Retry-After seconds and HTTP dates', () => {
    expect(parseRetryAfter('3', 0)).toBe(3000);
    expect(parseRetryAfter('Wed, 21 Oct 2026 07:28:10 GMT', Date.parse('Wed, 21 Oct 2026 07:28:00 GMT'))).toBe(10000);
    expect(parseRetryAfter(null, 0)).toBeNull();
    expect(parseRetryAfter('soon', 0)).toBeNull();
  });

  it('backoff grows exponentially, is jittered and bounded', () => {
    expect([0, 1, 2, 3].map((a) => backoffDelay(a, 500, 20000, () => 1))).toEqual([500, 1000, 2000, 4000]);
    expect(backoffDelay(10, 500, 20000, () => 1)).toBe(20000);
    expect(backoffDelay(3, 500, 20000, () => 0.25)).toBe(1000);
  });
});

describe('events.list: complete retrieval', () => {
  it('fetches every page of every year chunk of a 3-year range', async () => {
    const { calls } = installFetch((c) => {
      const year = c.params.get('timeMin')!.slice(0, 4);
      const tok = c.params.get('pageToken');
      const page = tok ? Number(tok.split('-p')[1]) : 1;
      return {
        body: {
          timeZone: 'Europe/Rome',
          items: [{ id: `${year}-${page}`, start: { date: `${year}-06-0${page}` }, end: { date: `${year}-06-0${page + 1}` } }],
          nextPageToken: page < 3 ? `${year}-p${page + 1}` : undefined,
        },
      };
    });
    const { api } = mkApi();
    const pages: number[] = [];
    const r = await api.listEventsRange('primary', { from: '2022-03-15', to: '2024-06-30', onPage: (n) => pages.push(n) });

    expect(r.items.map((e) => e.id)).toEqual(['2022-1', '2022-2', '2022-3', '2023-1', '2023-2', '2023-3', '2024-1', '2024-2', '2024-3']);
    expect(r.timeZone).toBe('Europe/Rome');
    expect(calls).toHaveLength(9);
    expect(pages).toHaveLength(9);
    expect([...new Set(calls.map((c) => c.params.get('timeMin')))]).toEqual(['2022-03-15T00:00:00+14:00', '2023-01-01T00:00:00+14:00', '2024-01-01T00:00:00+14:00']);
    for (const c of calls) {
      expect(c.path).toBe('/calendar/v3/calendars/primary/events');
      expect(c.params.get('singleEvents')).toBe('true');
      expect(c.params.get('orderBy')).toBe('startTime');
      expect(c.params.get('maxResults')).toBe('2500');
      expect(c.params.has('showDeleted')).toBe(false);
      expect(c.headers.Authorization).toBe('Bearer tok-1');
    }
  });

  it('de-duplicates an event returned by two overlapping chunks', async () => {
    installFetch(() => ({ body: { items: [{ id: 'nye', start: { dateTime: '2023-12-31T23:30:00Z' }, end: { dateTime: '2024-01-01T00:30:00Z' } }] } }));
    const { api } = mkApi();
    const r = await api.listEventsRange('primary', { from: '2023-12-01', to: '2024-01-31' });
    expect(r.items.map((e) => e.id)).toEqual(['nye']);
  });

  it('passes showDeleted and an encoded privateExtendedProperty filter', async () => {
    const { calls } = installFetch(() => ({ body: { items: [] } }));
    const { api } = mkApi();
    await api.listEventsRange('a b@group.calendar.google.com', { from: '2026-01-01', to: '2026-01-31', showDeleted: true, privateExtendedProperty: ['serie_op=op 1/=x'] });
    expect(calls[0].url).toContain('/calendars/a%20b%40group.calendar.google.com/events?');
    expect(calls[0].url).toContain('privateExtendedProperty=serie_op%3Dop%201%2F%3Dx');
    expect(calls[0].params.get('showDeleted')).toBe('true');
  });

  it('paginates the calendar list', async () => {
    const { calls } = installFetch((c) =>
      c.params.get('pageToken')
        ? { body: { items: [{ id: 'b', accessRole: 'reader' }, { id: 'gone', deleted: true }] } }
        : { body: { items: [{ id: 'a', accessRole: 'owner' }], nextPageToken: 'n2' } },
    );
    const { api } = mkApi();
    expect((await api.listCalendars()).map((c) => c.id)).toEqual(['a', 'b']);
    expect(calls[0].params.get('maxResults')).toBe('250');
  });

  it('stops when the provider repeats a page token instead of looping forever', async () => {
    installFetch(() => ({ body: { items: [{ id: 'x', start: { date: '2026-01-02' } }], nextPageToken: 'same' } }));
    const { api } = mkApi();
    expect((await rejection(api.listEventsRange('primary', { from: '2026-01-01', to: '2026-01-31' }))).code).toBe('unknown');
  });
});

describe('error mapping and retries', () => {
  it('429 is retried after Retry-After, then succeeds', async () => {
    let n = 0;
    const { calls } = installFetch(() => (++n === 1 ? { status: 429, headers: { 'Retry-After': '2' }, body: googleError(429, 'rateLimitExceeded') } : { body: { items: [] } }));
    const { api, sleeps } = mkApi();
    await api.getColors();
    expect(calls).toHaveLength(2);
    expect(sleeps[0]).toBeGreaterThanOrEqual(2000);
  });

  it('persistent 429 ends as rate_limited with retryAfter, after bounded retries', async () => {
    const { calls } = installFetch(() => ({ status: 429, headers: { 'Retry-After': '1' } }));
    const { api, sleeps } = mkApi({ maxRetries: 2 });
    const e = await rejection(api.getColors());
    expect(e).toBeInstanceOf(ProviderError);
    expect(e.code).toBe('rate_limited');
    expect(e.retryAfterMs).toBe(1000);
    expect(e.retryable).toBe(true);
    expect(calls).toHaveLength(3);
    expect(sleeps).toHaveLength(2);
  });

  it('a Retry-After beyond the cap is handed back instead of waited in-process', async () => {
    const { calls } = installFetch(() => ({ status: 429, headers: { 'Retry-After': '120' } }));
    const { api, sleeps } = mkApi();
    const e = await rejection(api.getColors());
    expect(e.code).toBe('rate_limited');
    expect(e.retryAfterMs).toBe(120000);
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it.each(['rateLimitExceeded', 'userRateLimitExceeded'])('403 %s → rate_limited', async (reason) => {
    installFetch(() => ({ status: 403, body: googleError(403, reason) }));
    const { api } = mkApi({ maxRetries: 0 });
    expect((await rejection(api.getColors())).code).toBe('rate_limited');
  });

  it('403 insufficientPermissions → forbidden, not retried', async () => {
    const { calls } = installFetch(() => ({ status: 403, body: googleError(403, 'insufficientPermissions') }));
    const { api } = mkApi();
    const e = await rejection(api.listCalendars());
    expect(e.code).toBe('forbidden');
    expect(e.retryable).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('404 and 410 → not_found (getEvent returns null)', async () => {
    installFetch((c) => ({ status: c.path.endsWith('/gone') ? 410 : 404 }));
    const { api } = mkApi();
    expect(await api.getEvent('primary', 'missing')).toBeNull();
    expect(await api.getEvent('primary', 'gone')).toBeNull();
    expect((await rejection(api.listEventsPage('primary', { timeMin: 'a', timeMax: 'b' }))).code).toBe('not_found');
  });

  it('401 triggers exactly one forced refresh, then retries with the new token', async () => {
    const { calls } = installFetch((c) => (c.headers.Authorization === 'Bearer tok-1' ? { status: 401 } : { body: { event: {} } }));
    const { api, getAccessToken } = mkApi();
    await api.getColors();
    expect(getAccessToken).toHaveBeenLastCalledWith({ forceRefresh: true, rejectedToken: 'tok-1' });
    expect(calls.map((c) => c.headers.Authorization)).toEqual(['Bearer tok-1', 'Bearer tok-2']);
  });

  it('401 after the refresh → unauthorized', async () => {
    const { calls } = installFetch(() => ({ status: 401 }));
    const { api } = mkApi();
    const e = await rejection(api.getColors());
    expect(e.code).toBe('unauthorized');
    expect(calls).toHaveLength(2);
  });

  it('a failed forced refresh surfaces directly (no retry with the rejected token)', async () => {
    const { calls } = installFetch(() => ({ status: 401 }));
    const getAccessToken = jest.fn(async (o: { forceRefresh?: boolean }) => {
      if (o.forceRefresh) throw new ProviderError('offline', 'offline');
      return 'tok-1';
    });
    const api = new GoogleCalendarApi({ getAccessToken, sleep: async () => {} });
    expect((await rejection(api.getColors())).code).toBe('offline');
    expect(calls).toHaveLength(1);
  });

  it('network failure on a read → offline (after bounded retries)', async () => {
    const { calls } = installFetch(() => 'network-error');
    const { api } = mkApi({ maxRetries: 1 });
    const e = await rejection(api.getColors());
    expect(e.code).toBe('offline');
    expect(calls).toHaveLength(2);
  });

  it('5xx on reads is retried with exponential backoff', async () => {
    let n = 0;
    const { calls } = installFetch(() => (++n <= 3 ? { status: 503 } : { body: { event: {} } }));
    const { api, sleeps } = mkApi({ random: () => 1, maxRetries: 4 });
    await api.getColors();
    expect(calls).toHaveLength(4);
    expect(sleeps).toEqual([500, 1000, 2000]);
  });

  it('a read timeout → unavailable', async () => {
    installFetch(() => 'hang');
    const { api } = mkApi({ timeoutMs: 20, maxRetries: 0 });
    expect((await rejection(api.getColors())).code).toBe('unavailable');
  });

  it('an aborted signal stops retrieval with AbortError', async () => {
    installFetch(() => ({ body: { items: [] } }));
    const { api } = mkApi();
    const ctrl = new AbortController();
    ctrl.abort();
    const e = await rejection(api.listEventsRange('primary', { from: '2026-01-01', to: '2026-01-02', signal: ctrl.signal }));
    expect((e as unknown as Error).name).toBe('AbortError');
  });
});

describe('insert semantics', () => {
  it('POSTs with sendUpdates=none and a JSON body', async () => {
    const { calls } = installFetch((c) => ({ body: { ...c.json, id: 'new' } }));
    const { api } = mkApi();
    const ev = await api.insertEvent('primary', body);
    expect(ev.id).toBe('new');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].params.get('sendUpdates')).toBe('none');
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(calls[0].json).toEqual(body);
  });

  it.each([500, 502, 503, 504])('insert %i → uncertain, never retried', async (status) => {
    const { calls } = installFetch(() => ({ status }));
    const { api, sleeps } = mkApi();
    const e = await rejection(api.insertEvent('primary', body));
    expect(e.code).toBe('uncertain');
    expect(e.retryable).toBe(true);
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it('insert timeout → uncertain', async () => {
    installFetch(() => 'hang');
    const { api } = mkApi({ timeoutMs: 20 });
    expect((await rejection(api.insertEvent('primary', body))).code).toBe('uncertain');
  });

  it('insert transport failure → uncertain (the request may have reached Google)', async () => {
    installFetch(() => 'network-error');
    const { api } = mkApi();
    expect((await rejection(api.insertEvent('primary', body))).code).toBe('uncertain');
  });

  it('insert 2xx with an unreadable body → uncertain', async () => {
    installFetch(() => ({ status: 200, bodyFails: true }));
    const { api } = mkApi();
    expect((await rejection(api.insertEvent('primary', body))).code).toBe('uncertain');
  });

  it('insert 429 → rate_limited (definitely not applied), not retried here', async () => {
    const { calls } = installFetch(() => ({ status: 429, headers: { 'Retry-After': '5' } }));
    const { api } = mkApi();
    const e = await rejection(api.insertEvent('primary', body));
    expect(e.code).toBe('rate_limited');
    expect(e.retryAfterMs).toBe(5000);
    expect(calls).toHaveLength(1);
  });

  it('insert 400 → invalid; update 412 → conflict; update 5xx → unavailable', async () => {
    installFetch((c) => ({ status: c.method === 'POST' ? 400 : c.headers['If-Match'] ? 412 : 503 }));
    const { api } = mkApi();
    expect((await rejection(api.insertEvent('primary', body))).code).toBe('invalid');
    expect((await rejection(api.updateEvent('primary', 'e1', body, '"etag"'))).code).toBe('conflict');
    expect((await rejection(api.patchEvent('primary', 'e1', { summary: 'x' }))).code).toBe('unavailable');
  });
});
