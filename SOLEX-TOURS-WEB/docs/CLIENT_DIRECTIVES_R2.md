# Client directives — round 2 (2026-11-09) — these OVERRIDE earlier docs where they differ

Feedback from the commissioner after viewing the live preview on an iPhone. Every item is binding. Tone rule behind all of it: **don't waste the visitor's time** — cut hedging and filler ("sometimes more", "around", "not optional", "in his words…"), sell the experience, keep facts crisp.

## A. Bugs
A1. iPhone: tapping the "How many of you?" + / − buttons twice or quickly triggers the browser's double-tap zoom. Fix it everywhere (e.g. `touch-action: manipulation` on html or on every control; keep pinch-zoom possible; inputs ≥ 16 px so iOS never zooms on focus).

## B. Facts confirmed / changed
B1. **4 meals**: breakfast, lunch and dinner on day 1, breakfast on day 2. Replace every "3 meals" (hero box, legend, ticket, timeline, FAQ, meta description, JSON-LD, booking texts…).
B2. Drinks: **"coffee or tea in the morning"** (hot chocolate at night stays).
B3. **Pickup is at 8:00 AM** (not "around", not "~"). **From 6:30 AM on request.** Standard line: "Pickup at 8:00 AM (from 6:30 AM on request). Please confirm the exact time and place with Alexander on WhatsApp." The ticket micro-line "Pickup around 8:00 AM. Alexander confirms the exact time on WhatsApp. Nothing is charged on this website." becomes exactly that line. Timeline labels: "8:00 AM · Antigua", "9:00 AM · La Soledad". Booking builder: add a pickup-time choice "8:00 AM (standard)" / "6:30 AM (on request)" and put the choice in the WhatsApp message.
B4. **Fuego hike**: "About 4 hours" — no "sometimes more" anywhere. Breakdown: roughly 2 hours out, about 30 minutes up there, 2 hours back. +Q300 per person, decided and paid at camp (keep).
B5. **Panajachel / Lake Atitlán**: it is an **optional add-on, on request**, that can **save you up to 90 minutes** if you're heading to Panajachel / Lake Atitlán (replace every "about 40 minutes").
B6. **Payment: cash only** — say it gently (e.g. "Payment is in cash, simple and with no card fees. Alexander confirms the details when he confirms your spot.").
B7. **Private cabin**: not only for two. On request and when camp is quiet, a solo traveller, a couple or a small group can have a cabin to themselves; Alexander confirms closer to the date.
B8. Night temperature at camp: usually between **−2 °C and +5 °C**.
B9. Camp has a **private platform with benches and chairs** facing Fuego.

## C. Copy changes (EN)
C1. Remove every "no extra hike" / "no extra walk" phrasing that could be confused with the Fuego extra hike (legend cell, door H3 "One view, three shows. No extra hike.", camp copy, comparison, etc.). Say instead e.g. "right from your cabin", "straight from camp", "no detour needed". **Exception**: the SUNSET timeline row (C12) may say "No extra hike needed" because it continues with the Fuego offer.
C2. Remove every "translated from Spanish", "condensed from his voice notes" and similar on Alexander's quotes/letter: attribution is just **"Alexander"**. (Customer reviews: keep a discreet way to read a Spanish review in the original — e.g. a small "Original" toggle — but no "translated" labels on Alexander.)
C3. "Activity changes from day to day" → be precise that it's **the volcano's activity**: e.g. "Fuego's activity varies from day to day: some nights bring frequent eruptions, others are quieter."
C4. Remove "Things don't go missing here." and every "In his words: …" luggage quote everywhere (timeline, included list, getting there, FAQ). Replace with two words on how luggage is kept: e.g. "Your luggage is stored safely at Alexander's house while you hike."
C5. "Overnight" alone is not enough: say **"Overnight hike"** / "Acatenango overnight hike" (hero kicker, ticket title "The Acatenango Overnight Hike", dock "Overnight hike · Q750", booking tour card, message tour name, menu, meta title/description).
C6. "What we won't promise" card: **remove** "An exact pickup time on this page…" and **remove** "The extra Fuego hike. It happens if you feel fit…". The "Fluent English" row: keep the honesty but **add Alexander's point about the guides**: warm, good-hearted, great entertainers, they make sure everyone leaves happy. Private-cabin row: per B7.
C7. "What you bring": remove "Our golden rule. Not optional." (keep "4 litres of water per person."). Everywhere drop "golden rule" filler. "Extra warm clothes. Nights at camp are cold." → add "usually −2 °C to +5 °C".
C8. Timeline Day 1: "About an hour's drive" moves into the **pickup** row (8:00 AM · Antigua). The La Soledad row keeps: bathroom, instructions, gear rental, meet your guide, luggage stored safely (C4).
C9. Timeline "MIDDAY / The climb" → label **"MORNING"**. "Lunch on day 1 is included" → "Lunch is included".
C10. Timeline AFTERNOON row: keep the current text and add: time to rest and enjoy the day and the landscape — in your cabin or outdoors right in front of the active Fuego volcano — and, if the sky is clear, to watch its incredible eruptions. Our private platform with benches and chairs lets you relax with the best view.
C11. Main Fuego-hike copy (ticket add-on card / Fuego block / FAQ) — add: "Your guide will advise you, from experience and from reading the mountain weather, whether it's worth heading toward Fuego's summit. With a bit of luck the sky will be clear and the view of the lava eruptions will be spectacular!"
C12. Timeline SUNSET row: "No extra hike needed — the view from our camp is already stunning. If you want it and feel up to it, the optional Fuego hike takes you as close to the summit of the active volcano as conditions allow (always within legal and safety limits)."
C13. Timeline RETURN row: the Panajachel option per B5 ("an optional add-on on request that can save you up to 90 minutes if you're heading to Panajachel / Lake Atitlán").
C14. "Other ways up Acatenango." keeps the H2 but needs the label **"Our other tours"** (kicker).
C15. Gear & porters: say clearly they are **for rent, on request, not included** (rental board title, chips, porter line).
C16. FAQ: "How do I pay?" per B6. "What if it's cloudy?" → remove "Ask him on WhatsApp what happens on a cloudy or rainy day." "What time is pickup, and where?" per B3. "Will we get a private cabin?" per B7. "Can I leave my suitcase?" per C4. Improve "What should I bring?" (crisp list: 4 L water, warm layers for −2 to +5 °C, hat & gloves, headlamp, good shoes, passport, cash; anything missing can be rented) and "Can I go straight on to Lake Atitlán?" (B5, how to ask). "Can I write in English?" → **"Can I ask questions in English?"** — answer simply that they can message in English or Spanish on WhatsApp; **remove the sentence about the form adding a Spanish summary** (it makes Alexander look external to the site).

## D. Fuego hike: make it a little more central to the offer
Still optional, still decided and paid at camp, but no longer hidden: e.g. a clearly designed "Optional upgrade" card next to the price (not buried in small print), a short Fuego-hike block with an eruption photo in the camp section, a legend/benefit mention, the SUNSET row (C12), and an "I'm interested in the optional Fuego hike (+Q300, paid at camp)" option in the booking builder that appears in the WhatsApp message (not added to the website total). The no-Fuego build switch must still remove every mention.

## E. Brand colour
The main Solex colour is the **light blue of the logo (#ABD4EA, sample it from media/site/logo.png to be exact)**. It must be far more present across the site — it should read as the brand colour at first glance on mobile (header/hero/sections/details), while keeping WCAG AA contrast and a strong, obvious booking CTA.

## F. Languages
F1. English stays the main language. A small **round flag button in the header** lets the visitor switch language (designed to take more languages later). Add **Spanish** now.
F2. After all the other changes, translate the **whole site** into Spanish: every visible string, alt texts, aria labels, meta/OG tags, JSON-LD, the JS strings (dock, guide counts, errors, toasts, dates) and the WhatsApp messages (on the Spanish page the message is fully in Spanish). Natural Latin-American Spanish as used in Guatemala tourism, **tú** form (as on Alexander's current site), warm and concise, no anglicisms. Prices "Q750 por persona (≈ US$100)", times "8:00 a. m." style or "8:00 AM" consistently. Spanish Google reviews appear in the original Spanish on the Spanish page.
F3. Technical: English stays the single source of truth; the build must fail (or loudly warn) on any untranslated visible string; relative URLs only; `hreflang` alternates; the switcher keeps the current section (hash) when switching.
