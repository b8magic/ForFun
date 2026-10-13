# Serie

**A motion-first activity log for iPhone.** Choose an activity, select dates, then tap **Salva**. Tap that activity again to browse every color at full intensity. The calendar opens on a cream surface, remembers the chosen activity or neutral view, and keeps an independent draft for each activity. Italian is the application language.

The identity, typography, patterns and motion come from the *corduroy* trailer in `../trailer`. The calendar evolution is developed on `codex/serie-calendar`, starting at commit `0f39ebd14b1f1157eb9d4cf89ba2cb0f57e2c655`. See [Codex handoff](docs/CODEX_HANDOFF.md) for provenance and final validation. Existing images in `docs/screens/` document the earlier interface; [final native captures](docs/screens-calendar-1.1/README.md) preserve the evolved interface and exact source provenance.

**Current delivery: [Serie 1.2.0, build 3 — unsigned IPA](https://github.com/b8magic/ForFun/actions/runs/38376497626/artifacts/11806645205)**, source `3760f86b40e4690764a17b8458b98b82d0dbe760`. Install with SideStore/AltStore Classic; sign in to GitHub if the artifact download asks for it. The download is retained until **20 October 2026 at 10:44 UTC**. Packaging, raw upload and artifact metadata share the same SHA-256; [delivery receipt](docs/ipa-1.2.json) records the exact digest, size and provenance.

Verification: **861 tests/48 suites**, **43 browser checks**, clean types/lint and a successful native Release archive. The user made the repository public after the original attempt failed before runner startup; rerunning only the IPA job succeeded on a standard macOS runner. Native simulator execution was not repeated for 1.2, and installation remains an iPhone check. See [current handoff](docs/CODEX_HANDOFF.md) and [new interface captures](docs/screens-feedback-1.2/README.md). The previous 1.1 delivery and its native captures remain documented as historical evidence.

## What it does

Version **1.2.0** adds neutral calendar viewing, per-activity `×N` session badges, confirmed swipe deletion in day details, 24 color presets plus a continuous HSV/HEX picker, separate hour/minute controls and searchable IANA timezone selection. Home names the year; history/progress use the direct Home entry instead of duplicate menu items. The current IPA contains these changes; delivery provenance is recorded in the handoff.

- **Immediate logging.** Surf is active on a fresh installation. The remembered activity opens directly on later launches. Visible activity chips switch the context; activity management has its own control. A deleted remembered activity falls back safely with a notice.
- **Continuous calendar.** Scroll through months or tap the sticky month title to jump to a month/year. Each day shows up to four recorded activity colors and a +N overflow marker; accessible labels and day sheets include every actual activity. Settings choose all-activity markers or only the active activity. Future dates cannot enter a logging draft.
- **Durable drafts.** Dates and applied optional details survive activity switching and restarts. Each activity has its own draft. Saving clears only the successfully saved draft; explicitly clearing a draft removes its dates and details.
- **Safe repeated logging.** A save is idempotent, so repeated taps cannot duplicate it. A deliberate later session on the same date is allowed. **Annulla** reverses a recent save.
- **Day details.** Tapping a main-calendar date selects it for logging, including a date already recorded. Long press, or **selected-day details** when one date is selected, opens its complete saved sessions. Edit a session and return to the same day; close the day to return to the calendar or history. **Nuova sessione** adds the day to the current draft without saving automatically.
- **History.** *Mese* shows populated months with exact counts, active days and known durations; populated month calendars open immediately. *Anno* displays twelve miniature calendars for a populated year and enables drill-down only for populated past/current months. Empty activity filters are explicit. *Progressi* shows actual totals, trends, frequency, consistency, distribution, milestones and an ad hoc period summary.
- **Named periods.** Store a name, inclusive start/end dates, optional note and either all activities or selected stable activity identifiers. Previews and totals come from actual sessions. Periods can overlap and share a name. Editing or deleting a period changes its metadata; sessions remain intact. Future period endpoints are allowed even though future session logging is disabled.
- **Honest durations.** Unknown values remain unknown. Totals sum known durations and disclose coverage, such as “durata disponibile per 2 di 4 sessioni.” Date-only and start-only sessions never add invented hours.
- **Optional session details.** Notes, location, address, supported Google Maps links and map preview on iOS. Timing supports date only, start only, interval with explicit overnight end, duration only, and start + duration. Calculations use wall times and an IANA time zone, including DST transitions.
- **Activities and settings.** Create, rename, recolor, change patterns, reorder and delete with session move/delete safeguards. Unsaved form changes require an explicit discard decision. Cream/dark appearance, home-calendar activity scope and motion preference persist and apply across sheets. Motion defaults to the system accessibility setting. Close/back controls remain available alongside native sheet gestures.
- **Calendar exchange.** Google Calendar through OAuth and REST, iPhone calendars through EventKit. Import reviews title-only matching, source calendars, labels and duplicate statuses. Export reviews destination equivalence, titles, content, per-event edits and duplicate actions. Automatic export is off initially, waits for the undo window, persists jobs and exposes pending/review states. Local edits never silently rewrite calendar events.
- **Offline persistence.** SQLite on iOS; sql.js with IndexedDB persistence in the web verification build. Basic logging never asks for calendar or location permissions.

[Architecture](ARCHITECTURE.md) explains the data and UI boundaries. [Product specification](docs/SPEC.md) preserves the original brief and adds the approved calendar evolution.

## Run it

Requirements: **Node 22.13+** and npm. The native application uses Expo SDK 57, React Native Skia, Reanimated, SQLite, EventKit and Apple Maps, so a development build is required instead of Expo Go.

```bash
cd serie
npm ci
```

`postinstall` copies the web WASM runtimes into `public/`.

### iPhone development build

EAS development/TestFlight builds require an Expo account and the relevant Apple provisioning account. A Mac is needed only for local builds.

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest device:create
npx eas-cli@latest build --profile development --platform ios
npx expo start --dev-client
```

For an EAS simulator build, use `--profile development-simulator`. On a Mac with **Xcode 26.4+**, `npx expo run:ios` or `npx expo run:ios --device` generates native projects through Continuous Native Generation. Configure native behavior in `app.json` and config plugins; do not hand-edit generated native directories.

`tools/open-in-xcode.sh` prepares the generated project and opens its workspace. `tools/live.sh` prepares **Serie Dev** (`app.serie.ios.dev`) for the simulator; `tools/live.sh --device` uses a connected iPhone. The development app can coexist with the release app.

### Simulator and final IPA through GitHub Actions

The individual `ios-simulator.yml` and `ios-ipa.yml` workflows retain **Run workflow** support and accept an optional full candidate SHA. Manual IPA dispatch builds downloadable artifacts only. The publishing path is the coordinated **Serie candidate (checks → simulator → IPA)** workflow:

1. Check out one immutable commit; run Jest, typecheck, lint and all four browser suites.
2. Build the iOS Release simulator app from that commit and run the four Maestro flows, with video, screenshots, app log and crash evidence. After the fresh logging fixture, reconstruct v1 and verify the actual native SQLite upgrade preserves all six original tables. A native pixel check requires both actual activity colors to remain visible in the same day after adding a second activity.
3. Build the unsigned IPA from the same commit only after both gates pass; optionally publish the prerelease.

Normal development pushes do not trigger a build. On `codex/serie-calendar`, adding/updating `serie/tools/release-candidate.json` requests the final candidate pipeline; create this marker only after local checks pass. Manual dispatch can specify a full 40-character SHA. macOS jobs are sequential, and the release never runs after a failed simulator gate.

If a candidate was published before final visual review found a defect, the replacement marker can name its exact `supersedesTag`. Only after the replacement is verified and published does the release job retain that intermediate prerelease as a draft. It does not alter original or unrelated releases.

Artifacts include `candidate-web-verification`, `Serie-simulator`, `smoke-test` and `Serie-ipa`. The IPA prerelease includes `Serie-unsigned.ipa`, its SHA-256 checksum and `Serie-build.json` identifying the source commit and build run.

### Sideload with SideStore / AltStore

The IPA is **unsigned**. SideStore or **AltStore Classic** re-signs it with your Apple ID. Download the verified IPA linked above, signing in to GitHub if the Actions artifact download asks for it, then share the IPA to SideStore/AltStore or select it from **My Apps → +**. The repository is public; a release asset, when available, can be downloaded without signing in.

- iOS **16.4+** and Developer Mode are required. The place map needs iOS 17; iOS 16 shows a text readout.
- A free Apple ID signs the app for 7 days; SideStore/AltStore can refresh it. Serie uses one of the three active app slots.
- The re-signed bundle identifier changes. Google sign-in on that identifier requires compatible OAuth configuration; iPhone calendars use the app's native calendar permission.

### TestFlight / App Store

Create the app in App Store Connect with bundle id `app.serie.ios`, then build and submit:

```bash
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest submit --platform ios --latest
```

Google Calendar production users may require Google verification for its sensitive scopes.

### Web verification

```bash
npm run web
npm run build:web
```

The web build validates UI, CanvasKit graphics and persistence. Real EventKit is unavailable on web. Calendar integration tests use explicitly enabled in-memory test providers.

## Configuration

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | iOS OAuth client id for Google Calendar. It is a public client identifier; no client secret is used. `app.config.ts` registers the reversed URL scheme. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Optional Google web OAuth client for a configured web origin. |
| `EXPO_PUBLIC_SERIE_E2E_CALENDAR` | **Tests only:** `1` uses in-memory providers from `src/calendar/memory.ts`. Never set it for a real native build. |

Set them in `.env`, EAS environment variables or the configured repository variable/secret, then rebuild. For Google, enable Calendar API, configure consent/test users and create the client for the matching bundle identifier. Details: [Google provider](src/calendar/google/README.md).

The `expo-calendar` plugin supplies native permission text. Import and duplicate checking require readable/full calendar access; write-only access is disclosed. Permissions are requested through **Collega**, never on basic logging. Location permission is never requested. Details: [Apple provider](src/calendar/apple/README.md).

## Verify

```bash
npm run typecheck
npm run lint
npm test -- --ci --runInBand
npm run e2e
```

The browser suites use **13 October 2026, 12:00 UTC** as the fixed date while leaving animation, undo and job timers live. Each suite fails on unexpected page errors or console errors. Browser-plugin availability is recorded in evidence; the implementation environment uses Playwright because the Browser plugin is unavailable. Installed system Chromium is used when present; otherwise install the matching Playwright Chromium with `npx playwright install chromium`.

- `tools/e2e.mjs`: meaningful first launch, multi-date save, separate durable drafts across activity switches/restart, repeat-save protection, intentional same-day sessions, disabled future dates, mixed activity calendar/day details, edit-return, long press, honest empty filters and omission of empty month rows, twelve-month year mosaic, drill-down, Progressi and direct history navigation to an older recorded year.
- `tools/e2e-flows.mjs`: the four-session duration acceptance case, edit/delete recalculation, independent multi-date durations, activity management/discard guards/deleted drafts, cross-year month jump, settings/theme persistence, Maps resolution and unchanged links, session discard guard, named-period validation/preview/persistence/scoped edit/overlap/delete with sessions preserved.
- `tools/e2e-calendar.mjs`: memory-provider import/export/automatic export, title-only matching, labels, recurrence/cancellation, re-import detection, equivalent destinations, idempotency and explicit change review.
- `tools/e2e-v12.mjs`: neutral activity focus and persistence, per-activity session counts, confirmed swipe deletion, arbitrary colors and contrast, hour/minute durations, searchable timezones and simplified navigation.
- `maestro/`: native logging/drafts/mixed-day/history, Apple Maps, EventKit export, settings and period/session integrity. A native v1 → v2 upgrade check compares original categories, sessions, settings and calendar-exchange tables after relaunch. `tools/sim-smoke.sh` derives fixture dates from the previous month so all test sessions are historical on the runner.

Evidence defaults to a temporary `serie-e2e/` directory. Set `E2E_SHOTS` to choose a base directory and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to select another Chromium executable. Results and screenshots are separated into `core`, `flows` and `calendar` subdirectories.

## Status

The current **1.2.0** delivery passed 861 tests/48 suites, 43 browser checks, types/lint and native Release compilation/IPA packaging. [Run 38376497626, attempt 2](https://github.com/b8magic/ForFun/actions/runs/38376497626) succeeded against the immutable source above. Its IPA-only path intentionally skipped simulator execution and prerelease publication; use the verified raw artifact above. See the [machine-readable receipt](docs/ipa-1.2.json).

Historical **1.1.0** verification passed **829 tests in 45 suites**, typecheck, lint, **34/34 browser checks** with zero runtime errors/warnings and **9/9 pixel-checker tests**. [Final run 38336957498](https://github.com/b8magic/ForFun/actions/runs/38336957498) also passed all four Maestro journeys on iPhone 17 Pro / iOS 26.5, actual six-table SQLite upgrade, same-day native color pixels, startup and crash checks, then built the unsigned IPA from that same commit. The historical 1.1 IPA and failed automatic prerelease startup are recorded in the handoff. Receipts and provenance are in [Codex handoff](docs/CODEX_HANDOFF.md). Baseline totals are not reused as validation of this branch.

| Area | Verification boundary |
|---|---|
| Model, migrations, durable drafts, periods, stats and calendar engines | Jest uses the same SQL through sql.js and fake native/provider adapters. |
| Actual calendar/day/history/settings/period UI | Four browser suites drive the exported app and database, including 1.2 feedback scenarios. Canvas screenshots support visual review. |
| Native Release app, maps and EventKit export | 1.1 passed the GitHub macOS simulator's Maestro gate; 1.2 passed native compilation but did not repeat simulator execution. |
| Installable unsigned IPA | 1.2 uses local gates followed by IPA-only compilation; 1.1 used the full candidate pipeline. Both packages have source manifests and checksums. Physical iPhone installation remains a device check. |
| Google OAuth and real REST traffic | Requires real OAuth credentials and a test account. Memory providers and fetch mocks do not prove this. |

Physical-device frame rate, thermal/battery behavior, haptics, VoiceOver, Dynamic Type and iOS 16/17 behavior need device testing. The simulator cannot establish those results. Real Google OAuth/calendar writes and the Apple permission prompt itself are outside the browser suite; simulator calendar permission is pre-granted.

Known integration limits: EventKit time-zone abbreviations are displayed in the device zone; Google reconciliation can lag its search index after an uncertain write; start-only export spans are scheduling choices rather than recorded hours; automatic export runs while the app is open and resumes persisted jobs on later launches. Local session deletion leaves external calendar events intact by default. Android is not a supported target.

## Project layout

```text
src/app/       Expo Router routes              src/domain/   dates, timing, stats, day summaries, named periods
src/places/    logging and history             src/data/     SQLite drivers, migrations, repositories
src/sheets/    day, period, session, management src/calendar/ provider and import/export/automatic engines
src/ui/        theme, shared calendars, controls src/graphics/ Skia identity graphics
src/state/     zustand store and actions        tools/        browser tests, builds, simulator runner
maestro/       native smoke flows              docs/         specification and Codex provenance
```
