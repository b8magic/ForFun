/**
 * Web only (verification builds): when the Google sign-in popup loads the app
 * at the redirect URI, hand the result to the window that opened it and close
 * the popup (`WebBrowser.maybeCompleteAuthSession`, expo-web-browser 57).
 *
 * It has to run when the app starts. The provider registry loads
 * `./google` (which also does this) only on first calendar use, so the popup
 * would otherwise stay open; `autoRuntime.ts`, imported by the root layout,
 * calls this instead. On an ordinary page load it does nothing.
 */
import * as WebBrowser from 'expo-web-browser';

export function completePendingAuthRedirect(): void {
  try {
    WebBrowser.maybeCompleteAuthSession();
  } catch {
    // never block app start: the opener reports the sign-in as dismissed
  }
}
