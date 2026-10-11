# Google Calendar provider

`src/calendar/google/` implements `CalendarProvider` (`src/calendar/types.ts`) for Google Calendar REST v3.

| File | Role | Imports Expo? |
|---|---|---|
| `auth.ts` | OAuth logic: client config, scopes, code exchange, refresh, revoke, account email, connection status | no |
| `api.ts` | Typed Calendar v3 client: pagination, year chunks, error mapping, retries | no |
| `provider.ts` | Event normalization, draft → body, app metadata, `GoogleCalendarProvider` | no |
| `expoAdapters.ts` | expo-auth-session authorizer, expo-secure-store token store | yes |
| `index.ts` | `createGoogleCalendar()` wiring for the app | yes |
| `strings.ts` | Italian user-facing strings, colour names | no |
| `setup.ts` | `GOOGLE_SETUP` (short version of this file) | no |

## OAuth flow

- **iOS:** authorization code + PKCE (S256), opened in `ASWebAuthenticationSession` by `expo-auth-session`. It uses an **iOS OAuth client** (no client secret). The redirect goes to the reversed client id scheme `com.googleusercontent.apps.<id>:/oauthredirect`. The code is exchanged at `https://oauth2.googleapis.com/token`. Credentials go in the Keychain (`expo-secure-store`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`) and never in plain storage.
- **Web** (verification only): implicit token flow with the web client id. There is no refresh token, so the token lives in memory only and the user reconnects after about 1 hour.
- **Scopes per workflow:**
  - `connect('read')` asks for `openid email calendar.readonly`. That covers import, inspection and duplicate checks.
  - `connect('readwrite')` also asks for `calendar.events`.
  - Google does not support `include_granted_scopes` for installed apps. An upgrade therefore asks again for the full set: the scopes already granted plus the new ones.
- **Granular consent:** the user can untick scopes on Google's consent screen. The scopes Google actually grants decide `canRead` / `canWrite`. If only `calendar.events` is granted, the status is `write_only`: no import, no duplicate checks.
- **accountId** is the Google account email. It comes from the OpenID userinfo endpoint; if that fails, the primary calendar id is used.
- **Refresh:** the access token is refreshed automatically, with one shared refresh for concurrent callers. A 401 causes one forced refresh, then the call fails. `invalid_grant` deletes the credentials and the status becomes `disconnected` ("Accesso a Google revocato o scaduto").
- **Disconnect** revokes the grant at `https://oauth2.googleapis.com/revoke`, then deletes the Keychain item. The item is deleted even when Google cannot be reached; in that case `GoogleAuth.disconnect()` reports `{ revoked: false }`.
- **Missing client id:** `Connection.status = 'not_configured'` with an Italian detail. Expo Go gives `unavailable`, because Google rejects `exp://` redirects. SDK 57 documents `ExecutionEnvironment.StoreClient` as "Expo Go **or a development build**", so Expo Go is recognised by `StoreClient` plus Expo Go's own `expoVersion` (or `appOwnership: 'expo'`), never by `StoreClient` alone (`detectExpoGo` in `expoAdapters.ts`).
- **Redirect URI:** the native redirect is passed to `AuthRequest` verbatim. `makeRedirectUri({ native })` returns it only in the `bare`/`standalone` environments and would otherwise substitute an app-scheme URL that Google rejects.
- **Concurrency:** a token refresh that is still in flight when the user disconnects or reconnects never writes its result back and never deletes the newer credentials (generation check). A Keychain read failure (e.g. before the first unlock) is not cached, so the next call reads the Keychain again. If the account email cannot be read after consent, the fresh grant is revoked and nothing is stored. Every OAuth request (token, userinfo, revoke) is bounded by a 30 s timeout, body included: a stalled refresh fails as `unavailable` (retryable) instead of blocking every API call, and a stalled revocation still lets disconnect delete the local credentials.

Expo's Google guide recommends a native Google Sign-In library, such as `@react-native-google-signin/google-signin`. That library is not installed in this project, so the flow uses the generic `AuthRequest` against Google's endpoints. To switch later, provide another `InteractiveAuthorizer`; nothing else changes.

> **Risk:** Google's "OAuth 2.0 for iOS & desktop apps" page now says custom URI schemes are no longer supported. Its parameter notes name Android and Chrome apps specifically. The official Google Sign-In iOS SDK still relies on the reversed-client-id URL scheme. If Google enforces the restriction for iOS clients, move to the native SDK.

## Google Cloud setup (developer, once)

1. In [Google Cloud console](https://console.cloud.google.com/), create or select a project.
2. **APIs & Services → Library → Google Calendar API → Enable.**
3. **Google Auth Platform → Branding / Audience:**
   - Choose user type *External*.
   - While the publishing status is *Testing*, add the testers as *Test users*.
   - In *Testing*, refresh tokens for these scopes **expire after 7 days**.
   - `calendar.readonly` and `calendar.events` are *sensitive* scopes, so Google verification is needed before production.
4. **Data access → Add scopes:** `openid`, `.../auth/userinfo.email`, `.../auth/calendar.readonly`, `.../auth/calendar.events`.
5. **Clients → Create client → iOS:**
   - Bundle ID: **`app.serie.ios`**.
   - Copy the client id (`NNNN-xxxx.apps.googleusercontent.com`). iOS clients have no secret.
6. Optional, for web verification only: **Clients → Create client → Web application:**
   - Authorized JavaScript origins: `http://localhost:8081`.
   - Authorized redirect URIs: `http://localhost:8081`. The redirect is the page origin, from `makeRedirectUri()`.

## Build configuration

`.env` (or EAS environment variables). These are client ids, not secrets. Expo inlines them at build time, so restart the bundler or rebuild after a change.

```
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=NNNN-xxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=MMMM-yyyy.apps.googleusercontent.com   # optional, web only
```

`app.json` needs the reversed client id registered as an iOS URL scheme. This change is not applied here. `ios.scheme` is merged with the top-level `"scheme": "serie"`:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "app.serie.ios",
      "scheme": ["com.googleusercontent.apps.NNNN-xxxx"]
    }
  }
}
```

Alternatively, an `app.config.ts` can derive the scheme from `process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. Then build a **development build**, for example `npx eas-cli@latest build --profile development --platform ios`. Expo Go cannot be used.

Web only: importing `@/calendar/google` calls `WebBrowser.maybeCompleteAuthSession()`, which closes the auth popup. Make sure the app root imports it, directly or through the provider registry.

## Calendar API behaviour

- `events.list` is called with:
  - `singleEvents=true`, `orderBy=startTime`, `maxResults=2500`;
  - a `pageToken` loop until there is no `nextPageToken`;
  - the range split **per calendar year**. Each window is widened to UTC+14…UTC−12, then events are filtered by their local start date and de-duplicated by id.
- `showDeleted=true` is sent only when cancelled occurrences are requested.
- `findByOpId` uses `privateExtendedProperty=serie_op=<opId>`.
- Writes:
  - Every write uses `sendUpdates=none`, `reminders {useDefault:false, overrides:[]}`, and never adds attendees.
  - `updateEvent` reads the event, replaces only Serie's fields and sends `events.update` with `If-Match`. A 412 becomes `conflict`.
  - `updateEvent` keeps the event's own reminders and attendees (Serie adds none and strips none). It refuses an event deleted on Google (`not_found`) and a recurring series master without an occurrence key (`invalid`), because a full replacement would move every occurrence.
- `findByOpId` returns `conflict` (not `null`) when Google matches `serie_op=<opId>` but the event's Serie metadata is unreadable, so the caller never creates a second event for the same operation.
- `listEvents` refuses a calendar where Google reports `accessRole: freeBusyReader` (busy blocks without titles are never listed as events). `listLabels` needs read consent: `colors.get` does not accept `calendar.events`.
- App metadata goes in `extendedProperties.private`:

  | Key | Content |
  |---|---|
  | `serie_v` | `1` |
  | `serie_session` | session id |
  | `serie_op` | operation id |
  | `serie_timing` | timing state |
  | `serie_dur` | duration in seconds; omitted when unknown |
  | `serie_src` | `interval` or `declared`; omitted when unknown |
  | `serie_sched` | `1` when the event span is an export-only placeholder, otherwise `0` |

  Malformed metadata is ignored and treated as null.
- Error mapping:

  | Response | Error |
  |---|---|
  | 401 | one refresh, then `unauthorized` |
  | 403 `rateLimitExceeded` / `userRateLimitExceeded`, or 429 | `rate_limited`, with `Retry-After` when sent |
  | other 403 | `forbidden` |
  | 404 / 410 | `not_found` |
  | 409 / 412 | `conflict` |
  | 400 | `invalid` |
  | network failure | `offline` |
  | 5xx or timeout | `unavailable` |
  | insert with 5xx, timeout, transport failure or unreadable 2xx | `uncertain`: reconcile with `findByOpId` before retrying |

- Reads retry with full-jitter exponential backoff: 4 retries at most, delays up to 20 s. A longer `Retry-After` is passed back to the caller instead.
- Labels:
  - Labels come from `colors.get` (event palette).
  - Italian names: Lavanda, Salvia, Uva, Fenicottero, Banana, Mandarino, Pavone, Grafite, Mirtillo, Basilico, Pomodoro (colorId 1…11).
- Calendar access by `accessRole`:

  | Role | canRead | canWrite |
  |---|---|---|
  | owner / writer | yes | yes |
  | reader | yes | no |
  | freeBusyReader | no (cannot see details) | no |

  Both values also require the matching granted scope.
