import { metaToUrl } from '@/calendar/apple/meta';
import { redirectSystemPath } from '@/app/+native-intent';

const mockExisting = new Set(['s-live']);
jest.mock('@/data/database', () => ({
  getRepositories: () => Promise.resolve({ sessions: { get: (id: string) => Promise.resolve(mockExisting.has(id) ? { id } : null) } }),
}));

const meta = (sessionId: string) => metaToUrl({ v: 1, sessionId, opId: 'op1_x_0123456789ab', timingState: 'date_only', durationSec: null, durationSource: null, schedulingPlaceholder: false });

describe('system links', () => {
  it('opens the exported session when it still exists', async () => {
    expect(await redirectSystemPath({ path: meta('s-live'), initial: true })).toBe('/session/s-live');
  });
  it('falls back to the Lineup for a deleted session or an unreadable link', async () => {
    expect(await redirectSystemPath({ path: meta('s-gone'), initial: false })).toBe('/');
    expect(await redirectSystemPath({ path: 'serie://export?m=%%%', initial: false })).toBe('/');
  });
  it('never navigates on OAuth redirects and leaves ordinary paths alone', async () => {
    expect(await redirectSystemPath({ path: 'com.googleusercontent.apps.123:/oauthredirect?code=x', initial: false })).toBeNull();
    expect(await redirectSystemPath({ path: '/calendar', initial: false })).toBe('/calendar');
  });
});
