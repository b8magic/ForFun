/**
 * App-start hook for OAuth redirects. Native: nothing to do — Google sign-in
 * returns through the reversed-client-id URL scheme to the in-app browser
 * session that started it. Web: see `authRedirect.web.ts`.
 */
export function completePendingAuthRedirect(): void {
  // no-op on iOS / Android
}
