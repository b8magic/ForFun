# Serie — architecture

Serie is a native iPhone activity log whose identity comes from the *corduroy* trailer. The calendar evolution uses a cream surface by default, visible activity chips, neutral all-activity browsing, persistent logging drafts and separate editing of existing sessions. Home, Storia and Periodi share a calendar vocabulary. UI language is Italian.

Stack: Expo SDK 57, React Native 0.86 New Architecture, TypeScript, Expo Router, React Native Skia 2.6, Reanimated 4.5, Worklets 0.10, Gesture Handler 2.32, expo-sqlite, expo-calendar, Google Calendar REST v3, expo-maps and zustand. Native projects are generated through Continuous Native Generation.

## Composition and navigation

| Surface | Purpose |
|---|---|
| Home / Lineup | With an active activity, **Nuove** selects draft dates and **Modifica** selects saved sessions. Clearing activity focus enables neutral browsing. Month/year headings support direct jumps. |
| Storia | Mese lists populated months with exact summaries and an inline day panel; Anno provides twelve miniature calendars for populated years; Progressi provides derived totals and trends. Filters preserve honest empty states. |
| Day sheet (`/day?date=…`) | Shows every saved session on the date, across activities. Rows open `/session/[id]`; closing returns to the original context. |
| Bulk sheets (`/bulk-day?date=…`, `/bulk`) | The day checklist selects individual same-activity sessions; the details sheet reviews and commits field operations for the exact selected records. |
| Periodi (`/periods`) | Named inclusive ranges with all/selected activity scope, live preview, detail, edit and guarded metadata deletion. |
| Functional sheets | Optional draft details, session editing, activity management, settings, jumps and calendar exchange use the same themed controls. |

In **Nuove**, Home taps toggle the active draft's date even when sessions already exist; long press opens day details without changing the draft. Neutral taps inspect days and cannot create unattributed sessions. In **Modifica**, taps and long presses select only existing sessions of the active activity: one session toggles directly, multiple sessions open the checklist, and days without eligible sessions are disabled. The day sheet's **Nuova sessione** returns to new-session mode and adds the date to the active draft; **Salva** remains the commit action.

Monthly history toggles one inline day panel beneath its month. Rows preview timing, place and the first note line, then open the individual editor; returning preserves the day/filter/scroll. Reveal scrolling measures the entire first row. Changing filter, jumping month or closing its calendar clears that inline selection. Year mosaics navigate to the selected month in Storia; Home and period details open the full day sheet. Saved-session rows support swipe deletion with explicit confirmation.

Routes live under `src/app/`; domain/state/components stay outside the route directory. Expo Router handles sheets; Home/Storia and history-scale changes use app state within the root composition. Activity, period, saved-session and bulk editor dismissal guards cover explicit Close, local back/cancel and native route removal, including sheet gestures. Selection-details edits stay local until **Applica**, which updates only the activity draft; closing that panel discards unapplied edits. Bulk **Salva modifiche** commits existing records immediately. Motion follows the system accessibility setting by default, with a saved user override available. Full/reduced motion share the compact layout; local waves preserve stationary date targets. A persistent activity dock and the Storia header provide the primary navigation.

Activity, period, selection-detail, session-edit and bulk forms use `KeyboardSafe` around the whole sheet so the iOS keyboard moves both scrolling content and the fixed primary footer. Inner scrolling bodies disable automatic keyboard insets to reserve that space once. Android uses its configured window resize behavior. Successful submissions dismiss the keyboard; multiline notes retain ordinary line breaks.

The activity dock measures its viewport, content offset and chip bounds. Selecting a fully visible chip leaves the rail still; a clipped chip is revealed with the smallest required offset. Initial/restart and size changes recheck the current active id, while deliberate horizontal scrolling remains under the user's control. Compact pills retain 44pt touch targets. Home's month list and activity rail both disable UIKit `scrollsToTop`, preventing a status-bar tap from jumping the virtual calendar to January 1900.

## State, persistence and commit boundaries

The UI reads `useApp`. Writes go through `state/actions.ts`, repositories and the database. Stored sessions are the only source of session statistics; exported events, periods and drafts never count as sessions.

An activity draft contains selected dates, applied optional details and a stable save request identifier. Drafts are keyed by stable activity id and persisted independently in `category_drafts`; the active draft is projected into the existing selection/details UI. Switching activities saves/restores the appropriate projection. A successful save commits sessions before clearing only its captured draft. Failures keep it retryable with the same request identifier; deliberate draft changes create a new request. Explicit clear removes dates and details. Deleting an activity removes its draft and cannot expose it through a newly created activity with the same name.

`homeSessionMode` and `bulkSelection` are transient UI state, separate from persisted drafts. Changing mode or active activity clears existing-session selection while retaining new-session drafts. The bulk editor snapshots complete reviewed records and exposes independent **Mantieni / Imposta / Rimuovi** operations for notes, place and timing. `updateSelectedSessions` checks the current mode, activity and exact selected IDs; `sessions.updateDetailsBatch` rechecks each complete record version inside one SQLite transaction. It prepares every target before writing, validates timing against each target date and its DST rules, and rejects missing, moved, stale or invalid records as one batch. IDs, dates, activities and untouched fields remain intact; committed IDs leave the selection.

Bulk writes use `withExportLock`, shared with manual and automatic export on the same database, so an export already in flight finishes first. Local edits do not enqueue exports or rewrite external events. Save-message dismissal is also separate from data mutation: tapping the message or dragging it in any direction closes only that toast; an explicit **Annulla** action performs undo. Short/cancelled drags return to rest, and toast-ID checks prevent outgoing handlers from acting on replacement messages.

Native persistence uses expo-sqlite; web/test persistence uses sql.js and IndexedDB. `SqlDriver` abstracts both. Migrations use `PRAGMA user_version`, retain existing sessions/settings/calendar links and add the draft and named-period tables. Repository checks remain authoritative even when a form already validates the same input.

The last active activity id is persisted and validated at boot. Explicit `null` preserves neutral viewing; an absent preference chooses the first activity, while a deleted remembered id falls back to a remaining activity with a notice. If no activities remain, the app provides the creation path and creating the first activity enables logging. Adding another activity preserves neutral viewing. Saving never accepts a missing activity. Theme, home marker scope and motion preferences are decoded to safe defaults and applied reactively.

## Shared calendar model and drawing

`domain/daySummaries.ts` derives day totals and per-activity contributions once from actual sessions and category order. Home, month history, year history and period mosaics consume this model. Day glyphs show up to four category colors plus a +N overflow indicator, with equal geometric shares for distinct activities. Home and month history add per-activity `×N` badges for repeated sessions; year mosaics retain month-level accessible totals and drill-down. Counts and day details include every contribution. Neutral Home shows all activity colors at full intensity.

The shared month calendar controls date geometry, weekday alignment, future-state semantics, selection, recorded markers and touch targets. Home uses `day-YYYY-MM-DD`; month history uses `mini-YYYY-MM-DD`. Main and history month ids can share `month-YYYY-MM`, so UI tests scope history assertions to `time-place`.

Year mode has one accessible button per month. Populated nonfuture months enable drill-down, empty/future months remain disabled, and lightweight day color bands represent actual activity contributions without creating a Skia canvas per miniature cell. Empty years retain their year/zero summary instead of manufacturing a populated mosaic.

Theme tokens come from `ui/theme.ts`, with `useSurface`/`useThemePref` subscriptions. Shared text, controls, sheets, calendars, maps and management forms react to cream/dark changes. Legacy fixed-tone artwork tokens remain usable where intentional.

Activity colors use 24 presets or continuous HSV/validated HEX controls without remapping saved colors. Contrast-aware foregrounds keep arbitrary colors readable. Identity patterns remain in activity discs and controls rather than determining calendar share geometry.

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

`TimingEditor` uses one numeric duration input, with `durationEntry.ts` handling formatted hours/minutes, paste, caret edits and backspace. Existing second precision survives until the duration itself changes. Searchable IANA timezone selection feeds the same wall-time validation as individual and bulk edits; a bulk timing change must be valid for every selected date.

## Calendar exchange boundaries

`calendar/types.ts` defines the provider interface. Google uses OAuth and Calendar REST v3 with complete pagination, recurrence expansion, labels and private metadata. Apple uses expo-calendar/EventKit with readable/full access, bounded ranges and supported metadata. Providers are created lazily when the feature is first used.

Import targets one activity and reviews source calendars, inclusive range, title-only matching, optional Google labels, recurrence/cancellation and duplicate status. All-day events produce unknown-duration date-only sessions. Multi-day provenance is disclosed. Recognized application metadata restores original timing.

Export reviews selected sessions/destinations, equivalence of Google/iPhone calendars, prefix/base/suffix titles, content inclusion, representation and per-event outgoing edits. Explicit apply-to-session remains separate. Recognition, heuristic matches, linked changes and uncheckable destinations produce appropriate review actions. Persisted operation identities and reconciliation protect retries after partial/uncertain writes.

Automatic export is opt-in, waits until undo is no longer possible, persists jobs, retries temporary failures and exposes ambiguity/unsupported representation for review. Imported sessions are excluded by default and never forwarded back into their source calendar. It runs on foreground/network return and scheduled checks while the app is active; no background delivery guarantee is made.

`EXPO_PUBLIC_SERIE_E2E_CALENDAR=1` selects `calendar/memory.ts` only for an explicitly built test bundle. Browser integration results prove UI + engines + database, not OAuth or EventKit on a physical phone.

## Verification and release

Jest covers pure models, repository SQL/migrations, actions, providers and integration engines. The five browser suites cover core UI, extended flows, calendar exchange and 1.2/1.3 feedback. They freeze **13 October 2026, 12:00 UTC**, keep real timers and fail on every unexpected page error/console error. Browser/CanvasKit screenshots support visual inspection. Native Maestro uses dates from the previous month: flows 01–04 cover Release startup, persistence, drafts, mixed-day editing, maps, EventKit export, settings and periods; flow 05 covers actual status-bar taps, numeric keyboard entry, message swipes, inline history and bulk editing. After the fresh logging fixture, the simulator runner stops its own app, checkpoints its database, snapshots six original tables, drops only additive v2 tables and sets schema v1. Relaunch executes the actual native migration; the gate verifies schema v2, original UI records, full row/identifier equality, foreign keys and SQLite integrity.

`serie-candidate.yml` resolves one full source SHA and gates unit tests, typecheck, lint and all browser suites before calling the reusable simulator workflow. IPA packaging and prerelease publication follow only after simulator smoke success and use the same SHA. Standalone simulator/IPA manual dispatch remains available for downloadable build artifacts; standalone IPA dispatch cannot publish a prerelease. Only the dedicated final release marker on `codex/serie-calendar` triggers the coordinated workflow on push; regular development pushes do not consume macOS build minutes.

`Serie-build.json` and the checksum accompany the IPA. Test evidence is stored in workflow artifacts, temporary local directories and documented screenshot collections under `docs/`. Provenance and actual observed validation results are maintained in [Codex handoff](docs/CODEX_HANDOFF.md).

A simulator cannot prove physical iPhone GPU performance, haptics, VoiceOver, battery behavior, permission prompts, older supported iOS versions or real Google OAuth. Those remain explicit device/integration verification boundaries.
