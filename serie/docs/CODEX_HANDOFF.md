# Codex handoff — Serie calendar evolution

## Provenance

- Original implementation: `0f39ebd14b1f1157eb9d4cf89ba2cb0f57e2c655` (`0f39ebd`). Earlier screenshots and verification counts belong to that baseline.
- Development branch: `codex/serie-calendar`, created locally from the original commit.
- Contribution author/tool: Codex. Final implementation commits use subjects beginning `Codex: …` so a future Claude/Codex reviewer can identify the work through Git history.
- User-approved scope: complete the calendar/appearance/draft/day/history/named-period evolution, preserve existing data and integrations, run meaningful tests, and deliver one final verified GitHub IPA. No release marker is added before local candidate checks pass.

## Main decisions

Home uses a continuous shared calendar with visible activity chips, a sticky month jump, a cream default and a saved dark option. The persistent activity dock and Storia header provide the primary navigation. Full and reduced motion use the same compact layout: waves stay local and date hit targets hold their positions. Day markers are derived from actual session/category contributions; the all/active marker preference changes visibility, never stored sessions. Glyphs show up to four colors plus +N overflow, with every contribution retained in labels/day details. Geometry allocates equal shares to distinct activities; session volume is expressed by recorded counts. Motion defaults to the system accessibility preference. Explicit Close/back controls and native sheet gestures share the same dirty-form protection.

Drafts are persisted per stable activity id with dates, applied optional details and a retry-safe request id. Switch/restart restores each draft; successful save clears only its captured draft. Draft/activity removal cannot leak stale data into another activity.

Main-calendar tap selects a date for logging. Long press or the explicit one-selected-day detail action opens the full actual day across activities. Existing session editing returns to that day, then to its origin. **Nuova sessione** selects the date; it does not save automatically.

History shares month/day drawing, opens populated month calendars immediately, shows twelve small calendars in populated years, disables empty/future year drill-down and uses **Progressi** for all-time analysis. Month history omits empty month rows; year placeholders, filter zeros and unknown durations stay explicit.

Named periods are inclusive metadata filters over actual sessions, using all or selected stable activity ids. Duplicate names/overlap/future endpoints are allowed. Metadata deletion never deletes sessions. Shared dismissal guards and theme subscriptions apply across functional sheets.

Calendar providers/engines remain intact. A separate memory-provider web bundle is used only for automated integration checks. The final release pipeline pins one SHA through Linux gates → native simulator smoke → unsigned IPA; normal development pushes cannot trigger it. Standalone manual IPA dispatch builds artifacts only; publication requires the candidate path. IPA assets include SHA-256 and `Serie-build.json` source/run/app-version provenance; the app version is read from the built native Info.plist and appears in the release title/body. Release tags use globally unique `ipa-<run_id>` identifiers so the new candidate workflow's run-number counter cannot overwrite an original IPA release.

## Validation commands and observed results

Final local verification of the **1.1.0** implementation passed after the far-month navigation fix (`1ed7b00`):

- **829 unit tests in 45 suites**, including the original-data upgrade fixture; the final normal Jest run has no pending timer warning.
- **Typecheck and lint passed** after the implementation changes.
- **34/34 browser checks passed** against the final static normal and memory-provider bundles: core **12/12**, details/settings/periods **13/13**, calendar integration **9/9**.
- All three browser reports contain **zero page errors, console errors or warnings**. Screenshot review covers cream/dark calendars, mixed-activity day markers/details, month/year/progress views, old-year navigation, period previews and session preservation. Dense history bounds/focus behavior were also checked by the history review.

Final local browser evidence: `/tmp/serie-final-e2e/core/`, `/tmp/serie-final-e2e/flows/`, `/tmp/serie-final-e2e/calendar/` (each contains `results.json` and PNGs). Earlier failed-attempt screenshots were removed from these final evidence folders; the separate `/tmp/serie-prefar-e2e/` directory documents the older snapshot and is not final-candidate evidence.

**Native simulator, actual native upgrade execution, IPA packaging and prerelease publication remain pending** until the candidate workflow succeeds. Do not infer those passes from local browser/SQL tests or reuse the original branch’s historical totals.

Completed static checks:

- `node --check tools/e2e-harness.mjs`, `tools/e2e.mjs`, `tools/e2e-flows.mjs` and `tools/e2e-calendar.mjs`: passed.
- `bash -n tools/sim-smoke.sh`: passed.
- PyYAML parsing of all three workflow files and Bash syntax validation of each embedded `run` step: passed.
- PyYAML parsing of six Maestro flow files and local `runFlow` reference checks: passed.
- Native-upgrade helper exercised with the actual repository migrations in a temporary Python SQLite fixture: v1 reconstruction preserved the six original tables, v2 detection/equality checks passed, and a deliberately changed session row was rejected. This validates the helper; actual native driver execution remains pending the simulator run.

Final candidate commands:

```bash
npm test -- --ci --runInBand
npm run typecheck
npm run lint
npm run e2e
```

The browser suites use fixed **2026-10-13 12:00 UTC**, system Chromium when installed, strict unexpected pageerror/console.error failure and separate `core`, `flows`, `calendar` evidence directories under `E2E_SHOTS` or the system temporary `serie-e2e/` directory. Browser plugin unavailable in the implementation environment; Playwright is the recorded fallback.

Native execution requires the GitHub macOS runner or a Mac with Xcode ≥26.4 and Maestro. The candidate workflow captures startup, four native flows, the actual v1 → v2 native driver migration check, crash checks and an installable unsigned IPA from the same SHA. Upgrade mutation is restricted to the three-session database generated by native flow01, in that simulator app’s own container; original row snapshots and native-upgrade logs are kept as evidence. Its run/release URLs and actual final test totals must be recorded here when they exist.

## Remaining limits

Linux browser verification cannot establish native iPhone performance, haptics, VoiceOver, Dynamic Type, physical-device installation or iOS 16/17 behavior. Simulator evidence proves the captured simulator environment only. The three-session native upgrade fixture has empty import/export/job tables; populated exchange-row preservation is covered by the Jest v1 migration fixture. Google OAuth/real calendar REST writes require a configured test account; memory-provider and fetch-mock success do not prove them. Simulator EventKit access is pre-granted and does not verify the initial permission prompt.

Expo SDK57 documentation fetches to `https://docs.expo.dev/versions/v57.0.0/` and the CLI documentation were attempted from the QA environment but denied by its network proxy (403). The QA contribution preserves the existing Expo export/prebuild CLI invocations and adds orchestration around them; no application dependencies were added.

## How to continue or review

Compare `0f39ebd..codex/serie-calendar` and look for `Codex:` commit subjects. Start with `ARCHITECTURE.md`, the additive section in `docs/SPEC.md`, data migrations/repositories/actions, shared calendar components and day/period sheets. Run the local gates before creating/updating `serie/tools/release-candidate.json`. The release marker is the deliberate final build request; do not touch it on routine development pushes.
