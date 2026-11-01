# Serie — specification excerpts for calendar exchange, location and timing

(Verbatim requirements from the product brief. These are acceptance criteria.)

## Optional timing & explicit duration semantics

Keep clock time and activity duration conceptually and structurally separate. Support these four states without making any timing information mandatory:

1. Date only: The session has a date but neither clock times nor a declared duration. Its duration is unknown. It is not a 24-hour activity, an all-day workout, a zero-hour session, or a fabricated midnight event.
2. Start time only: The session has a date and a single time of day/start time, but no end time or declared duration. Preserve the supplied time while leaving duration unknown. Never infer an end time or duration from the next session, current time, typical activity length, or an export default.
3. Start and end times: The user supplies the interval. Calculate and display its elapsed duration, retain the interval as the source of that value, and recalculate when either endpoint changes. Removing the end time without explicitly replacing it with a declared duration returns the session to start-only with unknown duration.
4. Duration only: The user enters how many hours the activity lasted without supplying a start or end time. Accept fractional hours with locale-appropriate input, such as 1.5 or 1,5 hours, and display an understandable equivalent such as 1 h 30 min. Count this declared duration without fabricating clock times.

A start time may also be combined with an explicitly declared duration if this is offered as a convenience. Keep the declared duration as the source of truth; any calculated end time must be visibly derived, not presented as a separately entered fact.

Calendar display spans, provider-required end times, and export-only scheduling defaults must remain separate from actual recorded timing and duration. They must never manufacture activity hours, including during re-import.

Unknown duration is not zero, 24 hours, a calendar event's all-day span, an export scheduling default, or the activity's average duration. Never count an exported or linked calendar event as an additional local activity session.

## Location

Allow a place name or address and a pasted Google Maps location link. Resolve supported links, including common shortened share links where feasible, into a location that can be shown in a refined compact map preview with a marker and a readable place label.

Preserve the original link and provide an action to open it in Maps. Use a legitimate map SDK or supported embedding service with appropriate attribution and configuration. Do not treat arbitrary shared URLs as automatically embeddable maps, guess coordinates, or substitute an unrelated decorative map.

When a link is ambiguous, unsupported, or temporarily unresolvable, keep the link and the session, explain the map's unavailable state, and allow manual place selection or correction. A maps/network failure must not block session saving.

Do not request current-location permission merely to accept a pasted place link. Request it only if the user invokes a feature that actually uses the device's location.

## Calendar import, export & user control

Support Google Calendar through an authenticated integration and Apple/iPhone calendars through the appropriate native calendar integration.

### Providers, accounts, calendars, and labels
Clearly distinguish the connection/provider, the user's account, the actual calendar within that account, and event labels or colors where exposed by that provider. Users must be able to choose source calendars for import and writable destination calendars for export. Expose supported event labels or colors as additional filters and destination options; do not pretend all providers or integration routes have identical label capabilities. Honor a chosen label through an integration route that supports it, or clearly disclose the limitation rather than silently discarding it.

"Google Calendar," "Apple Calendar," and "Both" are user-facing destination choices, not a reason to duplicate a write to the same underlying calendar. A Google calendar may also be visible through the iPhone calendar store. Identify equivalent destinations where reliably possible and avoid double-writing through different integration routes. If equivalence cannot be established, display the account/calendar details and require the user to resolve the ambiguity before enabling export to both.

### Import — one activity per operation
Workflow: Choose the destination activity → Choose the calendar connection and source calendars → Set the date range and filters → Review matching events → Confirm the selected imports.

Each import operation targets exactly one existing or explicitly created activity category. All selected events become sessions of that activity, regardless of their original titles. Support historical ranges spanning multiple years, with complete pagination and appropriately chunked retrieval rather than silently importing only the first results or a recent subset.

Support case-insensitive "event title contains" filtering by a user-entered word or phrase, such as surf. Apply this filter specifically to the title, not accidentally to notes, attendees, or location. Do not rely on a provider's broad full-text search as the final title-only filter. Support filtering by one or more source calendars and by available event labels/colors. Title filtering and calendar/label filtering must each work independently or together. When combined, the event must belong to the selected source scope and satisfy the enabled title/label conditions.

Before importing, show a vertically scrollable review list containing the source title, date and available times, the proposed known duration or "Duration not specified," notes preview, source calendar/account, destination activity, selection state, and duplicate/import status. Provide individual selection and deselection, select-all/deselect-all controls with an explicit scope, and an accurate count of selected items. Preserve choices while reviewing the batch.

Import only after explicit confirmation. Preserve available source notes, location and timing information, and retain the original title as provenance without changing the chosen activity category.

All-day calendar events do not establish activity duration: absent an explicit confirmed duration, import them with unknown duration, never 24 hours per day. A valid timed start/end interval may supply a known duration, which must be visible in the import preview. A lone start time leaves duration unknown.

When recognizing the app's own exported events or trusted supported metadata, preserve the original timing state and distinguish declared or recorded duration from export-only scheduling placeholders. Do not reverse-engineer a real duration from an end time or all-day span the app added only to satisfy calendar representation. Linking or re-importing must not upgrade unknown duration without an explicit user correction.

Expand recurring events into individual selectable occurrences within the chosen range and track occurrence identity. Exclude canceled occurrences. Do not mistake a recurring series identifier for the identity of each separate session.

For a multi-day event, show its full date range and the proposed mapping. Default to one session anchored to its start date while retaining the source span as provenance; never silently turn it into one session per day. An all-day or multi-day calendar span must not become a measured activity interval or generate hours.

Detect previously imported events and possible matches to existing local sessions. Default to skipping recognized imports; require review for uncertain matches rather than silently creating duplicates or merging separate sessions. Import is a read operation on the source calendar.

### Manual export — one activity per operation
Workflow: Choose an activity → Choose Google Calendar, Apple/iPhone calendars, or both → Choose the actual destination calendar and any supported label → Review and customize events → Resolve duplicate warnings → Confirm export. When exporting to two distinct destinations, maintain independent destination settings, duplicate checks, and results.

The review is a vertically scrollable list. Each row shows the activity name, proposed event title, notes or an expandable preview, date, any clock times, the known activity duration or "Duration not specified," selection state, destination, and duplicate/export status. Distinguish recorded activity duration from any outgoing calendar scheduling span. Individual and scoped select-all/deselect-all. Export only the confirmed selection.

Default event title = activity name. Per-event title and content overrides (notes, date/time where needed). Export-review edits change the outgoing event by default, not the stored session or category name; require an explicit action to apply an edit back to the session.

Optional batch prefix and suffix with immediate previews, preserving the characters and spacing the user enters. Final title = batch prefix + per-event base title + batch suffix. The base title defaults to the activity name and can be overridden individually. Recompute previews without repeatedly appending the same prefix or suffix. Preserve individual overrides while changing batch text, and provide a reset action.

Map notes to the event's description and location to supported location fields, preserving useful map links; explicit controls to omit notes/location.

Timing representation in the export preview:
- Date only: a calendar date marker using the all-day area, visibly disclosed; not a claim the activity lasted all day. Local duration remains unknown.
- Start only: preserve the start time. If the destination requires an end time, use only a user-approved export-only scheduling span or a previously configured, visible preset. Keep local duration unknown. Otherwise leave the export pending for review.
- Start and end: export the recorded interval with correct dates and timezone.
- Duration only: preserve the absence of clock times; a date-marker representation may carry the declared duration as clearly labeled event content or metadata. Do not invent a start time. A user may choose an outgoing scheduling time explicitly without changing the local session.

Any export-review time override changes the outgoing event only unless explicitly applied to the session. A scheduling placeholder must never change local recorded-hour totals. Preserve original timing provenance in metadata and stored export snapshots.

No attendees, no invitations. Make reminder and visibility behaviour clear; never turn a historical log into notifications.

After confirmation, report created, linked, updated, skipped, failed, and pending items per destination. A partially successful batch must be recoverable without recreating successful items.

### Optional automatic export after saving
Manual-only mode and explicitly enabled automatic mode; off by default. Enable for all or selected activities; choose Google, Apple, or both; default destinations with per-activity overrides. Configuration includes destination calendars, labels, prefix/suffix rules, notes/location inclusion, and representation rules for date-only, start-only, interval and duration-only sessions. Start-only scheduling fallback requires opt-in and stays export-only. When an outgoing representation has not been approved, queue for review without blocking local saving.

Once enabled and configured, automatically attempt export after each eligible new session is committed locally. Persist jobs and display their state. Distinguish "saved locally" from "accepted by a calendar integration" and from cloud sync. Offline, unauthorized, interrupted, rate-limited → keep the session and a recoverable pending/failed job; retry safely later. Imported sessions are excluded from automatic re-export by default unless forwarding is enabled, and never duplicated back into their source calendar. Known duplicates are not recreated; possible duplicates or unresolved destination ambiguity → "Needs review". Turning auto-export off stops future writes and allows cancelling pending jobs; it never deletes exported events.

### Duplicate detection & safe reconciliation
Check the actual destination calendar before exporting (local history alone is insufficient). Separate recognized linked events from heuristic matches and from events that could not be checked. Recognized: stored provider/account/calendar/event links and app metadata; track recurring occurrence identity; reconcile stale references.

Possible duplicates: compare intended local date, start time and known duration when available, normalized original and final titles, activity wording, location, notes; account for prefix/suffix rules and prior snapshots. Missing duration is unknown evidence (not a match, not a mismatch); scheduling spans are not durations. Never identify duplicates by date alone (two surf sessions on one day may be legitimate). Do not equate all-day and timed events with certainty because dates match.

Show status + reason: "Already exported", "Possible duplicate — same day and similar title", "Linked event changed", "Not checked — calendar access unavailable". Allow inspecting the existing event vs the proposed one. Actions: skip (safe default for recognized duplicates); link without changing content; deliberately create a separate event; explicitly review and update a linked, writable event. Never overwrite/merge/delete a manually created event because a heuristic says it is similar; updates show intended changes and need confirmation.

Idempotent retries: the same session-to-destination operation must not create another event after a previous successful write. Persist operation identity and results; reconcile an uncertain write before retrying as a new creation. Track status per destination.

### Not uncontrolled two-way sync
User-initiated imports, user-initiated exports and configured automatic export of new sessions only. Local edits, renames, deletions never automatically overwrite/delete external events; indicate when a linked export differs and offer explicit review/update. Deleting a local session leaves calendar events untouched by default. Never silently overwrite local data from a later calendar read.

### Permissions, privacy & platform honesty
Request calendar permissions and Google authorization only when the user invokes the feature. Minimum access for the workflow; import, inspection and duplicate checks need readable event data — never present a write-only connection as if duplicate checking succeeded. Supported auth flows, secure credential storage, no hard-coded secrets, no fake data. Show the chosen account and calendar before writing. Keep integrations behind clear platform interfaces; document provider project / OAuth / native build requirements that cannot be completed in the dev environment.
