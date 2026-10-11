# Apple / iPhone calendars provider (`src/calendar/apple/`)

`CalendarProvider` implementation for the calendars stored on the iPhone (EventKit), through **expo-calendar 57** (`~57.0.5`).

| File | Role |
|---|---|
| `provider.ts` | Platform adapter (imports `expo-calendar`, `react-native`). `AppleCalendarProvider`, `createAppleCalendarProvider()`. |
| `mapping.ts` | Pure EventKit ⇄ contract mapping: identity, all-day/timed times, chunking, drafts → native fields. |
| `meta.ts` | Pure `AppEventMeta` encoding in the URL field / notes trailer (base64url). |
| `strings.ts` | Italian user-facing strings (reuses `@/i18n/it` where keys exist). |
| `__tests__/` | Jest tests with `jest.mock('expo-calendar')` and an in-memory EventKit fake. |

## API choice

Since expo-calendar 56.0.7 the object-oriented API is the root `expo-calendar` export and the one the SDK 57 docs recommend. The old function API now lives in `expo-calendar/legacy`, and its root aliases (`getEventsAsync`, …) throw at runtime. The provider uses the root API (plus one legacy locator, below): `getCalendarPermissions`, `requestCalendarPermissions`, `getCalendars(EntityTypes.EVENT)`, `getDefaultCalendarSync`, `ExpoCalendar.get` → `calendar.listEvents` / `calendar.createEvent`, and `ExpoCalendarEvent.get` → `event.update`.

The provider uses the calendar-instance `listEvents`, not the module-level one, because only the instance method returns JS `ExpoCalendarEvent` objects. Their `update()` turns `Date`s into strings and sends explicit `null`s, which clear fields on the native side.

**One legacy function, as a read-only locator.** `ExpoCalendarEvent.get(id)` looks events up natively with `eventWithIdentifier:`, which expects an EKEvent `eventIdentifier`. Every `id` the root API returns is a `calendarItemIdentifier`, a different identifier, so on a device `get()` usually misses. `getEventAsync` from `expo-calendar/legacy` (the documented import path for the legacy API) uses `calendarItemWithIdentifier:`, which matches. The provider uses it only to learn an event's calendar and current start date. It then fetches the object it updates through the root API, around that date.

## Build requirements (cannot be completed in this Linux container)

- **Development build / TestFlight only.** In Expo Go, expo-calendar replaces the root API with a stub class, so `getCalendarPermissions` and the other module functions are `undefined` (calling them would throw a bare `TypeError`). The provider checks for this explicitly and reports `status: 'unavailable'` with the Expo Go explanation.
- **iOS ≥ 16.4** (expo-calendar's minimum since SDK 56).
- **Config plugin.** Add this to `app.json` → `expo.plugins` (this folder does not edit `app.json`):

```json
["expo-calendar", {
  "calendarPermission": "Serie legge i calendari che scegli per importare le sessioni e controllare i doppioni prima di esportare. Scrive solo gli eventi che confermi.",
  "remindersPermission": false
}]
```

The plugin then writes these Info.plist keys:

| Key | Why |
|---|---|
| `NSCalendarsFullAccessUsageDescription` | iOS 17+ full access (needed for import, inspection and duplicate checks). |
| `NSCalendarsUsageDescription` | iOS 16.x calendar access. |

What it leaves out, and why:

- **`writeOnlyAccess`** stays `false` (the default), so no `NSCalendarsWriteOnlyAccessUsageDescription` is written. Serie never *requests* write-only access, because a write-only connection cannot check the destination for duplicates. If the user downgrades Serie to "Add events only" in iOS Settings, the provider still detects it: the native write-only requester accepts the full-access key.
- **`remindersPermission: false`** removes the `NSReminders*` keys. Serie never uses Reminders.

Without the usage string, iOS cannot ask for permission. The provider then reports `status: 'not_configured'`; it does not crash.

The plugin also always adds `READ_CALENDAR` and `WRITE_CALENDAR` to the Android manifest. Serie's Apple provider is iOS-only, so if Android builds are ever produced, list both in `expo.android.blockedPermissions` (minimum access).

## Behaviour

### Connection

| EventKit state | `Connection.status` | canRead | canWrite | detail |
|---|---|---|---|---|
| full access | `connected` | ✓ | ✓ | — |
| write-only (iOS 17+) | `write_only` | ✗ | ✓ | `t.writeOnly`: import and duplicate checks are unavailable |
| denied / restricted | `denied` | ✗ | ✗ | `t.permissionDenied` |
| not determined | `disconnected` | ✗ | ✗ | Serie only asks when you tap Collega |
| usage string missing | `not_configured` | ✗ | ✗ | Info.plist note |
| web / Android / Expo Go | `unavailable` | ✗ | ✗ | platform note |

- **Full access.** It is detected with `getCalendarPermissions(false)`. The native full-access requester reports `.writeOnly` as *denied*.
- **Write-only.** It is detected with `getCalendarPermissions(true)`, which reports *granted* for both `.writeOnly` and `.fullAccess`.
- **`connect(access)`** is the only call that prompts. It always requests **full** access, for `'read'` and `'readwrite'` alike, because export must read the destination to check it for duplicates.
- **`disconnect()`.** An app cannot revoke an iOS permission. Instead, `disconnect()` records "disconnected in Serie", persisted when a `settings` store is passed (it has the same shape as `settingsRepo`; key `calendar.apple.disconnected`). Until the next `connect()`:
  - every call refuses with `ProviderError('unauthorized')`
  - `getConnection()` reports `disconnected` and explains that the iOS permission is still granted.
  - If the flag cannot be read (settings store error), the provider **fails closed**: it behaves as disconnected for that call and reads the flag again next time.
- **With write-only access:**
  - `listCalendars()` returns the single virtual calendar iOS exposes, with `canRead: false`.
  - `createEvent()` works, but only in that virtual calendar: iOS resolves no other calendar id. Creating in a real calendar chosen earlier fails with `ProviderError('forbidden')` and a message saying write-only access allows only the default calendar. It is not reported as a deleted calendar (`not_found`).
  - Every read (`listEvents`, `getEvent`, `findByOpId`) and `updateEvent` (expo-calendar requires full access for it) throws `ProviderError('forbidden')`. A write-only connection is never presented as if a duplicate check succeeded.

### Calendars

- Only calendars of the **event** entity type are listed (`getCalendars(EntityTypes.EVENT)`).
- **Account:** the EventKit **source**.
  - `accountId` = `source.id`, falling back to `sourceId` and then `source.name`.
  - `accountLabel` = the source name (iCloud, `a@b.com`, …). The local source is labelled "Sul mio iPhone".
  - `sourceType` and `sourceName` are filled from the source.
- **Writability:** `canWrite` comes from `allowsModifications`. Subscribed and birthday calendars are never writable.
- **Default:** `isPrimary` marks iOS's default calendar for new events.
- **Labels:** `capabilities.eventLabels = false` and `listLabels()` returns `[]`, because EventKit events have no colour labels. The UI discloses this with `t.labelsUnsupported`.

### Reading events

- **Chunking.** EventKit predicates silently truncate ranges longer than 4 years. Every query is split into consecutive chunks of **≤ 365 days**, per selected calendar, between device-zone midnights.
  - Events that cross a chunk boundary are de-duplicated.
  - A selected calendar that no longer exists fails the whole call with `not_found`. It is never silently skipped.
  - `onProgress` and `signal` (abort) are honoured.
  - An empty `calendarIds` returns `[]`.
  - An inverted or malformed range throws `ProviderError('invalid')`, as in `findByOpId`. It never answers "no events" or "not found" for a window it did not scan.
- **Recurring events.** Occurrences arrive already expanded, and all of them share EventKit's `calendarItemIdentifier` (`event.id`):
  - `recurringEventId` = that id.
  - `occurrenceKey` = the occurrence's **original** start (`originalStartDate`, EventKit `occurrenceDate`): an ISO instant for timed events, `YYYY-MM-DD` for all-day ones. It stays stable when an occurrence is moved or detached.
  - `eventId` = `<id>@<occurrenceKey>`, unique per occurrence like Google's instance ids. The provider parses it back.
  - A single event has `eventId = id` and no key.
- **All-day events.** EventKit reports them as device-zone midnight → 23:59:59 of the last day. They are mapped to date-only `start.date` and an **exclusive** `end.date`; times, zone and instant are `null`.
- **Timed events.** The UTC `instant` is exact. Wall times are computed in the event's zone only when expo-calendar reports an IANA id. expo-calendar 57 reports `EKEvent.timeZone` as a localized abbreviation (`"CET"`, `"GMT+1"`), which is ambiguous, so in practice the **device zone** is used and reported in `timeZone`.
- **Cancelled.** EventKit `.canceled` maps to `'cancelled'`; the native layer spells it `cancelled` and the TS enum `canceled`, and both are accepted. Cancelled events are excluded unless `includeCancelled` is set.
- **Labels:** `colorId` is always `null`.

### App metadata (`AppEventMeta`)

EventKit has no extended properties.

- **Writing.** Serie writes `serie://export?m=<base64url(JSON)>` into the event **URL** field (supported on iOS).
- **A user's own URL.** When an event the user created already carries a non-Serie URL, for example a linked event that is then explicitly updated, that URL is kept. The same string goes instead on a delimited **last line of the notes**, after a blank line.
- **Reading.** The URL field is checked first, then the notes trailer. The trailer is always stripped from `notes`, so previews never show the payload.
- **`findByOpId`** scans the given window plus one day on each side and matches `appMeta.opId`.

### Writing events

- **`createEvent`:**
  - always sends `alarms: []` (a historical log never becomes notifications)
  - adds no attendees, no recurrence and no availability override
  - all-day: device-zone midnight → last second of the last day, no time zone (floating)
  - timed: the draft's IANA `timeZone`, with an exact start and end
  - refuses read-only calendars (`forbidden`) and invalid drafts (`invalid`, e.g. end ≤ start, a timed draft without an end time, an unknown zone).
- **`updateEvent`** (an explicit "update linked event" only) sends the same fields:
  - `alarms: []` again, which also clears alarms the user had set on that event
  - explicit `null`s for notes, location and zone that the draft removes.
- **Recurring occurrences.** Only the targeted instance changes. The occurrence is found by series id + original start, by listing the calendar around the key: ±1 day, then around the draft dates, then ±1 year for moved occurrences. That occurrence object is then updated, which saves with span `.thisEvent`: it becomes detached, and the series and other occurrences are untouched.
  - `getOccurrenceSync({ instanceStartDate })` is deliberately **not** used. Its native lookup matches on the occurrence's *current* start and does not check the event id, so it could hit another event starting at the same instant.
  - An update with no occurrence key on a recurring event is refused (`invalid`) rather than rewriting the series.
- **Error codes.** EventKit saves (`commit: true`) are synchronous and atomic, so a thrown native error is a definite failure and is mapped to a concrete code (`unknown`, not `uncertain`). Native errors map as follows:
  - permission → `unauthorized`
  - missing calendar or event → `not_found`
  - immutable calendar → `forbidden`
  - bad zone or date → `invalid`
  - Expo Go → `unavailable`
  - missing Info.plist key → `forbidden`

## Known limitations / risks

- **Looking up single events by id.** The lookup order is:
  1. `ExpoCalendarEvent.get(id)`. It usually misses on a device (see API choice).
  2. Legacy `getEventAsync(id)` (`calendarItemWithIdentifier:`). It finds the event in any calendar, wherever the user moved it, even after an app restart. An event now in another calendar is reported as such: `getEvent` returns `null`, and `updateEvent` throws `not_found` with "moved to another calendar".
  3. A scan around the last seen date (an in-memory hint) and, for `updateEvent`, around the draft dates.

  If nothing matches, `getEvent` returns `null`; it never guesses. Before this order existed, a linked event the user had moved outside the export window looked stale after a restart, and the engine would have proposed creating it again. The legacy call may reset the shared `EKEventStore` the first time it runs after a permission change, so the provider fetches the calendar again before it scans. Verify this on a device.
- **Default alerts.** `alarms: []` is sent on every write. Some CalDAV servers (for example a Google account added in iOS Settings) may still apply their own default notifications server-side.
- **The `serie://export?m=…` URL is tappable in Apple Calendar** and opens Serie. The router should handle or ignore that path, e.g. with a `+native-intent` rewrite to `/`. Otherwise Expo Router shows its unmatched-route screen.
- **Wall times use the device zone** (see Reading events). Events created in another zone read back with correct instants but device-zone wall times.
- **Not verified on a device.** All behaviour above is verified only against the jest fake in this container.
