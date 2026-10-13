# Codex handoff — Serie calendar evolution

## Provenance

- Original implementation: `0f39ebd14b1f1157eb9d4cf89ba2cb0f57e2c655` (`0f39ebd`). Earlier screenshots and verification counts belong to that baseline.
- Development branch: `codex/serie-calendar`, created locally from the original commit.
- Contribution author/tool: Codex. Final implementation commits use subjects beginning `Codex: …` so a future Claude/Codex reviewer can identify the work through Git history.
- User-approved scope: complete the calendar/appearance/draft/day/history/named-period evolution, preserve existing data and integrations, run meaningful tests, and deliver one final verified GitHub IPA. No release marker is added before local candidate checks pass.

## Main decisions

The user-facing Italian decision register is [DECISIONI.md](DECISIONI.md). It records the recommended choices that can be revisited after device testing, without blocking the single-version delivery.

Home uses a continuous shared calendar with visible activity chips, a sticky month jump, a cream default and a saved dark option. The persistent activity dock and Storia header provide the primary navigation. Full and reduced motion use the same compact layout: waves stay local and date hit targets hold their positions. Day markers are derived from actual session/category contributions; the all/active marker preference changes visibility, never stored sessions. Glyphs show up to four colors plus +N overflow, with every contribution retained in labels/day details. Geometry allocates equal shares to distinct activities; session volume is expressed by recorded counts. Motion defaults to the system accessibility preference. Explicit Close/back controls and native sheet gestures share the same dirty-form protection.

Drafts are persisted per stable activity id with dates, applied optional details and a retry-safe request id. Switch/restart restores each draft; successful save clears only its captured draft. Draft/activity removal cannot leak stale data into another activity.

Main-calendar tap selects a date for logging. Long press or the explicit one-selected-day detail action opens the full actual day across activities. Existing session editing returns to that day, then to its origin. **Nuova sessione** selects the date; it does not save automatically.

History shares month/day drawing, opens populated month calendars immediately, shows twelve small calendars in populated years, disables empty/future year drill-down and uses **Progressi** for all-time analysis. Month history omits empty month rows; year placeholders, filter zeros and unknown durations stay explicit.

Named periods are inclusive metadata filters over actual sessions, using all or selected stable activity ids. Duplicate names/overlap/future endpoints are allowed. Metadata deletion never deletes sessions. Shared dismissal guards and theme subscriptions apply across functional sheets.

Calendar providers/engines remain intact. A separate memory-provider web bundle is used only for automated integration checks. The final release pipeline pins one SHA through Linux gates → native simulator smoke → unsigned IPA; normal development pushes cannot trigger it. Standalone manual IPA dispatch builds artifacts only; publication requires the candidate path. IPA assets include SHA-256 and `Serie-build.json` source/run/app-version provenance; the app version is read from the built native Info.plist and appears in the release title/body. Release tags use globally unique `ipa-<run_id>` identifiers so the new candidate workflow's run-number counter cannot overwrite an original IPA release.

## Validation commands and observed results

Final local verification of the **1.1.0** implementation passed after the far-month navigation fix (`1ed7b00`), native keyboard/footer correction (`8a1896f`) and activity-dock reveal correction (`21e9164`):

- **829 unit tests in 45 suites**, including the original-data upgrade fixture; the final normal Jest run has no pending timer warning.
- **Typecheck and lint passed** after the implementation changes.
- **34/34 browser checks passed** against the final static normal and memory-provider bundles: core **12/12**, details/settings/periods **13/13**, calendar integration **9/9**.
- All three browser reports contain **zero page errors, console errors or warnings**. Screenshot review covers cream/dark calendars, mixed-activity day markers/details, month/year/progress views, old-year navigation, period previews and session preservation. Dense history bounds/focus behavior were also checked by the history review.

Final local browser evidence: `/tmp/serie-dock-confirmed-e2e/core/`, `/tmp/serie-dock-confirmed-e2e/flows/`, `/tmp/serie-dock-confirmed-e2e/calendar/` (each contains `results.json` and PNGs). All 34 checks passed with zero browser errors/warnings against regenerated static bundles. Focused probes passed **4/4** forms at 375×500, preserving multiline notes and direct footer taps (`/tmp/serie-keyboard-fix/focused-forms/`), and **4/4** activity-dock checks for draft switches/restart, offscreen activity reveal, resizing and preserved manual scrolling (`/tmp/serie-native-third-review/dock-fixed/`). The earlier `/tmp/serie-keyboard-confirmed-e2e/`, `/tmp/serie-final-e2e/` and `/tmp/serie-prefar-e2e/` directories document older snapshots; the interrupted `/tmp/serie-keyboard-prefinal-e2e/` run was deliberately stopped when the final web-focus correction arrived and is not final-candidate evidence.

**The full native simulator gate, IPA packaging and prerelease publication remain pending** until the candidate workflow succeeds. Logging/drafts/restart/day/history and actual native six-table upgrade checks passed in candidate four, as recorded below; maps, export with the intended fixture and periods still need a successful complete gate. Do not infer those passes from local browser/SQL tests or reuse the original branch’s historical totals.

The first candidate run (`38320706064`, source `6d60f7c`) passed all Linux gates and the native Release build. Startup remained running, no crash reports were found, and native EventKit export passed. The notes journey stopped because Maestro's generic `hideKeyboard` could not dismiss a multiline input; dependent map/period journeys then lacked their fixtures. The automation now submits those notes through the existing keyboard-safe Apply/Save footer and uses Enter for single-line period fields. Assertions and inputs are preserved. Dependent native journeys explicitly report `NOT_RUN` and fail the gate if their fixtures are unavailable. Small native PNG previews are included in logs as well as full artifact originals because workspace access to the connector's File Service ZIP URL returned HTTP 403. This is diagnostic output only and cannot change test outcomes.

The second candidate (`38323259409`, source `362853f`) passed all Linux gates and native compilation but revealed a real form-layout defect: the iOS notes keyboard covered the fixed Apply footer. Its native failure PNG proves the selection-details sheet stayed open, so `activity-Corsa` was unavailable. Selection-details and session-edit forms now use the same whole-sheet `KeyboardSafe` container as activity/period forms; inner scroll views no longer add duplicate keyboard insets, valid submissions dismiss the keyboard and Android keeps its window-resize behavior. Native flow01 records the visible keyboard/footer before Apply, and submit checks wait for the old form to disappear. The EventKit flow now requires the intended Corsa/map fixture: earlier isolated `Creati: 2` passes establish provider export only, since they exported Surf after logging failed. A final successful candidate is still required; no IPA was published from either failed run.

The third candidate (`38325879641`, source `c39db895`) passed all Linux gates and native compilation. Its iOS screenshot confirms the corrected Apply footer is visible above the keyboard and notes submission succeeds. Flow01 later stopped after a missed Surf selection: the dock forcibly aligned Corsa to its left edge, putting Surf's center outside the rail viewport. Exact browser bounds reproduced the clipping at 375/390/402/430 pixels; the existing browser helper had automatically revealed the chip before tapping. `21e9164` fixes the actual UI behavior by preserving visible chips and revealing only clipped selections, including on initial/restart/layout callbacks. Native flow01 now verifies all five switches and the restored Surf draft before stopping, in addition to every unchanged post-restart check. The controlled native-driver data probe found FIFO writes and exact restoration of both drafts; no data-ordering change was warranted. Its optimistic activity label is not a SQLite commit barrier, so post-restart assertions remain the persistence proof. No IPA was published from this failed run.

Candidate four (`38328590069`, source `36f5c2d`) passed all Linux gates, native Release compilation, the entire native logging/draft/restart/mixed-day/detail/history/year/Progressi flow and the actual native v1 → v2 migration check. All six original tables retained exact rows/identifiers, SQLite integrity and foreign keys passed, and no crashes were found. Flow02 then stopped at its first map-caption check: the failure screenshot shows Home with applied place details. Compact-sheet bounds reproduce the link-field center overlapping Apply after the name label and Clear footer appear; this was an automation tap on a clipped field. The native flow now pans the actual scrolling body, confirms exact input values, verifies Details stays open, and pans from the link field to reveal the caption without dragging AppleMaps itself. Both original map-caption checks and all session-count/save checks are retained. The only application change is a `details-scroll` test id on the existing ScrollView, with no layout/data behavior change. Typecheck, lint, native YAML/AST and exact-URL assertion checks pass. No IPA was published from candidate four; a complete final candidate remains required.

Candidate five (`38331188931`, source `1871fe6`) passed all Linux gates, native Release compilation, the complete native logging flow and actual six-table native upgrade again. Its map flow stopped at a newly added Maestro `focused: true` predicate before entering the place name. The failure PNG shows the actual native text field with its caret, focus underline and keyboard: the iOS accessibility focus metadata is a false negative in this environment. The automation now proves input routing through the exact entered name and complete URL, alongside the still-open Details sheet; both native map captions and all save/count checks remain mandatory. This correction changes automation and diagnostics only. No IPA was published from candidate five.

Completed static checks:

- `node --check tools/e2e-harness.mjs`, `tools/e2e.mjs`, `tools/e2e-flows.mjs` and `tools/e2e-calendar.mjs`: passed.
- `bash -n tools/sim-smoke.sh`: passed.
- PyYAML parsing of all three workflow files and Bash syntax validation of each embedded `run` step: passed.
- PyYAML parsing of six Maestro flow files and local `runFlow` reference checks: passed.
- Native-upgrade helper exercised with the actual repository migrations in a temporary Python SQLite fixture: v1 reconstruction preserved the six original tables, v2 detection/equality checks passed, and a deliberately changed session row was rejected. Actual native driver execution also passed on candidate four; the final candidate repeats that same check.

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
