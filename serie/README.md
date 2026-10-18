# Serie

**A motion-first activity log for iPhone.** Choose an activity, select dates, then tap **Salva**. Tap that activity again to browse every color at full intensity. The calendar opens on a cream surface, remembers the chosen activity or neutral view, and keeps one shared date selection with optional details saved separately per activity. Italian is the application language.

The identity, typography, patterns and motion come from the *corduroy* trailer in `../trailer`. The calendar evolution is developed on `codex/serie-calendar`, starting at commit `0f39ebd14b1f1157eb9d4cf89ba2cb0f57e2c655`. See [Codex handoff](docs/CODEX_HANDOFF.md) for provenance and final validation. Existing images in `docs/screens/` document the earlier interface; [historical 1.1 native captures](docs/screens-calendar-1.1/README.md) preserve that delivery's exact source provenance.

**Current delivery: [Serie 1.3.3, build 8 — unsigned IPA](https://github.com/b8magic/ForFun/actions/runs/39142564518/artifacts/12142308540)**, source `1310ed9476595539a358bbf034f18762c0493a7f`. Install as an update with SideStore/AltStore Classic using the existing app's Apple ID; do not uninstall to retain local data. Sign in to GitHub if requested. The download is retained until **2026-10-25 16:05:56 UTC**. The [delivery receipt](docs/ipa-1.3.3.json) records matching packaging/upload/artifact checksum, size and provenance.

Verification: **994 tests in 62 suites**, **8/8 focused browser journeys**, clean typecheck/lint and a successful native Release archive and IPA upload. Browser checks cover zero/positive scoped counts, exact persisted-session restoration with red Undo, period dates, the common multi-day list, scoped bulk selection and durable draft discard, including 320px layout. Date conversion also passed in two non-UTC zones. No native simulator or physical iPhone interaction test was run for this update. [Verification receipt](docs/verification-1.3.3.json) · [Handoff](docs/CODEX_HANDOFF.md). Previous evidence remains historical.

## What it does

Version **1.3.3** hides Home monthly counts at zero, adds the existing red **Annulla** action after deleting a session from History's inline day details, and uses native iPhone date pickers for named Periods. Undo restores the original record and its details without creating a new session or exporting calendar events. Home **Sessioni** now shares a chronological day-grouped list in Nuove and Modifica, including multiple dates. Activity colors identify every row; Nuove supports individual editing/deletion, Modifica uses checkboxes. Menu **Bozze** shows the shared dates and prepared activity details, with independent discard and Home resume; the stale draft dots beside activity names are removed. Shared date selection, cleaned History summaries, descending year mosaics and scoped monthly counts remain available.

- **Immediate logging.** Surf is active on a fresh installation. The remembered activity opens directly on later launches. Visible activity chips switch the context; activity management has its own control. A deleted remembered activity falls back safely with a notice.
- **Continuous calendar.** Scroll through months or tap the sticky month title to jump to a month/year. Each day shows up to four recorded activity colors and a +N overflow marker; accessible labels and day sheets include every actual activity. Settings choose all-activity markers or only the active activity. Future dates cannot enter a logging draft.
- **Durable selection and details.** One date selection survives activity/mode changes and restarts, including neutral view. Applied optional details remain separate per activity. Upgrade preserves the union of legacy draft dates. A completed save clears only its captured working selection when it is still current; a later selection or activity change is preserved.
- **Draft management.** Menu → Bozze lists the shared dates and complete prepared details for each activity. Discard dates, one activity’s details, or all unfinished work; recorded sessions stay intact. Resume Home without saving.
- **Safe repeated logging.** A save is idempotent, so repeated taps cannot duplicate it. A deliberate later session on the same date is allowed. **Annulla** reverses a recent save.
- **Day details and bulk editing.** A tap selects dates in both **Nuove** and **Modifica**, with or without an active activity. Long press opens saved day details. **Modifica** includes existing sessions for the focused activity, or all activities in neutral view; **Sessioni** opens the individual checklist. Notes/place/timing offer Keep/Set/Clear and commit atomically after checking every reviewed record. Dates remain selected after editing so they can also be used for new logging. Swiping reveals **Elimina**; pressing it deletes that session immediately.
- **History.** *Mese* shows populated months with exact counts, active days and known durations; dates expand inline session previews and editors return to the same context. *Anno* displays twelve miniature calendars and focuses populated past/current months. Empty activity filters are explicit. *Progressi* shows actual totals, trends, frequency, consistency, distribution, milestones and an ad hoc period summary.
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

1. Check out one immutable commit; run Jest, typecheck, lint and all five browser suites.
2. Build the iOS Release simulator app from that commit and run the five Maestro flows, with video, screenshots, app log and crash evidence. After the fresh logging fixture, reconstruct v1 and verify the actual native SQLite upgrade preserves all six original tables. A native pixel check requires both actual activity colors to remain visible in the same day after adding a second activity.
3. Build the unsigned IPA from the same commit only after both gates pass; optionally publish the prerelease.

Normal development pushes do not trigger a build. On `codex/serie-calendar`, adding/updating `serie/tools/release-candidate.json` requests the candidate pipeline; create this marker only after local checks pass. Manual dispatch can specify a full 40-character SHA. Coordinated publication requires both Linux and native gates. The separate `ipa-build-request.json` marker builds downloadable IPA artifacts only; Codex returned to that path after the user's delay feedback for updates 1.3 through 1.3.3, with no prerelease publication or completed simulator gate.

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
- `tools/e2e-v12.mjs`: neutral activity focus and persistence, per-activity session counts, confirmed swipe deletion, arbitrary colors and contrast, numeric hour/minute durations, searchable timezones and simplified navigation.
- `tools/e2e-v13.mjs`: compact numeric typing/editing, exact saved-second preservation, real four-direction toast gestures with persisted-row checks, inline history context and bulk keep/set/clear with drafts and unselected sessions preserved.
- `tools/e2e-v131.mjs`: seven focused journeys covering shared selection, neutral/scoped editing and individual exclusions, immediate deletion with real browser touch swipes, inline details and restart persistence.
- `tools/e2e-v132.mjs`: six focused journeys covering saved monthly counts, focus/draft independence, the shared History summary, known/unknown durations, descending year mosaics and 320px layout.
- `tools/e2e-v133.mjs`: eight focused journeys covering hidden zero counts, exact deletion/Undo, period date inputs, common multi-day Sessioni, bulk selection and durable draft discard.
- `maestro/`: native logging/drafts/mixed-day/history, Apple Maps, EventKit export, settings and period/session integrity. A native v1 → v2 upgrade check compares original categories, sessions, settings and calendar-exchange tables after relaunch. `tools/sim-smoke.sh` derives fixture dates from the previous month so all test sessions are historical on the runner.

The fifth native flow additionally checks actual UIKit status-bar taps, numeric keyboard editing, four-direction message dismissal, inline history and bulk editing. The older full browser/native scenarios retain historical per-activity draft and confirmation assumptions; they were not rerun as a 1.3.1 gate. The 1.3.1 suite also retains the prior single-day Sessioni entry point. Use the focused 1.3.3 suite for current behavior, and reconcile older expectations before a future full run.

Evidence defaults to a temporary `serie-e2e/` directory. Set `E2E_SHOTS` to choose a base directory and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to select another Chromium executable. Results and screenshots are separated into `core`, `flows`, `calendar`, `v12`, `v13`, `v131`, `v132` and `v133` subdirectories.

## Status

The current **1.3.3, build 8** IPA was archived and uploaded successfully by [run 39142564518](https://github.com/b8magic/ForFun/actions/runs/39142564518), job `117719799034`. Prerelease publication was intentionally skipped. Application commit `96d04d88efd137cf50a5929e7a2dd4aca5370191` passed local tests/types/lint and eight focused browser journeys with zero errors/warnings. Build source `1310ed9476595539a358bbf034f18762c0493a7f` adds only the IPA request. The earlier initial-scope build succeeded while the user approved these additions; it is superseded and was not delivered. No simulator/video or full browser pipeline was run. See the [1.3.3 receipt](docs/ipa-1.3.3.json); [1.3.2](docs/ipa-1.3.2.json) and earlier receipts remain historical.

Historical **1.1.0** verification passed **829 tests in 45 suites**, typecheck, lint, **34/34 browser checks** with zero runtime errors/warnings and **9/9 pixel-checker tests**. [Final run 38336957498](https://github.com/b8magic/ForFun/actions/runs/38336957498) also passed all four Maestro journeys on iPhone 17 Pro / iOS 26.5, actual six-table SQLite upgrade, same-day native color pixels, startup and crash checks, then built the unsigned IPA from that same commit. The historical 1.1 IPA and failed automatic prerelease startup are recorded in the handoff. Receipts and provenance are in [Codex handoff](docs/CODEX_HANDOFF.md). Baseline totals are not reused as validation of this branch.

| Area | Verification boundary |
|---|---|
| Model, migrations, durable drafts, periods, stats and calendar engines | Jest uses the same SQL through sql.js and fake native/provider adapters. |
| Actual calendar/day/history/settings/period UI | Eight focused 1.3.3 browser journeys drive counts, persisted deletion/Undo, date controls, the common Sessioni list and draft management. Native picker interaction remains a device check. Previous full-suite evidence remains historical. |
| Native Release app, maps and EventKit export | 1.3.3 native compilation succeeded. No simulator interactions were run for this update; earlier native passes are separate evidence. |
| Installable unsigned IPA | 1.3.3 uses locally verified app inputs followed by IPA-only compilation, with a source manifest and matching package/upload/artifact checksum. Physical iPhone installation remains a device check. |
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
