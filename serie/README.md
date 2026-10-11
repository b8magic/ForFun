# Serie

**A motion-first activity log for iPhone.** Every week is a swell line, every session is a crest on it, and saving makes the lines break like a wave. Serie opens straight into the activity you used last (Surf on first launch): you tap the dates, tap **Salva**, and your personal history grows on the same lines.

The visual identity, motion grammar, typography and palette come from the *corduroy* trailer in `../trailer` (rendered in `../deliverables`). App language: **Italian**.

| Lineup | Save → breaking wave | Switch activity | History (Mese) |
|---|---|---|---|
| ![Lineup](docs/screens/01-lineup.png) | ![Wave](docs/screens/02-wave.png) | ![Switcher](docs/screens/03-switcher.png) | ![History](docs/screens/04-history-month.png) |

| Year | Progress (Tutto) | Session details | Calendar import review |
|---|---|---|---|
| ![Year](docs/screens/05-history-year.png) | ![All](docs/screens/06-history-all.png) | ![Details](docs/screens/07-details.png) | ![Import](docs/screens/08-import-review.png) |

Screens come from the web verification build (headless Chromium, 390 × 844 pt). They are not iPhone screenshots: see the [status matrix](#status).

---

## What it does

- **Immediate entry.** Launch → the living calendar of the remembered activity, ready for date selection. The remembered activity survives restarts. If it was deleted, Serie falls back safely and says so.
- **Moment A — switching activity.** Tap the identity disc: the week-lines rise into an arc of activity discs. The chosen disc flows into the header and recolours the lines with its own pattern (swell, stride, pulse, drift, ripple, grain).
- **Moment B — selecting dates.** Each tap lifts the week-line into a crest (spring water simulated on the UI thread), the liquid in Save rises, and future dates are refused. Months swipe like a passing swell.
- **Moment C — saving.** One idempotent transaction, *then* the break: the lines curl into a wave, the dots ride the lip into the history handle, and the saved days settle as rings. **Annulla** undoes it for a few seconds. A double tap can't duplicate a save, while a deliberate second session on the same day is allowed.
- **History.** *Mese* (multi-year scroll, collapsible mini calendars, several sessions per day), *Anno* (annual totals, month drill-down) and *Tutto* (totals, trend, frequency, consistency, distribution, milestones), plus *Vai a…* jumps to any month and year.
- **Honest numbers.** Session count, active days and recorded hours are kept separate. Unknown durations stay unknown: never 0, never 24 h. Duration coverage is always shown ("durata disponibile per 2 di 4 sessioni").
- **Optional details per session.** Place, address, Google Maps link (parsed, short links resolved, map preview on iOS, manual pin) and notes. Four timing states: date only, start only, start–end (explicit next-day end), duration only, plus start + duration. DST-correct.
- **Activities.** Create, rename, recolour, change pattern, reorder and delete, with safeguards: move sessions elsewhere, or delete them after two confirmations.
- **Calendar exchange** (Google Calendar via OAuth, iPhone calendars via EventKit):
  - **Import** into one activity. Source calendars, date range (complete multi-year paging), title-only "contiene" filter and Google colour labels. A review list shows statuses (new / already imported / possible match / cancelled), scoped select-all and accurate counts.
  - **Export** one activity to Google, iPhone or both. "Both" is blocked when it would be the same calendar twice. Prefix/suffix previews, per-event outgoing edits, explicit "apply to session", and duplicate checks against the real calendar. Idempotent retries, with results per destination.
  - **Automatic export** after saving: off by default, with persisted jobs, retries with backoff, "Da rivedere", and cancellation when turned off.
- **Offline first.** Everything is stored in SQLite on the device. Calendars are only touched when you use those features.

Architecture, motion grammar and integrity rules: [`ARCHITECTURE.md`](ARCHITECTURE.md). Full brief: [`docs/SPEC.md`](docs/SPEC.md).

---

## Run it

Requirements: **Node 22.13+** and npm. For iOS builds, an Expo account (free) and an Apple Developer account. A Mac with **Xcode 26.4+** is needed only for local builds.

```bash
cd serie
npm install            # also copies the web wasm runtimes into public/ (postinstall)
```

### On an iPhone (development build — recommended)

Serie uses native modules (Skia, Reanimated worklets, SQLite, EventKit, Apple Maps, SecureStore), so it does **not** run in Expo Go. Build a development client once, then iterate with the bundler:

```bash
npx eas-cli@latest login
npx eas-cli@latest init                       # links the project (writes extra.eas.projectId)
npx eas-cli@latest device:create              # register your iPhone (ad hoc provisioning)
npx eas-cli@latest build --profile development --platform ios
# install the build from the QR/link EAS prints, then:
npx expo start --dev-client
```

iOS Simulator instead of a device: `npx eas-cli@latest build --profile development-simulator --platform ios`.

Local alternative on a Mac: `npx expo run:ios` (simulator) or `npx expo run:ios --device`. This generates `ios/` with Continuous Native Generation; don't edit `ios/` by hand.

### TestFlight / App Store

1. Create the app in App Store Connect with bundle id **`app.serie.ios`** (or change `ios.bundleIdentifier` in `app.json`).
2. `npx eas-cli@latest build --profile production --platform ios` (the build number auto-increments).
3. `npx eas-cli@latest submit --platform ios --latest`, then add testers in TestFlight.

Google Calendar uses sensitive scopes: users outside the OAuth test-user list need Google's app verification first (see below).

### Web (verification build only)

```bash
npm run web            # dev server; Skia runs on CanvasKit, SQLite on sql.js (IndexedDB)
npm run build:web      # static bundle in dist-web/
```

The web build exists to verify the UI and data layer in CI-like environments. Calendars are unavailable on web, because EventKit is iOS-only and the Google web client is optional.

---

## Configuration

| Variable | Needed for | Notes |
|---|---|---|
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google Calendar on iOS | An iOS OAuth client id (`NNNN-xxxx.apps.googleusercontent.com`). It is not a secret, and no client secret is used. `app.config.ts` registers its reversed form as a URL scheme. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | optional, web verification of Google | Web OAuth client with origin `http://localhost:8081`. |
| `EXPO_PUBLIC_SERIE_E2E_CALENDAR` | **tests only** | `1` replaces both providers with in-memory test calendars (`src/calendar/memory.ts`). Never set it for real builds. |

Put them in `.env` (local) or in EAS environment variables (`npx eas-cli@latest env:create`), and rebuild after changing them.

**Google Cloud setup (once).** Enable the Google Calendar API, configure the consent screen (External, add test users while in *Testing*), and add the scopes `openid`, `userinfo.email`, `calendar.readonly` and `calendar.events`. Then create an **iOS** client for bundle id `app.serie.ios`. In *Testing*, refresh tokens expire after 7 days; production needs Google verification for the sensitive scopes. Details: [`src/calendar/google/README.md`](src/calendar/google/README.md).

**iPhone calendars.** No setup beyond the development build. The `expo-calendar` config plugin writes the permission text. iOS 17+ asks for full access, which import and duplicate checks need. If the user grants write-only access, Serie says that it can't check duplicates or import. Details: [`src/calendar/apple/README.md`](src/calendar/apple/README.md).

**Permissions** are requested only when the matching feature is used (calendar on *Collega*, clipboard on paste). Location is never requested.

---

## Verify

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # expo lint (eslint-config-expo)
npm test               # Jest: domain, data (sql.js), state, calendar engines, providers (fakes), maps, sheets helpers
npm run e2e            # web builds + three headless-Chromium suites (Playwright, Chromium preinstalled)
```

The e2e suites drive the real UI and assert on what a user sees:

- `tools/e2e.mjs`: first launch in Surf, multi-date save, restart persistence, stale selections not reused, double-tap protection, same-day sessions, future dates, switching persistence, Month/Year/All history.
- `tools/e2e-flows.mjs`: the **statistics acceptance test** (date-only, start-only 08:00, 09:00–11:00 and 1.5 h give 4 sessions, 3 h 30 min, 2 of 4), edit and delete updating totals, one duration applied to several dates, details not reused, activity create and duplicate name, deleting the remembered activity, month jump, reduced motion.
- `tools/e2e-calendar.mjs` (against the in-memory test calendars): title-only filter, labels, recurring occurrences without the cancelled one, multi-day mapping, scoped selection, re-import recognition, the equivalent "both" destinations being blocked, export, idempotent re-export, differences offered as explicit updates, and automatic export after a save.

---

## Status

<!-- filled in after the final verification run -->

---

## Project layout

```
src/app/        Expo Router routes (thin)          src/domain/   pure model: dates, timing, duration, stats, history
src/places/     Lineup (Registra) and Time (Storia) src/data/     SQLite drivers, migrations, repositories
src/sheets/     session, activities, calendar flows src/calendar/ providers + import/export/auto engines
src/motion/     motion grammar (worklets)           src/maps/     Google Maps link parsing/resolution
src/graphics/   Skia identity discs                 src/state/    zustand store + actions
src/ui/         theme, type, controls               tools/        web build, e2e suites
```
