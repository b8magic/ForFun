/** The app-start OAuth hook: web completes a pending sign-in popup, native does nothing, neither can break app start. */
// Jest resolves '../authRedirect' to the native file; ESLint's resolver prefers `.web.ts`, hence the disables.
// eslint-disable-next-line import/no-duplicates
import { completePendingAuthRedirect as nativeHook } from '../authRedirect';
// eslint-disable-next-line import/no-duplicates
import { completePendingAuthRedirect as webHook } from '../authRedirect.web';

const mockMaybeComplete = jest.fn();
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: (...a: unknown[]) => mockMaybeComplete(...a) }));

beforeEach(() => mockMaybeComplete.mockReset());

it('web: hands a pending sign-in back to the opener', () => {
  mockMaybeComplete.mockReturnValue({ type: 'failed', message: 'No auth session is currently in progress' });
  webHook();
  expect(mockMaybeComplete).toHaveBeenCalledTimes(1);
});

it('web: an error while completing never escapes into app start', () => {
  mockMaybeComplete.mockImplementation(() => {
    throw new Error('ERR_WEB_BROWSER_REDIRECT');
  });
  expect(() => webHook()).not.toThrow();
});

it('native: no-op', () => {
  nativeHook();
  expect(mockMaybeComplete).not.toHaveBeenCalled();
});
