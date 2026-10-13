# Serie — architecture

Serie is a native iPhone activity log whose identity comes from the *corduroy* trailer. The calendar evolution uses a cream surface by default, visible activity chips, persistent logging drafts and a shared calendar vocabulary across Home, Storia and Periodi. UI language is Italian.

Stack: Expo SDK 57, React Native 0.86 New Architecture, TypeScript, Expo Router, React Native Skia 2.6, Reanimated 4.5, Worklets 0.10, Gesture Handler 2.32, expo-sqlite, expo-calendar, Google Calendar REST v3, expo-maps and zustand. Native projects are generated through Continuous Native Generation.

## Composition and navigation

| Surface | Purpose |
|---|---|
| Home / Lineup | Select historical dates in the remembered activity and save. The month title stays reachable for direct month/year jumps. Visible activity chips switch the active context. |
| Storia | Mese lists populated months with exact summaries and immediately visible populated calendars; Anno provides twelve miniature calendars for populated years; Progressi provides derived totals and trends. Filters preserve honest empty states. |
| Day sheet (`/day?date=…`) | Shows every actual saved session on the date, across activities. Rows open the existing session editor; closing returns to the original Home/history context. |
| Periodi (`/periods`) | Named inclusive ranges with all/selected activity scope, live preview, detail, edit and guarded metadata deletion. |
| Functional sheets | Optional draft details, session editing, activity management, settings, jumps and calendar exchange use the same themed controls. |

Main-calendar tap always toggles the active draft's date, even when sessions already exist. Long press opens day details without changing the draft. A visible details control is available when one date is selected. History date taps open the full day sheet. The day sheet's **Nuova sessione** only adds the date to the active draft and returns; saving is still explicit.

Routes live under `src/app/`; domain/state/components stay outside the route directory. Every navigational transition uses Expo Router. Activity, period and saved-session editor dismissal guards cover explicit Close, local back/cancel and native route removal, including sheet gestures. Selection-details edits stay local until Applica; closing that panel discards unapplied edits, preserving the previously applied activity draft. Motion follows the system accessibility setting by default, with a saved user override available. Full/reduced motion share the compact layout; local waves preserve stationary date targets. A persistent activity dock and the Storia header provide the primary navigation.

Activity, period, selection-detail and session-edit forms use `KeyboardSafe` around the whole sheet so the iOS keyboard moves both scrolling content and the fixed primary footer. Inner scrolling bodies disable automatic keyboard insets to reserve that space once. Android uses its configured window resize behavior. Successful submissions dismiss the keyboard; multiline notes retain ordinary line breaks.

The activity dock measures its viewport, content offset and chip bounds. Selecting a fully visible chip leaves the rail still; a clipped chip is revealed with the smallest required offset. Initial/restart and size changes recheck the current active id, while deliberate horizontal scrolling remains under the user's control.

## State, persistence and commit boundaries

The UI reads `useApp`. Writes go through `state/actions.ts`, repositories and the database. Stored sessions are the only source of session statistics; exported events, periods and drafts never count as sessions.

An activity draft contains selected dates, applied optional details and a stable save request identifier. Drafts are keyed by stable activity id and persisted independently in `category_drafts`; the active draft is projected into the existing selection/details UI. Switching activities saves/restores the appropriate projection. A successful save commits sessions before clearing only its captured draft. Failures keep it retryable with the same request identifier; deliberate draft changes create a new request. Explicit clear removes dates and details. Deleting an activity removes its draft and cannot expose it through a newly created activity with the same name.

Native persistence uses expo-sqlite; web/test persistence uses sql.js and IndexedDB. `SqlDriver` abstracts both. Migrations use `PRAGMA user_version`, retain existing sessions/settings/calendar links and add the draft and named-period tables. Repository checks remain authoritative even when a form already validates the same input.

The last active activity id is persisted and validated at boot. A missing id falls back to a valid remaining activity with a notice; if no activities remain, the app provides the creation path. Saving never accepts a missing activity. Theme, home marker scope and motion preferences are decoded to safe defaults and applied reactively.

## Shared calendar model and drawing

`domain/daySummaries.ts` derives day totals and per-activity contributions once from actual sessions and category order. Home, month history, year history and period mosaics consume this model. Day glyphs show up to four category colors plus a +N overflow indicator, with equal geometric shares for distinct activities. Recorded counts express session volume. Counts, accessible labels and full day details include every contribution; color alone is never the only session information.

The shared month calendar controls date geometry, weekday alignment, future-state semantics, selection, recorded markers and touch targets. Home uses `day-YYYY-MM-DD`; month history uses `mini-YYYY-MM-DD`. Main and history month ids can share `month-YYYY-MM`, so UI tests scope history assertions to `time-place`.

Year mode has one accessible button per month. Populated nonfuture months enable drill-down, empty/future months remain disabled, and lightweight day color bands represent actual activity contributions without creating a Skia canvas per miniature cell. Empty years retain their year/zero summary instead of manufacturing a populated mosaic.

Theme tokens come from `ui/theme.ts`, with `useSurface`/`useThemePref` subscriptions. Shared text, controls, sheets, calendars, maps and management forms react to cream/dark changes. Legacy fixed-tone artwork tokens remain usable where intentional.

## Named periods

`domain/namedPeriods.ts` validates and selects sessions for named ranges. `named_periods` stores metadata and `named_period_categories` stores selected scope identifiers. All-activity scope includes later-created activities automatically. Selected scope uses identifiers rather than names; deleted activities do not silently widen that scope.

Dates are inclusive, valid calendar dates at or after the supported earliest date, and ordered start ≤ end. Periods may overlap, may share names and may extend into the future. These rules do not allow logging future sessions. Period totals sum actual included sessions, distinct active dates and known durations with coverage. Editing/deleting a period changes only metadata; session rows and external events remain intact.

Period previews use the same calculations as stored details. Large period session lists use day grouping/virtualization; readonly preview rows do not open editors accidentally. A full day can be opened from a period and uses the existing session editor.

## Data integrity

- Session dates are `YYYY-MM-DD`. Timing stores wall times, an IANA zone and an explicit next-day flag; intervals are calculated with DST rules.
- Unknown duration is `null`. Sum only known integer seconds before display rounding. Averages exclude unknown durations and show contributing counts. Zero known values produce “Nessuna durata registrata.”
- Date-only, start-only, interval, duration-only and start + duration states remain distinct. An export-only scheduling span never becomes activity duration.
- Multiple sessions on one date are valid. Duplicate save requests are constrained by request id/date, while a deliberate second save uses a new request.
- Optional details applied to several dates are copied per session and are independently editable later.
- Session, activity and period editors guard unsaved changes. Destructive session/activity actions retain their explicit safeguards; period deletion states that sessions will remain.
- External calendar events remain intact when local sessions are deleted. Activity renaming never rewrites outgoing events automatically.

## Calendar exchange boundaries

`calendar/types.ts` defines the provider interface. Google uses OAuth and Calendar REST v3 with complete pagination, recurrence expansion, labels and private metadata. Apple uses expo-calendar/EventKit with readable/full access, bounded ranges and supported metadata. Providers are created lazily when the feature is first used.

Import targets one activity and reviews source calendars, inclusive range, title-only matching, optional Google labels, recurrence/cancellation and duplicate status. All-day events produce unknown-duration date-only sessions. Multi-day provenance is disclosed. Recognized application metadata restores original timing.

Export reviews selected sessions/destinations, equivalence of Google/iPhone calendars, prefix/base/suffix titles, content inclusion, representation and per-event outgoing edits. Explicit apply-to-session remains separate. Recognition, heuristic matches, linked changes and uncheckable destinations produce appropriate review actions. Persisted operation identities and reconciliation protect retries after partial/uncertain writes.

Automatic export is opt-in, waits until undo is no longer possible, persists jobs, retries temporary failures and exposes ambiguity/unsupported representation for review. Imported sessions are excluded by default and never forwarded back into their source calendar. It runs on foreground/network return and scheduled checks while the app is active; no background delivery guarantee is made.

`EXPO_PUBLIC_SERIE_E2E_CALENDAR=1` selects `calendar/memory.ts` only for an explicitly built test bundle. Browser integration results prove UI + engines + database, not OAuth or EventKit on a physical phone.

## Verification and release

Jest covers pure models, repository SQL/migrations, actions, providers and integration engines. Browser suites freeze **13 October 2026, 12:00 UTC**, keep real timers and fail on every unexpected page error/console error. Browser/CanvasKit screenshots support visual inspection. Native Maestro uses dates from the previous month and checks Release startup, persistence, drafts, mixed-day editing, maps, EventKit export, settings and period integrity. After the fresh logging fixture, the simulator runner stops its own app, checkpoints its database, snapshots six original tables, drops only additive v2 tables and sets schema v1. Relaunch executes the actual native migration; the gate verifies schema v2, original UI records, full row/identifier equality, foreign keys and SQLite integrity.

`serie-candidate.yml` resolves one full source SHA and gates unit tests, typecheck, lint and all browser suites before calling the reusable simulator workflow. IPA packaging and prerelease publication follow only after simulator smoke success and use the same SHA. Standalone simulator/IPA manual dispatch remains available for downloadable build artifacts; standalone IPA dispatch cannot publish a prerelease. Only the dedicated final release marker on `codex/serie-calendar` triggers the coordinated workflow on push; regular development pushes do not consume macOS build minutes.

`Serie-build.json` and the checksum accompany the IPA. Test evidence is stored in workflow artifacts and temporary local directories, rather than application source. Provenance and actual observed validation results are maintained in [Codex handoff](docs/CODEX_HANDOFF.md).

A simulator cannot prove physical iPhone GPU performance, haptics, VoiceOver, battery behavior, permission prompts, older supported iOS versions or real Google OAuth. Those remain explicit device/integration verification boundaries.
