# Calendar exchange (`src/calendar/`)

Import from and export to **Google Calendar** (OAuth + REST v3) and **Apple / iPhone calendars** (EventKit via expo-calendar 57), plus opt-in automatic export after saving. Acceptance criteria: `docs/SPEC-calendar.md`. User-facing strings are Italian.

The UI imports from the facade, `@/calendar` (`index.ts`). The engines are pure TypeScript, tested against fake providers and real SQLite (sql.js) repositories. Only the provider adapters, `registry.ts`, `autoRuntime.ts` and `authRedirect.web.ts` touch Expo or React Native.

## Layout

| File | Role | Expo / RN |
|---|---|---|
| `types.ts` | Contracts: `CalendarProvider`, `ExternalEvent`, `EventDraft`, `AppEventMeta`, `ProviderError` | no |
| `index.ts` | **Facade for the UI** (see below) | no (lazy inline requires) |
| `registry.ts` | One Google + one Apple provider, created on first calendar use; the in-memory test provider when `EXPO_PUBLIC_SERIE_E2E_CALENDAR=1` | lazy |
| `autoRuntime.ts` | App glue for automatic export: commit hook, runs after the undo window, on foreground, network return and every minute while jobs are open | yes |
| `authRedirect.ts` / `.web.ts` | App-start hook that closes the Google sign-in popup on web; does nothing on native | web only |
| `importEngine.ts` | Filters → review list (statuses, timing mapping, provenance) → one-transaction commit | no |
| `exportEngine.ts` | Manual export: destination read → plan (per destination) → review edits → execute | no |
| `autoExport.ts` | Automatic export: config, validation, planning, durable jobs, runner, review actions | no |
| `exportCore.ts` | Rules **shared by both export engines** (see below) | no |
| `representation.ts` | Session → outgoing event (timing representation, title, notes, location, metadata), snapshots | no |
| `duplicates.ts` | Duplicate classes against the real destination | no |
| `titles.ts` | prefix + base + suffix, overrides, reset | no |
| `equivalence.ts` | Same underlying calendar through Google and iPhone? ("Both" gate) | no |
| `opId.ts` | Deterministic operation ids (session × destination) | no |
| `appMeta.ts` | `AppEventMeta` validator and canonical form shared by every reader and writer | no |
| `memory.ts` | In-memory provider for automated web UI checks only (fixtures labelled "prova") | no |
| `google/` | Google provider ([README](google/README.md)) | adapters only |
| `apple/` | EventKit provider ([README](apple/README.md)) | adapters only |

## How the pieces fit

```
UI (src/sheets/calendar) ──► index.ts
  import   provider.listEvents ─► importEngine.buildReview ─► commitImport ─► sessions + provenance
  export   exportCore.readDestinationEvents ─┐
           representation.buildEventDraft ───┼─► duplicates.classifyDuplicates ─► exportEngine (plan → execute)
           opId.exportOpId ──────────────────┘                                 └► autoExport (jobs → runJobs)
  writes   provider.createEvent / updateEvent ─► export link (+ snapshot) / export job
  reads    providers decode AppEventMeta with appMeta.parseAppMeta ─► import / duplicates recognise Serie's events
```

### One set of rules for manual and automatic export

Both engines can write the same session to the same calendar, so they share every rule that decides what is written or recognised. Nothing is copied between them:

| Rule | Where |
|---|---|
| Operation id: same session × same calendar → same id | `opId.exportOpId` (the only builder) |
| Outgoing event: title, notes, location, timing, metadata | `representation.buildEventDraft` |
| Duplicate classes: linked, recognised, possible duplicate, not checked | `duplicates.classifyDuplicates` |
| Destination read: window around the session and outgoing dates (`paddedWindow`), plus this session's linked / import-source events outside it | `exportCore.readDestinationEvents` |
| A failed create that may still have landed (anything but a proven refusal: unauthorized, forbidden, not found, invalid, rate limited) leaves the job `uncertain`; the next attempt by **either** engine looks it up with `findByOpId` first | `exportCore.writeMayHaveApplied` |
| Linking an existing event records Serie's own metadata when the event is this session's export, else the session's timing | `exportCore.linkSnapshot` |
| Account comparison (Google: case and Gmail dots folded; Apple: exact) | `exportCore.sameAccountId` |
| One export run at a time per database: `executePlan` and `runJobs` never interleave, so neither creates an event the other is creating | `exportCore.withExportLock` |
| A manual export that takes over an open automatic job records where it wrote, so the runner reconciles there | `exportCore.noteAttemptOnPayload` |

The engines deliberately differ in one place: who decides. The manual review asks the user per row. Automatic export has no user, so it only stores a link for Serie's own event, and sends possible duplicates, unreadable calendars, unapproved representations and ambiguous "Both" pairs to "Da rivedere".

### `AppEventMeta`

Serie writes `{ v, sessionId, opId, timingState, durationSec, durationSource, schedulingPlaceholder }` into every event it exports:

- Google stores it in `extendedProperties.private` (`serie_*` keys), and `findByOpId` searches `serie_op=<id>`.
- Apple stores it in the URL field as `serie://export?m=<base64url JSON>`. When the user's own URL is already there, it goes in a trailing notes line instead.

`appMeta.parseAppMeta` is the single validator, used by both providers and the import engine. `canonicalAppMeta` is the form every writer serialises, so what one side writes, every reader returns unchanged. Malformed or inconsistent metadata counts as no metadata, so it never restores timing and never claims an event as Serie's. The metadata always carries the **true** recorded timing. A span that exists only for the calendar sets `schedulingPlaceholder`, so a re-import never turns it into hours.

## Facade (`@/calendar`)

Async helpers take an optional `deps?: { repos?, providers? }`. By default they use the app database and the registry, which are loaded only on first use: importing the facade loads no native module and prompts for nothing.

```ts
// providers & connections (never prompt, except connectProvider)
getProviders(): Promise<Record<ProviderKind, CalendarProvider>>
getProvider(kind, deps?): Promise<CalendarProvider>
getConnections(deps?): Promise<Record<ProviderKind, Connection>>           // failures → 'unavailable' + reason
connectProvider(kind, access: 'read' | 'readwrite', deps?): Promise<Connection>
disconnectProvider(kind, deps?): Promise<Connection>
canReadEvents(conn): boolean            canWriteEvents(conn): boolean      // write-only is never "readable"
listCalendarsFor(need: 'read' | 'write', deps?): Promise<CalendarListing>  // calendars, labels, labelsSupported, errors

// import: filters → review → commit
loadImportReview(req: ImportReviewRequest, deps?): Promise<ReviewItem[]>
  // + defaultSelection, toggleSelected, selectAll / deselectAll (scoped), selectionCounts, reconcileSelection
commitImportSelection(req: ImportCommitRequest, deps?): Promise<CommitImportResult>

// export: plan → execute
loadExportReview(req: ExportReviewRequest, deps?): Promise<ExportReview>   // { plan, data }
rebuildExportPlan(prev: ExportPlan | null, req, data: ExportReviewData): ExportPlan  // keeps row choices
  // + setRowChoice, setSelection, exportSelectionCounts, overrideToSessionPatch
executeExport(plan, opts?: { signal?, onProgress?, now? }, deps?): Promise<ExecuteResult>

// automatic export
getAutoExportConfig(deps?)  setAutoExportConfig(config, deps?)  checkAutoExportConfig(config, deps?)
enqueueAfterSave(sessions): Promise<void>        // app runtime; never throws into a save
runAutoExportNow(): Promise<void>                startAutoExportRuntime(): Promise<() => void>
turnOffAutoExport({ cancelPending }, deps?)      // never deletes exported events
listExportJobs(deps?): Promise<{ jobs, summary }>
resolveExportJob(jobId, action: ReviewAction, deps?): Promise<ExportJobRecord>
```

The pure engine functions (`buildExportPlan`, `validateConfig`, `gateBothDestinations`, `summarizeJobs`, …) and their types are re-exported unchanged. Today the wizards still import the engine modules directly; `loadExportReview` also passes import provenance to the destination read, which `ExportWizard` does not do yet (see risks).

## Verified by tests (Linux container)

`npx jest src/calendar src/maps` → **24 suites, 590 tests, all passing**. `npx tsc --noEmit` reports no errors, and `npx eslint src/calendar src/maps` reports no problems.

- **Engines:** `importEngine`, `exportEngine`, `autoExport`, `duplicates`, `representation`, `titles` and `equivalence` run against fake providers and sql.js repositories. They cover:
  - the four timing states plus start + declared duration, never invented hours, DST fall-back ends;
  - title-only filtering, the label and calendar scope, recurring occurrences, cancelled exclusion and multi-day mapping;
  - possible duplicates (never by date alone), idempotent retries and uncertain-write reconciliation;
  - the "Both" equivalence gate, offline / rate-limit / unauthorized backoff, and cancellation during a run.
- **Cross-module** (`crossModule.test.ts`):
  - For every timing state, a draft round-trips with identical metadata through Google (insert body → API echo → normalised event) and Apple (URL field and notes trailer → EventKit fields → normalised event) and through the in-memory provider.
  - Import restores the recorded timing from either provider, and the duplicate check recognises the event by op id.
  - Every reader rejects the same malformed metadata.
  - Manual and automatic export produce the same op ids, never queue each other's exports again, share the failed-write rule (including a manual takeover of an automatic job), record identical link snapshots, compare accounts the same way and never run at the same time.
- **Facade** (`facade.test.ts`): it loads nothing native on import, delegates to the engines, and reports missing or failing providers as `unavailable`. Import commits once per batch; export passes provenance and an unreadable destination is "not checked".
- **Providers** (`google/__tests__`, `apple/__tests__`):
  - Google: OAuth logic (scopes, refresh, revoke, races, timeouts), pagination and time-range completeness, error mapping, normalisation and the metadata codec.
  - Apple: EventKit mapping against a fake modelled on expo-calendar 57's API and native behaviour (write-only access, Expo Go stub, the legacy lookup, all-day ends, occurrence keys).
- **Web UI flow:** `tools/build-web.sh --e2e && node tools/e2e-calendar.mjs` drives import, export and automatic export in headless Chromium against the in-memory "prova" calendars: 9/9 checks pass with this code. This proves the UI, the engines and the local database together. It does not prove Google or EventKit.

## Only verifiable on a device or with OAuth credentials

**Google** (needs a Google Cloud project, an iOS OAuth client id in `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, the reversed client id as an iOS URL scheme, and a development build; see `google/README.md`):

- The real consent screen, including granular scope unticking (`write_only`), refresh-token expiry in *Testing* mode (7 days), revocation and Keychain storage.
- Live API behaviour:
  - full pagination over multi-year ranges;
  - `privateExtendedProperty` search latency right after an insert;
  - acceptance of fixed-offset zones (`Etc/GMT-1`) for DST fall-back ends;
  - real 5xx / 429 / 403 bodies;
  - colour ids on shared calendars.
- Whether Google keeps accepting the reversed-client-id redirect for iOS clients (its docs now discourage custom schemes).

**Apple / EventKit** (needs an EAS development build or TestFlight on iOS ≥ 16.4; Expo Go is reported as unavailable):

- The permission prompts and Info.plist strings, plus iOS 17 full versus write-only access, including a downgrade in Settings.
- Whether the URL-field metadata survives iCloud, CalDAV and Exchange sync.
- `calendarItemIdentifier` lookups after an app restart, and event ids after an iCloud re-sync.
- Recurring occurrence updates, and alarms cleared on update.
- Time zones: expo-calendar exposes only an abbreviation, so wall times are shown in the device zone.
- How a Google calendar appears in the iPhone store: the equivalence heuristics (account and source names) need real accounts.

**General:** background behaviour. Jobs run only while the app is open; there is no background fetch. Real network transitions (`expo-network`) and Keychain availability before the first unlock also need a device.

## Remaining risks and known limitations

**Recognising events**

- **Duplicate if Google's search lags.** If an uncertain Google insert is not yet visible to `findByOpId`, a retry can create a second event. A client-supplied event id derived from the op id would close this, but it changes create / "create separately" semantics and needs a product decision.
- **Start-only exports.** The metadata cannot tell an approved scheduling span (a real start) from a calendar-only time. Import keeps the event's start. Telling them apart needs a new `AppEventMeta` field in `types.ts`.
- **No etag on `ExternalEvent`.** An explicit update is protected only between re-reading the event and writing it, not since the user reviewed it.

**UI and app code outside this folder**

- **`ExportWizard`** reads provenance but does not pass it to `loadAllDestinationEvents`. A moved source event therefore cannot be offered for linking, although no create is ever proposed by default. Using `loadExportReview` fixes this.
- **The `serie://export?m=…` link** that EventKit shows opens Serie on Expo Router's unmatched-route screen. It needs a `+native-intent` route or a redirect in `src/app`.
- **"Turn off but keep queued jobs"** still runs those jobs, and the UI says so. The spec's "turning it off stops future writes" needs a product decision.

**Accounts and calendars**

- **Write-only Google consent** cannot list calendars, so no export destination can be chosen.
- **Exchange accounts** with a different address stay "distinct" even with the same calendar name.
- **Google + Apple pairs inside the engine:** the engine itself does not refuse a pair that is the same underlying calendar; the wizard blocks it before calling the engine.

**Import data**

- **Re-import after deletion** keeps the provenance's original title and source span from the first import (the repository upsert).
- **Restored own exports** get a new session id.
