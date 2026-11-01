# Serie — product specification (verbatim)

This is the brief Serie was built from, kept verbatim for reviewers. The visual direction comes from the corduroy trailer (../trailer, ../deliverables).

```text
Treat this trailer as the primary creative reference for the application’s visual identity, motion language, typography, colors, geometry, rhythm, and overall aesthetic.

Preserve its distinctive artistic personality and translate its most extraordinary visual qualities into a real, fully interactive application.

Do not simply imitate the trailer frame by frame. Bring its visual world to life, adapting and expanding its design language into functional, responsive, real-time interactions.

Use the trailer as a creative foundation, not a limitation. Feel free to innovate and push its artistic direction even further while maintaining a coherent identity.

The full application specification below defines the required functionality and experience. The trailer establishes the visual direction


---

BUILD AN EXTRAORDINARY MOTION-FIRST SURF APP


THE CREATIVE CHALLENGE

Imagine you are one of the most extraordinary motion designers and creative technologists in the world.

You have been challenged to create the most ambitious, visually breathtaking interactive digital experience of your career.

Imagine you were asked:

“Make a dynamic 15-second motion graphics video that shows what an incredible motion designer you are, like it’s your showreel for a résumé. Go all out.”

Now take that exact same creative ambition, fearlessness, experimentation, visual sophistication, and obsession with motion — and apply it to an actual, fully functional iPhone application.

Not a video.
Not a website pretending to be a native app.
Not a conventional mobile interface decorated with impressive transitions.

A real application in which the interface itself is an extraordinary, living, interactive motion graphics composition.

The kind of experience that makes someone stop and ask:

“How is this even an app?”

The result should feel like an award-winning motion design showreel that has somehow become interactive, useful, personal, and alive.

Be radically creative.
Be technically brilliant.

But remember: this is a real product that someone will use every day. The visual spectacle must make the experience more intuitive, not less.


THE PRODUCT — A LIVING VISUAL HISTORY OF YOUR LIFE

Create a beautiful, minimal, iPhone-first personal activity tracking application designed for surfers, initially centered around surf sessions but built to accommodate any personal activity.

Surfing defines the creative identity. Customizable activity categories make the underlying product extensible.

Users should be able to record when they went surfing, running, training, traveling, or participating in any activity they want to remember.

The core interaction is intentionally simple:

Open directly in the last-used activity → Select one or multiple dates → Save.

Switch activities only when needed, using an immediately visible activity selector. Choosing an activity again must not be a compulsory step on every launch.

That’s it.

The underlying product is simple. The way it looks, moves, transforms, and responds should be extraordinary.

Every recorded activity becomes part of a continuously evolving personal visual universe. Over time, the application transforms the user’s history into a beautiful, interactive representation of their experiences.

Recording an activity should feel almost effortless. Revisiting personal history should be genuinely captivating.

The complete product must support customizable categories, a persistent last-used activity context, multi-date logging, entirely optional per-session notes, locations, clock times and durations, session editing and deletion, an interactive calendar, an explorable historical timeline with explicit month and year browsing, accurate session counts and recorded-hour statistics, reliable offline persistence, selective calendar import, and manual or opt-in automatic calendar export.

This should not feel like a fitness dashboard, a productivity tracker, or a conventional calendar application.

It should feel like a new category of digital experience.


IMMEDIATE ENTRY & PERSISTENT ACTIVITY CONTEXT

Remember the last activity used in the main logging interface, persist its stable identifier across app restarts, and reopen directly in that activity’s usable recording experience.

Do not send returning users through an activity gallery, onboarding sequence, selection screen, or mandatory reveal animation before they can select dates and save.

Keep a recognizable symbol for the active activity in a prominent, natural position on the initial screen, alongside its name and a clear switching affordance. For Surf, the symbol should communicate the surf identity within the application’s visual language.

This control must be visible without searching, scrolling, opening settings, or discovering a hidden gesture. Tapping it reveals the available activities; selecting another activity updates the active context and remembered choice.

Make the selected activity unmistakable, with an accessible name and selection state. Never rely on an unfamiliar symbol alone to communicate where a session will be saved.

On a fresh installation, use the initial Surf category as the active context. If the remembered category has been deleted, use a valid remaining category and clearly show the changed context; if none remain, provide an explicit create/select empty state. Never save against a missing category identifier.

Remembering the activity must not accidentally reuse previously saved date selections as new logging requests. Keep the current activity visible through logging and saving.

The spectacular activity transformation remains available when users choose to switch. It must not become a toll they pay every time they open the app.


MOTION IS THE INTERFACE

Do not design static screens and then animate them.

Design a living motion system from which the entire interface emerges.

The application should feel like a single continuous composition that transforms itself in response to the user, not a collection of separate screens connected by transitions.

Navigation is transformation.
Interaction is choreography.
Data is visual material.
History is spatial.
Motion communicates meaning.

Every interactive state should feel like another manifestation of the same underlying visual world.

Switching the active activity reorganizes the composition. Navigating through time changes its scale and arrangement. Recording an experience introduces new visual information. Exploring history reveals relationships within what already exists.

Nothing should feel arbitrarily disconnected.

OBJECT PERMANENCE

Build the experience around visual object permanence.

An activity must retain a recognizable graphical identity across contexts rather than being represented by unrelated elements in different sections.

For example, an abstract activity shape could unfold into a calendar. Selected date marks could become individual events within the historical composition. The same graphical identity could reappear in progress visualizations.

These are possibilities, not prescribed solutions. Invent a more original system if you can.

The important thing is that users feel they are manipulating the same living objects throughout the experience.

A REUSABLE MOTION GRAMMAR

Define shared rules and primitives for timing, easing, deformation, momentum, spatial relationships, interaction feedback, typographic choreography, and interruption.

Use the same underlying system across activity selection, date selection, history, editing, and progress.

Establish a clear motion hierarchy. Major transformations may be expressive; supporting movement should serve interaction, composition, atmosphere, or emotional identity. Keep essential information stable when users need to read, compare, or select it.

Typography should participate in the choreography rather than sit above unrelated effects. Labels, dates, and numbers must remain legible.

Backward navigation and interrupted transitions should preserve physical and spatial coherence. Continue from the current visual state rather than abruptly resetting objects or replaying a fixed sequence.

The goal is showreel-level craftsmanship, not showreel-level animation density.


THE OCEAN IS THE MOTION LANGUAGE

THE POWER AND ELEGANCE OF A BREAKING WAVE

The entire visual identity, interaction language, and motion behavior must be deeply inspired by the physical movement, energy, and elegance of ocean waves.

The interface should not simply depict waves. It should move, transform, and behave like a wave.

Imagine an ocean swell approaching, rising, gathering immense energy, forming a powerful curved wall of water, reaching its breaking point, and releasing its energy in a spectacular, fluid motion before settling into calm.

That sequence of tension, elevation, acceleration, impact, release, and flow should become the fundamental motion language of the application.

Users should instinctively feel the ocean through the physical behavior of the interface, not through literal imagery.

MOTION INSPIRED BY OCEAN DYNAMICS

Swell: Slow, elegant movement carrying a sense of immense energy beneath the surface.

Build-up: Shapes rising, stretching, and gathering visual tension.

Crest: Curved forms reaching their maximum height, anticipation, or expressive potential.

Breaking: Powerful, precisely choreographed acceleration that releases accumulated energy.

Flow: Directional, fluid movement carrying elements naturally into their next state.

Dissipation: Energy dispersing through subtle secondary motion before the composition settles.

Rhythm: Organic alternation between calmness and intensity.

Use these qualities to shape animation timing, easing, geometric deformation, transitions, and interactive feedback.

Do not force every interaction through the entire cycle. A small interaction may express only resistance, tension, or flow. Reserve the full accumulation and release of energy for significant moments.

Avoid arbitrary bouncing and generic spring behavior disconnected from the ocean’s character. Movement should communicate weight, momentum, direction, resistance, and release.

It should feel physically convincing, yet artistically exaggerated where this strengthens the experience.

POWERFUL, YET ELEGANT

Balance raw power with sophisticated elegance.

Large, confident transformations should coexist with delicate typography, refined composition, beautiful curves, and restrained details.

Some interactions should feel calm and almost meditative. Others should release dramatic visual energy, like a wave finally breaking.

Do not make every interaction equally intense. Use contrast, stillness, and negative space to give the powerful moments their impact.

THE SURFER’S EMOTIONAL CONNECTION

Draw from the sensations that make surfing unforgettable:

The anticipation of an approaching set.
The energy building beneath the board.
The steepening face of the wave.
The moment of commitment.
The speed and force of the breaking wave.
The exhilarating release.
The calm that follows.

These sensations should guide the art direction without adding complexity to the user’s workflow.

A surfer should recognize something familiar in the movement, even when the interface contains no literal image of the ocean.

ABSTRACT OCEAN, NOT LITERAL OCEAN

Create an original graphic language derived from the geometry, rhythm, curvature, fluidity, and energy of waves.

Do not rely on beach backgrounds, stock ocean photographs, cartoon waves, repetitive blue gradients, or disconnected decorative water effects.

The identity must remain convincing without depending on blue.

Explore expressive kinetic typography, fluid shapes, dynamic contours, procedural geometry, and carefully controlled depth. Use color with sophistication and intention.

This is not an ocean simulation, a surfing game, or a conventional surf tracker with animated wave decorations.

The ocean’s behavior should be embedded in the interaction system itself.


COMMIT TO ONE DISTINCTIVE ARTISTIC DIRECTION

Before building conventional UI structures, briefly explore several possible visual concepts internally. Evaluate their originality, usability, spatial continuity, and technical feasibility, then commit to one exceptionally coherent direction.

Define the fundamental visual primitives, typographic personality, color palette, spatial logic, and relationship between graphical behavior and user data.

Do not assemble a catalogue of impressive effects. Build a recognizable visual language whose elements belong to the same world.

Avoid letting conventional card-based dashboards, standard bottom tabs, repetitive rectangular containers, generic glowing gradients, excessive glassmorphism, or familiar app templates define the experience.

Familiar controls are permitted where they materially improve usability or accessibility. They should support the original interaction system, not replace it.

The required chronological history browser, compact monthly calendars, and vertical import/export review lists are intentional functional tools, not violations of the creative direction. Give them the same artistic identity without compromising their clarity.

Treat creative exploration as preparation for implementation, not a substitute for building.

Make the first usable version express the product’s distinctive identity.


THREE SIGNATURE INTERACTIONS

The application needs three memorable interactive moments that concentrate its creative ambition.

The functional outcomes below are required. The suggested visual behaviors are conceptual directions, not fixed animations.

MOMENT A — CHOOSING OR SWITCHING AN ACTIVITY

Users enter the recording experience with their remembered activity already active. Its prominent symbol is both a recognizable living graphic entity and the immediately discoverable control for switching activities.

When the user invokes that control, reveal the available activities within the same visual world. Selecting another activity should transform the existing composition into its recording context rather than simply open an unrelated page.

The composition might gather energy, rise, stretch, or unfold like a swell developing into a wave. Geometry, typography, and spacing should move as one choreographed system.

The selected activity and the next action must remain immediately understandable. This signature interaction is optional during routine logging, not a mandatory launch sequence.

MOMENT B — SELECTING DATES

The activity’s visual structure should flow into an accurate, interactive calendar while preserving continuity.

Users must be able to select today, select past dates, choose multiple non-consecutive dates, navigate between months and years, deselect easily, and recognize previously recorded sessions.

Each touch should create an immediate, meaningful visual response. Selections may produce disturbances, curves, deformations, connections, or redistributions of visual energy.

The composition can respond to the number, distribution, or chronology of selected dates.

Make date selection feel like composing interactive generative art, but never make users guess which date they are selecting. Chronological clarity and visible selection states are mandatory.

Keep optional session details available without inserting mandatory steps into this flow.

MOMENT C — SAVING AN ACTIVITY

Saving should be the emotional climax of the core interaction.

The selected dates should visibly become part of the user’s history through a powerful, elegant, wave-inspired transformation.

The animation should communicate:

“This experience is now part of your story.”

Commit the data reliably before communicating success. The animation represents a successful save; its completion must never determine whether data is persisted.

Keep the transformation interruptible. Users must be able to continue or record another activity without waiting for the choreography to finish.

If saving fails, preserve the selection and provide a clear recovery path. Distinguish local saving from any subsequent calendar export: an export failure must never erase a successfully recorded session.


THE LIVING TIMELINE & MEANINGFUL PROGRESS

Create a personal history that feels like an evolving generative artwork with a meaningful temporal structure, not merely a conventional list with animation attached.

Time should feel like a continuous current. Individual sessions should remain recognizable events within a larger landscape of rhythms, peaks, and patterns.

Enable coherent exploration of individual sessions, days, months, years, activity categories, and the complete history.

Moving outward should reveal genuine patterns. Moving closer should reveal precise dates and individual sessions. Filtering an activity should reorganize the same visual world rather than open an unrelated dashboard.

Preserve temporal orientation throughout changes of scale and arrangement.

EXPLICIT MONTH AND YEAR BROWSING

For each activity, provide an easily discoverable chronological history browser with both Month and Year modes. This capability is mandatory, although it may be the default history presentation or an optional view alongside the more expressive timeline.

Use a continuous vertical or horizontal scroller. Choose the orientation that best serves the design and touch experience; implementing both orientations is not required.

In Month mode, show clearly labeled month/year groups and the exact total number of sessions for that activity in each month. Also provide the month’s recorded-hour total when durations are available, with its completeness made clear under the rules below.

Each month must include an expandable, collapsible miniature calendar that marks the dates on which sessions occurred. Indicate multiple sessions on the same date without confusing session counts with the number of active days.

Tapping a marked date must reveal its sessions and allow opening their details for review or editing. Collapsing the calendar should preserve the user’s scroll position and chronological context.

In Year mode, show clearly labeled year groups with the exact annual session count, available recorded-hour totals, and a compact monthly breakdown. Allow drilling into a month and its calendar without losing the selected activity or temporal context.

Keep the total for the selected activity and the totals for the displayed periods distinguishable. Never label active-day counts as session counts.

Support long histories spanning many years. Provide direct navigation to a chosen month or year rather than requiring endless scrolling. Represent empty months truthfully rather than silently compressing time in a misleading way.

MEANINGFUL PROGRESS

Carry the same graphical language into progress visualizations. Support total sessions, sessions per activity, weekly and monthly frequency, consistency over time, activity distribution, clearly defined milestones, historical trends, and cumulative recorded hours for each activity.

For hour totals, sum only known session durations: durations calculated from a valid start/end interval or explicitly entered by the user. A session with no timing details or only a start time has an unknown duration and contributes to session counts, but not to the sum or denominator of duration-based metrics.

Show recorded-hour totals for the activity overall and the selected day, week, month, year, or date range. Count each session’s known duration once. For day and period summaries, attribute the session and its full recorded duration to its recorded session date, including confirmed overnight sessions, and make that convention clear.

Keep completeness visible: for example, “3 h 30 min recorded · duration available for 2 of 4 sessions.” Do not present a partial sum as the complete time spent on every session. When no durations are known, show “No durations recorded” or an equivalent unavailable state rather than implying that the user spent zero hours.

Unknown duration is not zero, 24 hours, a calendar event’s all-day span, an export scheduling default, or the activity’s average duration. Do not estimate missing values. Duration averages must exclude unknown durations and expose the number of contributing sessions.

Editing, clearing, importing, moving, or deleting a session must update the relevant session and duration metrics consistently. Never count an exported or linked calendar event as an additional local activity session.

Use accurate data to drive visual density, rhythm, continuity, geometry, or other expressive properties that fit the chosen concept.

Every quantitative visual encoding must correspond to actual stored data and an understandable metric. Every milestone must follow an explicit rule.

Keep exact values accessible and distinguish decorative behavior from information. Do not imply improvements in skill, fitness, or performance that the recorded data cannot establish.

An empty history must appear as an intentional, beautifully designed empty state, never as fabricated personal activity.


REAL FUNCTIONALITY & DATA INTEGRITY

ACTIVITY CATEGORIES

Support creating, renaming, recoloring, and deleting custom activity categories.

Give categories recognizable visual identities within the shared graphical system and allow users to switch between them quickly.

Include Surf as a prominent initial category. Other starter categories may be included, but never invent session history.

Deleting a category must provide explicit safeguards for its existing sessions. Renaming a category must not silently rename previously exported calendar events.

SESSION MANAGEMENT

Support recording historical activities, reviewing saved sessions, editing their activity or date, and deleting them with appropriate safeguards.

Allow multiple intentional sessions for the same activity on the same date. Prevent accidental duplicates caused by repeated save taps or repeated imports without prohibiting legitimate separate sessions.

Creation, editing, and deletion must update the timeline and statistics consistently.

OPTIONAL PER-SESSION DETAILS

Every individual session must support independently optional place/address information, a map link or resolved location, free-text notes, clock times, and duration. These belong to the individual session, not merely to the activity category.

None of these details is required to create, save, edit, or count a session. Users may leave all of them blank, add only one, combine the details they need, or remove previously entered details later. A place or map link must not require notes; a note must not require a location; a duration must not require clock times.

Users must be able to add, edit, and clear these details both while recording a session and afterward from history.

Use a progressively disclosed details area. The essential logging flow requires only the already active activity and one or more dates, without mandatory detail forms, a timing-mode selection, location access, calendar connection, or additional setup.

For multi-date logging, create independently editable session records. Apply a shared note, place, time interval, or duration to selected sessions only through an explicit action. Make clear that a shared duration applies separately to each selected session, not as a silently divided batch total. Each resulting session must remain independently editable.

Location: Allow a place name or address and a pasted Google Maps location link. Resolve supported links, including common shortened share links where feasible, into a location that can be shown in a refined compact map preview with a marker and a readable place label.

Preserve the original link and provide an action to open it in Maps. Use a legitimate map SDK or supported embedding service with appropriate attribution and configuration. Do not treat arbitrary shared URLs as automatically embeddable maps, guess coordinates, or substitute an unrelated decorative map.

When a link is ambiguous, unsupported, or temporarily unresolvable, keep the link and the session, explain the map’s unavailable state, and allow manual place selection or correction. A maps/network failure must not block session saving.

Do not request current-location permission merely to accept a pasted place link. Request it only if the user invokes a feature that actually uses the device’s location.

OPTIONAL TIMING & EXPLICIT DURATION SEMANTICS

Keep clock time and activity duration conceptually and structurally separate. Support these four states without making any timing information mandatory:

1. Date only: The session has a date but neither clock times nor a declared duration. Its duration is unknown. It is not a 24-hour activity, an all-day workout, a zero-hour session, or a fabricated midnight event.

2. Start time only: The session has a date and a single time of day/start time, but no end time or declared duration. Preserve the supplied time while leaving duration unknown. Never infer an end time or duration from the next session, current time, typical activity length, or an export default.

3. Start and end times: The user supplies the interval. Calculate and display its elapsed duration, retain the interval as the source of that value, and recalculate when either endpoint changes. Removing the end time without explicitly replacing it with a declared duration returns the session to start-only with unknown duration.

4. Duration only: The user enters how many hours the activity lasted without supplying a start or end time. Accept fractional hours with locale-appropriate input, such as 1.5 or 1,5 hours, and display an understandable equivalent such as 1 h 30 min. Count this declared duration without fabricating clock times.

A start time may also be combined with an explicitly declared duration if this is offered as a convenience. Keep the declared duration as the source of truth; any calculated end time must be visibly derived, not presented as a separately entered fact.

Do not store incompatible timing inputs or count both an entered duration and a computed interval for the same session. When switching representations, preserve valid details where possible, show what will change, and make the active duration source unambiguous.

Validate supplied durations as positive, finite values and check time intervals for correctness. A blank field means not provided, never zero. An end earlier than the start must not silently create a negative duration or assume an overnight session; provide an explicit next-day/end-date control. Equal clock times must not be silently interpreted as 24 hours.

Store sufficient date and timezone context for timed intervals to handle midnight and daylight-saving transitions correctly. Use a sensible visible default for timezone rather than requiring extra setup for ordinary logging. Preserve the session’s intended recorded date for history and period statistics.

Normalize known durations to a precise canonical unit, such as integer seconds, and convert to hours for entry and display. Sum canonical durations before rounding the displayed total.

Represent unknown duration explicitly as null/absent with a distinguishable timing state. Track whether a known duration comes from an entered interval or an explicit duration. Clearing timing or duration must remove obsolete derived values rather than leave hidden hours in statistics.

Calendar display spans, provider-required end times, and export-only scheduling defaults must remain separate from actual recorded timing and duration. They must never manufacture activity hours, including during re-import.

OFFLINE-FIRST PERSISTENCE

Use a reliable offline-first database, stable identifiers, and a clear data model.

Custom categories, the last active activity identifier, sessions, dates, notes, location references, timing states, entered and derived duration provenance, and edits must survive application restarts. Persist optional values without coercing missing durations to zero or to an all-day span.

Store calendar-only dates as date-only values, such as YYYY-MM-DD, rather than timestamps that could shift the recorded day across timezones. Store timed information separately with sufficient timezone context for correct calendar conversion.

Maintain a clean separation between domain models, persistent storage, application state, derived statistics, motion logic, rendered graphical compositions, and external calendar operations.

Store import provenance and export links separately from session content. Include provider, account, calendar, external event identity, recurring occurrence identity when relevant, local session identity, operation status, and the last successfully exported snapshot where appropriate.

Every advertised feature and interactive control must actually work. No fake buttons, placeholder interactions, simulated persistence, or demo data masquerading as the user’s history.


REAL-TIME GRAPHICS & PLATFORM ARCHITECTURE

Build a real native-oriented application, not a cinematic mockup.

Prefer React Native + Expo + React Native Skia + Reanimated, or an equally capable architecture.

Generate graphics dynamically from user input, application state, gestures, and stored data.

Use procedural geometry, fluid vector transformations, GPU-accelerated rendering, physics-inspired interactions, and lightweight shaders where they serve the artistic direction.

Do not use video backgrounds, GIFs, pre-rendered animation sequences, image-sequence playback, or other multimedia shortcuts in place of real interaction. Legitimate map rendering is a functional integration, not a replacement for the motion system.

Prioritize the actual iPhone experience: touch behavior, safe areas, mobile layouts, responsiveness, and real device constraints. Support Android and responsive web layouts where feasible.

If the execution environment only supports web, create a real touch-first, responsive, interactive web implementation using appropriate browser graphics technologies. Clearly identify it as web rather than claiming it is a native iPhone application.

A platform limitation must never become an excuse to substitute a static mockup or video for a working product.


CALENDAR IMPORT, EXPORT & USER CONTROL

Calendar exchange is a required part of the complete product, implemented after the core logging and history experience. It must not be reduced to a decorative integration button or treated as an optional idea when the environment supports implementation.

Support Google Calendar through an authenticated integration and Apple/iPhone calendars through the appropriate native calendar integration.

PROVIDERS, ACCOUNTS, CALENDARS, AND LABELS

Clearly distinguish the connection/provider, the user’s account, the actual calendar within that account, and event labels or colors where exposed by that provider.

Users must be able to choose source calendars for import and writable destination calendars for export. Expose supported event labels or colors as additional filters and destination options; do not pretend all providers or integration routes have identical label capabilities.

Check the current official APIs and the selected account’s capabilities. Honor a chosen label through an integration route that supports it, or clearly disclose the limitation rather than silently discarding it.

“Google Calendar,” “Apple Calendar,” and “Both” are user-facing destination choices, not a reason to duplicate a write to the same underlying calendar. A Google calendar may also be visible through the iPhone calendar store.

Identify equivalent destinations where reliably possible and avoid double-writing through different integration routes. If equivalence cannot be established, display the account/calendar details and require the user to resolve the ambiguity before enabling export to both.

IMPORT — ONE ACTIVITY PER OPERATION

Use this workflow:

Choose the destination activity → Choose the calendar connection and source calendars → Set the date range and filters → Review matching events → Confirm the selected imports.

Each import operation targets exactly one existing or explicitly created activity category. All selected events in that operation become sessions of that activity, regardless of their original event titles.

Support historical ranges spanning multiple years, with complete pagination and appropriately chunked retrieval rather than silently importing only the first results or a recent subset.

Support case-insensitive “event title contains” filtering by a user-entered word or phrase, such as surf. Apply this filter specifically to the title, not accidentally to notes, attendees, or location. Do not rely on a provider’s broad full-text search as the final title-only filter.

Support filtering by one or more source calendars and by available event labels/colors. Title filtering and calendar/label filtering must each work independently or together. When combined, make the matching rule explicit: the event must belong to the selected source scope and satisfy the enabled title/label conditions.

Before importing, show a vertically scrollable review list containing the source title, date and available times, the proposed known duration or “Duration not specified,” notes preview, source calendar/account, destination activity, selection state, and duplicate/import status.

Provide individual selection and deselection, select-all/deselect-all controls with an explicit scope, and an accurate count of selected items. Preserve choices while reviewing the batch.

Import only after explicit confirmation. Preserve available source notes, location and timing information, and retain the original title as provenance without changing the chosen activity category.

Apply the same timing states to imports. All-day calendar events do not establish activity duration: absent an explicit confirmed duration, import them with unknown duration, never 24 hours per day. A valid timed start/end interval may supply a known duration, which must be visible in the import preview. A lone start time leaves duration unknown.

When recognizing the app’s own exported events or trusted supported metadata, preserve the original timing state and distinguish declared or recorded duration from export-only scheduling placeholders. Do not reverse-engineer a real duration from an end time or all-day span the app added only to satisfy calendar representation. Linking or re-importing must not upgrade unknown duration without an explicit user correction.

Expand recurring events into individual selectable occurrences within the chosen range and track occurrence identity. Exclude canceled occurrences. Do not mistake a recurring series identifier for the identity of each separate session.

For a multi-day event, show its full date range and the proposed mapping. Default to one session anchored to its start date while retaining the source span as provenance; never silently turn it into one session per day. An all-day or multi-day calendar span must not become a measured activity interval or generate hours. Explicit timed intervals or separately confirmed durations follow the timing rules above.

Detect previously imported events and possible matches to existing local sessions. Default to skipping recognized imports; require review for uncertain matches rather than silently creating duplicates or merging separate sessions.

Import is a read operation on the source calendar. Do not modify, move, or delete source events.

MANUAL EXPORT — ONE ACTIVITY PER OPERATION

Allow users to export all sessions of one activity in a single operation, or a selected subset, optionally restricted by a date range.

Use this workflow:

Choose an activity → Choose Google Calendar, Apple/iPhone calendars, or both → Choose the actual destination calendar and any supported label → Review and customize events → Resolve duplicate warnings → Confirm export.

When exporting to two distinct destinations, maintain independent destination settings, duplicate checks, and results.

The review must be a vertically scrollable list. Each row must clearly show the activity name, proposed calendar event title, session notes or an expandable notes preview, date, any clock times, the known activity duration or “Duration not specified,” selection state, destination, and duplicate/export status. Distinguish recorded activity duration from any outgoing calendar scheduling span.

Provide individual selection and deselection and scoped select-all/deselect-all controls. Export only the confirmed selection.

The default calendar event title is the activity name. Allow per-event title and content overrides in the export review, including notes and date/time where needed.

Export-review edits are changes to the outgoing event by default, not silent changes to the stored session or the category name. Make this distinction visible and require an explicit action to apply an edit back to the session.

Provide optional batch prefix and suffix fields with immediate previews of the final titles. Permit a prefix, a suffix, or both, preserving the characters and spacing the user enters.

Use a clear composition rule:

Final title = batch prefix + per-event base title + batch suffix.

The base title defaults to the activity name and can be overridden individually. Recompute previews without repeatedly appending the same prefix or suffix. Preserve individual overrides while changing batch text, and provide a reset action.

Map session notes to the event’s description/notes and location to supported location fields, preserving useful map links. Make inclusion of notes and location explicit in the preview, with controls to omit them from export.

Map each session’s timing state explicitly in the export preview:

Date only: Represent the date as a calendar date marker, using the all-day area when appropriate and visibly disclosed. This is a calendar presentation choice, not a claim that the activity lasted all day or 24 hours. Local duration remains unknown.

Start only: Preserve the start time. If the destination requires an end time, use only a user-approved export-only scheduling span or a previously configured, visible preset. Keep local duration unknown. Otherwise leave the export pending for review rather than inventing activity hours.

Start and end: Export the recorded interval using the correct dates and timezone. Keep its actual recorded duration distinct from provider-specific date boundary conventions.

Duration only: Preserve the absence of clock times. A date-marker representation may carry the declared duration as clearly labeled event content or supported metadata, subject to the preview. Do not invent a start time. A user may choose an outgoing scheduling time explicitly without silently changing the local session.

Any export-review time override changes the outgoing calendar event only unless the user explicitly applies it back to the session. A scheduling placeholder must never change local recorded-hour totals. Preserve original timing provenance in supported metadata and stored export snapshots so later reads do not silently convert display conventions into activity duration.

Do not add attendees or send invitations when exporting a personal session. Make reminder and visibility behavior clear and do not silently turn a historical log into a calendar notification campaign.

After confirmation, report created, linked, updated, skipped, failed, and pending items per destination. A partially successful batch must be recoverable without recreating successful items.

OPTIONAL AUTOMATIC EXPORT AFTER SAVING

Provide a manual-only mode and an explicitly enabled automatic-export mode. Automatic export is off by default.

Users must be able to enable automatic export for all activities or selected activities, choose Google Calendar, Apple/iPhone calendars, or both, and configure default destinations with per-activity overrides where useful.

Configuration must include actual destination calendars, supported labels, title prefix/suffix rules, whether notes and locations are included, and explicit calendar-representation rules for date-only, start-only, interval, and duration-only sessions. Any start-only scheduling fallback requires opt-in and remains export-only; it must never be counted as activity duration. When an outgoing representation has not been approved, queue that export for review without blocking local session saving.

Once enabled and configured, automatically attempt export after each eligible new session has been committed locally. Normal, unambiguous exports should not require the user to repeat the manual batch review after every save.

Persist export jobs reliably and display their state. Distinguish a session saved locally from an event accepted by a calendar integration and, where not directly verifiable, from completed cloud synchronization.

When offline, unauthorized, interrupted, or temporarily rate-limited, keep the session and a recoverable pending or failed export. Retry safely when execution, connectivity, and permissions permit. Never promise immediate cloud delivery regardless of platform conditions.

Imported sessions must not automatically create an import/export loop. Exclude them from automatic re-export by default unless the user explicitly enables forwarding, and never duplicate their source event back into the same calendar.

Known duplicates must not be recreated. Possible duplicates or unresolved destination ambiguities must enter a “Needs review” state rather than being automatically overwritten or blindly duplicated.

Turning automatic export off must stop future automatic writes and clearly allow cancellation of pending jobs. It must not delete already exported events.

DUPLICATE DETECTION & SAFE RECONCILIATION

Check the actual selected destination calendar before exporting. Local export history alone is insufficient because matching events may have been created manually or by another tool.

Separate recognized linked events from heuristic matches and from events that could not be checked.

For recognized events, use stored provider/account/calendar/event links and supported application metadata. Track the identity of recurring occurrences, not just their parent series. Reconcile stale references rather than assuming every external identifier remains valid forever.

For possible duplicates, compare the intended local date, available start time and known activity duration, normalized original and final titles, known activity wording, location, and supporting notes where appropriate. Account for known prefix/suffix rules and prior export snapshots. Missing duration is unknown evidence, not a zero-hour match or a mismatch; export-only scheduling spans are not recorded activity durations.

Do not identify duplicates by date alone. Two surf sessions on the same day may be legitimate separate sessions. Do not equate all-day events and timed events with certainty merely because their dates match.

Show a status and a comprehensible reason, such as “Already exported,” “Possible duplicate — same day and similar title,” “Linked event changed,” or “Not checked — calendar access unavailable.”

Allow the user to inspect the existing event’s title, notes, date/time, and calendar alongside the proposed event before deciding.

Offer appropriate actions: skip; link the session to an existing event without changing its content; deliberately create a separate event; or explicitly review and update a linked, writable event. Use skipping as the safe default for recognized duplicates.

Never overwrite, merge, or delete a manually created event merely because a heuristic considers it similar. A deliberate update must show the intended changes and receive explicit confirmation.

Make retries and repeated exports idempotent: retrying the same session-to-destination operation must not create another event after a previous successful write. Persist operation identity and results, and reconcile an uncertain write outcome before retrying it as a new creation.

A session can link to different events in genuinely different calendars. Export status and duplicate resolution must be tracked separately for each destination.

IMPORT/EXPORT IS NOT UNCONTROLLED TWO-WAY SYNC

Support user-initiated imports, user-initiated exports, and configured automatic export of new sessions. Do not silently infer continuous bidirectional synchronization.

Local edits, activity renames, and deletions must not automatically overwrite or delete external events. Indicate when a linked export differs and provide explicit review/update actions. Deleting a local session must default to leaving calendar events untouched.

Do not silently overwrite local notes or session details from a later calendar read. Any reconciliation of divergent data must be deliberate and understandable.

PERMISSIONS, PRIVACY & PLATFORM HONESTY

Request calendar permissions and Google authorization when the user invokes the relevant feature, not during basic session logging.

Use the minimum access needed for the requested workflow. Import, existing-event inspection, and duplicate checking require readable event data; never present a write-only connection as if duplicate checking had succeeded.

Use supported authentication flows and secure credential storage. Do not hard-code secrets or replace a real authorized integration with fake data. Do not expose unrelated calendar contents to external services unnecessarily.

Show the chosen account and calendar before writing, including shared-calendar context when available, so the user understands where notes and locations will be published.

Keep integrations behind clear platform interfaces. Document any required provider project, OAuth configuration, map configuration, native build capability, or user-granted permission that cannot be completed inside the execution environment.

Continue implementing everything that does not depend on the blocker. Clearly distinguish implemented code, configured integrations, tested operations, and unavailable capabilities.


PERFORMANCE IN SERVICE OF THE CREATIVE VISION

Let the intended experience guide the engineering. Do not choose a less original visual direction merely because it is easier to implement.

Build performance-aware foundations from the beginning, but do not preemptively simplify the artistic concept based on untested assumptions about technical cost.

Choose an architecture capable of expressing the intended motion language. Avoid complexity that contributes nothing, but embrace sophisticated techniques and purposeful dependencies when they materially improve the experience or enable its distinctive visual identity.

Atmosphere, rhythm, anticipation, physical presence, and emotional resonance are legitimate purposes for motion. An animation does not need to display information or respond directly to a gesture to deserve its place.

Use ambient movement deliberately, balancing it with stillness. Do not remove it merely because a static interface would be cheaper to render.

Target smooth 60 FPS during interactive animation on real iPhones while protecting touch responsiveness, battery life, and thermal behavior.

When performance problems arise, investigate the actual bottleneck. First improve rendering, scheduling, reuse, and state management rather than immediately reducing visual ambition.

Where appropriate, move animation work outside the JavaScript thread, reuse drawing primitives, minimize unnecessary rerenders, and avoid expensive per-frame allocations.

Evaluate performance through profiling and real-device testing where available. Clearly distinguish measured limitations from assumptions and unverified targets.

If genuine device constraints require adaptation, preserve the signature interactions, visual identity, and expressive character of the experience. Simplify selectively and deliberately, not by replacing the original concept with generic UI.

Stop unnecessary rendering when the app is inactive.

The objective is not the simplest possible animation system. It is the most compelling artistic experience that can be engineered to work reliably within real mobile constraints.


USABILITY & ACCESSIBILITY

Experimental must not mean confusing.

A surfer should be able to open the app directly in the last-used activity and record a session within seconds, using only a few deliberate interactions. Keep the active activity symbol, name, and switching control immediately visible. Missing notes, address, map link, clock times, or duration must never block saving.

Provide readable typography, sufficient contrast, appropriately sized touch targets, accessible labels and semantics, visible selection states, gesture alternatives, clear back navigation, and useful error feedback.

Essential information must never depend solely on color, animation, or spatial effects. Provide an accessible textual alternative for map and miniature-calendar information.

Provide a coherent reduced-motion experience that preserves the complete workflow and the application’s visual identity.

Keep transitions interruptible and touch feedback immediate. Users must never be trapped waiting for a visual sequence.

When requirements compete, protect data correctness, accessibility, responsiveness, and fast logging. Adapt the choreography rather than making users wait or abandoning the artistic direction.

Keep advanced history, session details, and calendar settings progressively disclosed rather than forcing them into the core logging path.

Complexity belongs in the implementation, not in the user’s workflow.


ONE-SHOT AUTONOMOUS IMPLEMENTATION

Treat this as a complete, one-shot, end-to-end development mission.

You have full creative and technical autonomy to make reasonable decisions, choose implementation strategies, solve problems, and complete the application without unnecessary development confirmations.

This autonomy concerns implementation decisions. It does not authorize bypassing the application’s required user confirmations, calendar permissions, external-account consent, or safeguards against destructive changes.

Build the real product from the beginning, using production-oriented architecture, real domain models, persistent storage, and functioning interactions.

Do not build a disposable prototype with the intention of rebuilding it later.

Begin with the complete signature journey: direct entry in the active activity, optional transformative activity switching, multi-date selection in the living calendar, reliable saving with no required extra details, and animated personal history. Persist the active activity from the first functional implementation.

Make this first flow genuinely distinctive and fully functional in the final codebase. Then extend the same architecture and visual language to every remaining feature.

The development phases define the order of implementation, not stopping points.

Do not stop after planning, a proof of concept, an MVP, or the first functional version. Do not ask whether to continue after an intermediate milestone.

Work autonomously through implementation, testing, debugging, optimization, accessibility, and interaction refinement, as far as the execution environment allows.

Do not implement every feature superficially merely to claim completeness. Resolve the details that make the requested functionality reliable and the creative execution convincing.


VERIFICATION & DELIVERY

Run the application and inspect the actual experience wherever the environment permits.

Verify category creation and management, multi-date logging, persistence after restart, intentional same-day sessions, accidental duplicate prevention, session editing and deletion, and statistics updates.

Verify first launch with Surf active, relaunch into the last-used activity, immediate date selection without choosing an activity again, discoverability and accessibility of the activity switcher, persistence after switching, and safe handling of a deleted remembered category. Ensure old saved selections are not accidentally logged again.

Verify both Month and Year history modes, period totals, multi-year scrolling, direct temporal navigation, collapsible mini calendars, and correct display of several sessions on the same day.

Test creating, editing, and clearing every optional detail independently and saving with all optional fields empty. Verify independent details after multi-date logging, including explicitly applying the same duration separately to several sessions. Verify supported Google Maps links, unresolved links, unavailable maps, and offline session saving.

Verify all four timing states, fractional-hour entry, start/end calculations, explicit overnight intervals, clearing an end time or duration, and persistence of unknown values. Date-only and start-only sessions must never generate duration, and duration-only sessions must never generate fictitious clock times.

Use a concrete statistics acceptance test with four sessions of the same activity: one date-only session; one start-only session at 08:00; one same-day interval from 09:00 to 11:00; and one duration-only session of 1.5 hours. The result must be four sessions, 3 h 30 min of recorded duration, and duration coverage of two out of four sessions. Unknown values must not be treated as zero or 24 hours. Editing or removing either known duration must update the totals and coverage.

Check activity, monthly, annual, and filtered hour totals, duration-only sessions in the calendar history, and the unavailable state when no durations are known. Verify that export scheduling defaults, all-day imports, repeated imports, and linked external events do not add invented hours or duplicate session counts.

Check date accuracy across month and year boundaries, including leap years, timezone changes, and daylight-saving transitions. Verify all four timing states through import/export, round trips of recognized app-generated events, separation of calendar spans from activity duration, and explicit handling of multi-day events.

Test import filters separately and together, including title-only matching, source calendars, supported labels, complete multi-year retrieval, recurring occurrences, per-event selection, repeated imports, and excluded cancellations.

Test manual export to each provider and both distinct destinations, destination selection, notes/location inclusion, per-event overrides, prefix/suffix previews, confirmed selection, and preservation of original local session data.

Test recognized exports, manually created possible duplicates, legitimate same-day sessions, linking without overwriting, explicit updates, partial batch failures, and retries after uncertain outcomes.

Verify automatic-export opt-in, activity/destination settings, durable pending jobs, permission revocation, offline recovery, duplicate review, prevention of import/export loops, and disabling automatic export.

Test interrupted animations, repeated interactions, reduced-motion behavior, empty states, and local save-error recovery.

Use the results to refine both functionality and visual execution.

Do not claim measured frame rates, real-device performance, native capabilities, real calendar writes, or successful tests without actually verifying them in an appropriately authorized environment. Use test accounts/calendars rather than modifying unrelated personal data during development.

Deliver the runnable implementation with exact setup and run instructions, including necessary integration configuration.

Clearly distinguish implemented and tested functionality, implemented but unverified functionality, and anything unfinished or blocked by a specific external dependency or environment limitation.

If an unavoidable blocker prevents part of the work, document it precisely and complete everything else that can be completed independently.

Never present a partial implementation as the finished product.


THE FINAL CREATIVE CHALLENGE

Imagine a legendary motion design studio creating an interactive tribute to the extraordinary power and elegance of breaking ocean waves.

Now imagine that experience is also the simplest, most intuitive way to record a surf session and revisit a personal history.

Make the user feel the energy of the ocean beneath their fingertips.

Make every transition carry momentum.
Make every transformation feel fluid and inevitable.
Make the powerful moments spectacular.
Make the quiet moments elegant.

Capture the force of the wave, the elegance of its movement, and the emotion of surfing.

The experience should feel like riding a wave: effortless, fluid, powerful, and unforgettable.

Don’t build an app and animate it.

Build a living interactive motion graphics experience that happens to be an incredibly good app.

One prompt. Full autonomy. Complete product.

Go all out. Build it.

Language: Italiano

NATIVE iOS APPLICATION REQUIREMENT

The primary deliverable must be a genuine, installable iOS application that runs natively on an iPhone, not merely a responsive website or browser-based experience.

Prefer React Native with Expo, TypeScript, React Native Skia, and Reanimated, while retaining the freedom to use Swift, SwiftUI, Metal, or native iOS modules whenever they provide a meaningful advantage for motion graphics, performance, or platform integration.

Prioritize iOS functionality, visual quality, and performance above cross-platform compatibility.

Structure the project so it can be built, installed, and tested on a real iPhone, with clear instructions for development builds and eventual distribution through TestFlight or the App Store.

If the execution environment cannot compile or run an iOS build, still implement the actual iOS application codebase and clearly document the remaining build and device-testing steps. Do not replace the intended native application with a web-only implementation.

---

Nome app: Serie (non corduroy)
```
