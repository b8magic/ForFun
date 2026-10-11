# Serie — architecture

Serie is a surf log built from swell lines. Each week is a line, each session is a crest on it, and saving makes the lines break like a wave. The visual identity, motion grammar, typography and palette come from the *corduroy* trailer (`../trailer`, `../trailer/DESIGN_LANGUAGE.md`). App UI language: **Italian**.

Stack: Expo SDK 57 · React Native 0.86 (New Architecture) · TypeScript · Expo Router · React Native Skia 2.6 · Reanimated 4.5 + Worklets 0.10 · Gesture Handler 2.32 · expo-sqlite · expo-calendar · Google Calendar REST v3 · expo-maps (Apple Maps on iOS) · zustand.

## 1. The composition

The app is one living composition with two **surfaces**, not a stack of screens.

| Surface | Ground | Purpose |
|---|---|---|
| **Lineup** (`REGISTRA`) | Ink (night) | Log: active activity, living calendar, Save. Opens here, in the last-used activity, every launch. |
| **Time** (`STORIA`) | Bone (calm) | History at three scales: **Mese** (month mode), **Anno** (year mode), **Tutto** (all time + progress). |

Moving Lineup → Time is the "white water" transformation: the week-lines compress, ink floods to bone and the lines reorganise into month ridgelines. Changing scale (Mese → Anno → Tutto) zooms the same ridgelines in and out. Functional tools (session editor, activity management, calendar exchange) open as iOS form sheets dressed in the same identity.

### Lineup layout (portrait iPhone, points)
- Header row: **identity disc + activity name + chevron** (Moment A trigger, always visible, `accessibilityRole="button"`, label "Attività attiva: Surf. Tocca per cambiare attività."). Right: menu glyph (three swell lines).
- Month title (display condensed) + year, previous/next chevrons, tap title → month/year jump dial. "Torna a oggi" chip when away from the current month.
- Weekday initials `L M M G V S D` (Monday first).
- 5–6 **week-lines**. Days sit on their line: numeral above, tick on the line. Recorded sessions = foam rings on a small permanent bump; several sessions on a date = stacked rings + count. Selected = the line lifts into a **crest** carrying a flare dot; the numeral rides the crest.
- `+ NOTA · LUOGO · ORARIO  (FACOLTATIVO)` link → optional details for the current selection (never required).
- **Save** control: pill whose flare liquid rises with each selection; label "Salva N sessioni"; disabled with "Seleziona le date" when empty.
- Bottom: history handle (ridgeline of the last 8 weeks + `STORIA`), tap → Time.

## 2. Signature interactions

**A · Switch activity.** Tap the disc: week-lines draw back and rise into an arc; the activity discs ride the arc with their names (RN text); the current one is marked selected. Selecting another disc flows it into the header and its stripes pour back into the week-lines recoloured with its pattern. Remembered id is persisted immediately. Selection of dates is cleared on switch (never carried across activities). Fully interruptible; reduced motion = cross-fade.

**B · Select dates.** Tap toggles a date. Press = the line dips (resistance), release = crest rises on the `crest` spring and sends a ripple along its line and into neighbours; global tension (line undulation, liquid level) grows with the number of selected dates. Future dates are disabled. Month swipe = a swell passing (lines slide with a wave). Selection persists across month navigation within the activity; a counter shows how many are selected overall.

**C · Save.** `await repository.saveSessions(...)` (single transaction, idempotent request id) **then** the break: drawback → the lines rise into a curling wave (turtle-curve generator ported from the trailer) → dots ride the lip → dots fly into the history handle, whose ridgeline gains the new peaks. A confirmation toast ("4 sessioni salvate · Surf", with **Annulla** for a few seconds). A tap on a date during the break fast-forwards it and selects that date. Undo ends the break. On failure there is no wave: crests stay selected, an inline error appears, VoiceOver announces it, and Save becomes **Riprova** (same request id, so it can't duplicate). With reduced motion the calendar just settles with the new rings. Haptics: light impact per crest, success notification on save.

## 3. Motion grammar (src/motion/grammar.ts)
Phases → curves: swell (sine in-out), build (cubic in), crest (back-out), break (expo in-out), flow (quint out), settle (damped spring ζ≈0.36–0.55). Hierarchy: touch 90–160 ms < flow 520 ms < transform 760 ms < break ≈1.7 s. Readable content holds still. Every animation is a function of state + time (interruptible, continues from the current value). Reduced motion (system setting, overridable in Impostazioni): no ripples/ambient drift, transformations become ≤180 ms cross-fades, all states remain visible.

## 4. Module map

```
src/
  app/               Expo Router routes (thin): _layout, index (composition), sheets
  domain/            pure TS: types, dates, zoned time, timing, duration, stats, milestones, history grouping
  data/              SqlDriver interface + expo-sqlite (native) / sql.js (web, tests) drivers, migrations, repositories
  calendar/          provider interface, google/, apple/, equivalence, import & export engines, titles, representation, duplicates, jobs
  maps/              Google Maps link parser + resolver, map preview
  motion/            grammar, water displacement worklets, wave generator
  graphics/          Skia components (disc, week-lines, liquid pill, wave, ridgelines, corduroy field)
  places/            Lineup, Switcher, Time (Mese/Anno/Tutto)
  sheets/            session editor, selection details, activities, calendar exchange flows
  state/             zustand store, actions, selectors
  ui/                theme tokens, text components, controls in the identity
  i18n/              Italian strings
  platform/          haptics, network, app state, ids, clock
```

Rules: `domain/` and the calendar engines are pure and fully unit-tested; UI never talks to SQLite or providers directly (only through `state/` actions and repositories); motion logic lives in worklets; derived statistics are computed from stored sessions, never cached as truth.

## 5. Data integrity rules (enforced in domain + data)
- Dates are `YYYY-MM-DD`. Timed info stores wall times + IANA zone + explicit next-day flag; durations are derived DST-correctly.
- Unknown duration is `null`. Sums use known durations only; coverage "durata disponibile per X di Y"; no known durations → "Nessuna durata registrata". Averages exclude unknowns and show the contributing count. Canonical unit: integer seconds; sum before rounding for display.
- Timing states and transitions per `domain/timing.ts`; switching modes previews what changes; clearing removes derived values.
- Multiple sessions per date allowed. Duplicate save taps are blocked by a per-tap request id (unique `(save_request_id, date)`).
- Import provenance, export links, export jobs live in their own tables. Exported/linked events never count as sessions; scheduling placeholders never count as hours.
- Deleting a session leaves calendar events untouched by default. Renaming a category never rewrites exported events.
- Last active category id persisted; validated at launch (deleted → first remaining + visible notice; none → create/select empty state). Never save against a missing category.

## 6. Calendar exchange
Provider interface (`calendar/types.ts`) implemented by Google (OAuth + REST v3: complete pagination, chunked ranges, `singleEvents=true`, colours as labels, `extendedProperties.private` for app metadata) and Apple (expo-calendar / EventKit: chunked ≤4-year ranges, URL field for app metadata, no per-event labels → disclosed). Engines are pure and tested with fake providers:
- **Import**: one activity per operation; title-only case-insensitive contains; calendar + label filters; review list with statuses; recurring occurrences tracked by occurrence key; cancelled excluded; all-day → date only (unknown duration); multi-day → one session on the start date with span kept as provenance; app-exported events restore their original timing from metadata; duplicates skipped by default; possible matches need review.
- **Export**: one activity per operation; destinations Google / Apple / both (equivalence detection prevents double writes); review list with title = prefix + base + suffix (base defaults to the activity name, per-event overrides, reset), notes/location inclusion toggles, timing representation per state (date marker, approved scheduling span for start-only, interval, duration-in-description), duplicate check against the real destination, actions skip/link/create/update, idempotent op ids, per-destination results, uncertain writes reconciled before retry.
- **Auto-export**: off by default; scope all/selected activities; destination settings per activity; durable jobs with backoff; offline/unauthorised/rate-limited → retry later; ambiguity/duplicates/unapproved representations → "Da rivedere"; imported sessions excluded unless forwarding is enabled; turning off stops future writes and offers to cancel pending jobs.

### UI and runtime glue
- `src/sheets/calendar/`: the hub (`/calendar`: connections, nothing prompts before **Collega**), `ImportWizard` (activity → connection + source calendars → range + filters → review → confirm), `ExportWizard` + `ExportRow` (activity → destinations with the "both" gate → titles/content/representation, optionally per destination → per-destination review with actions and outgoing-only edits → results with recovery), `AutoExportSettings`, `JobsScreen`. Pure wizard state lives in `exportModel.ts` / `rangeHelpers.ts` (unit-tested).
- `src/calendar/registry.ts` creates the providers lazily (first calendar use). When a build sets `EXPO_PUBLIC_SERIE_E2E_CALENDAR=1`, it uses the in-memory test provider `src/calendar/memory.ts` instead. That provider exists only for automated UI verification.
- `src/calendar/autoRuntime.ts`: after each local commit (Lineup saves and imports, via `state/hooks.ts`), jobs are queued when automatic export is on. They run after the undo window (an undone save is cancelled, never exported), on returning to the foreground, when the network comes back (`expo-network`), and every minute while open jobs exist.

## 7. Platform honesty
The primary target is a native iOS build (EAS development build / TestFlight). This repository is developed in a Linux container, so native builds and device tests cannot run here: the UI is verified through Expo **web** in headless Chromium (Skia via CanvasKit, persistence via sql.js), and the pure modules through Jest. Google OAuth needs a client id configured by the developer; Apple calendars need a device. See README "Status".
