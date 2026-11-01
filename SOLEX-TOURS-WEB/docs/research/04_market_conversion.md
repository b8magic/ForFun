# 04 · Market and conversion research: how the new Solex Tours site can out-convert other Acatenango operators

Researched 2026-11-01. This was read-only research. Nothing was posted, messaged, submitted or signed up for, and no booking flow was started.
Every external fact below carries its source URL and the date it refers to. **UNVERIFIED** marks anything I could not confirm. Solex facts come from `/tmp/solex_raw/transcript.txt` (voice notes, 31 Oct 2026), `/tmp/solex_raw/about_owner_summary.txt`, `/tmp/solex_raw/site_text.txt` (current site, last published 16 Apr 2026) and the sibling reports `01_site.md` and `02_social.md`.

---

## 0. Key findings (TL;DR)

1. **Solex is mid-priced, not cheap.** Q750 is about **US$98** at the Banguat reference rate of **7.64187 GTQ/USD (31 Oct 2026)**. The other local operators in La Soledad are cheaper: ASOAVA Q500, V-Hiking Q600 + Q100 entry, Soy Tours Q660. The big Antigua brands cost more all-in: OX US$119 + Q100 entry ≈ **US$132**, Wicho & Charlie's ~US$150–165, Old Town Outfitters US$148–253. Solex therefore can't win on price. It has to win on proof of experience: the view, small groups, the owner and the trailhead base.
2. **Several of Solex's "unique" claims are not unique.** OX also lets guests decide on the Fuego add-on at camp and pay afterwards, and so does Wicho & Charlie's. Luggage storage is standard (OX, Tropicana, Lava Trails, CA Travelers, Camp AKT, V-Hiking). Cabins with bedding already set up are standard among cabin operators. Being local is contested by V-Hiking (breakfast at the guide's family home in La Soledad), Soy Tours ("the main local guide agency"), ASOAVA (a guides' association) and Tropicana ("partnership with La Soledad"). **The 1:8 guide ratio is not better than competitors'**: Wicho & Charlie's, Lava Trails and V-Hiking advertise 1:6, ASOAVA 1:7 and Tropicana 1:8.
3. **Where Solex can honestly win** (each needs photo or review proof, see §4):
   - **(a) The cabin looks straight at Fuego, and sunset is visible from camp** with no extra walk. Wicho & Charlie's, for comparison, sells a separate 100Q sunset hike.
   - **(b) The tour starts at the owner's home at the La Soledad trailhead.** Bags stay there, which shortens the trip to Lake Atitlán.
   - **(c) It is a small owner-run outfit, not 40–70-person departures.**
   - **(d) Expectations are honest**, for example "guides speak mainly Spanish", and the price includes park entry and transport.
   - **(e) Social proof is a perfect 5.0 on Google from 25 reviews.** The reviews repeat these same themes.
4. **Fuego is a legal risk for the site.** CONRED (3 Aug 2026) prohibits approaching Fuego's crater and "El Camellón". CONRED (9 Aug 2026) says ascending Fuego "is not authorised". The Acatenango municipality (Aug 2026) says access to Fuego through the park remains prohibited. INGUAT (10 Oct 2026) warned that organising or selling trips to restricted areas can bring administrative and criminal liability. Nearly every competitor still sells a "Fuego hike" for 200–300Q or US$40. **Recommendation: don't advertise a priced Fuego extension on the new site.** Instead, make "Fuego straight in front of your cabin, no extra hike needed" the hero message. Alexander must make the final call (§3).
5. **Traveller worries are consistent across 2024–2026 sources.** In rough order: difficulty and fitness, cold at night, what's really included and the total cost, whether you'll actually see Fuego, group size and rushing, toilets, altitude, guide language, packing, luggage and onward travel to Atitlán. The ranked top-15 FAQ is in §2.3.
6. **Competitor homepages are weak at converting.** None shows price, group size, a camp-view photo and a WhatsApp button together above the fold. OX leads with generic "Experts in Adventure". Wicho & Charlie's leads with a slogan and award badges. Tropicana leads with "Traveling to Guatemala?". Most bury price and policies or contradict themselves (Lava Trails and Tropicana show inconsistent prices). A Solex page that answers *price, what's included, who's in your group, where you sleep and how to book* in the first screen has a clear edge.
7. **WhatsApp-first is the market norm.** ASOAVA books only by WhatsApp, Instagram or Facebook. Wicho & Charlie's pushes users to WhatsApp, and OX, Tropicana and Lava Trails show WhatsApp next to checkout. However, only **32% of US adults use WhatsApp** (Pew, 2025). The site therefore needs a non-WhatsApp fallback (phone, Instagram or Facebook DM).
8. **There are policy gaps that could cost bookings.** Solex has no published deposit, cancellation, closure or weather policy. There is no toilet information, no written "what if I can't make it to camp" answer, and the site and voice notes contradict each other on start time (6:30 vs 8:00) and meals (4 vs 3). Competitors publish refund tiers: Wicho & Charlie's 90/40/0, Tropicana 72 h, Old Town Outfitters 25% fee and nothing within 15 days. These questions need answers from Alexander before launch (§7).

---

## 1. Competitor study

### 1.1 Access log (what was tried, 2026-11-01)

| Source | Result |
|---|---|
| oxexpeditions.com (home + `/tours/acatenango-overnight/`, `/tours/acatenango-overnight-hike/`) | Read via WebFetch. A direct non-browser request got HTTP 406 (ModSecurity). I did not try to get around this. |
| wichoandcharlies.com (home + `/acatenango-volcano-hike`) | Read |
| adventureguatemala.com (Old Town Outfitters) tour page + `/payments-and-refunds` | Tour page read. Refund page only via search snippet. |
| lava-trails.com | Read. The Rezdy store `lavatrails.rezdy.com` returned **403**. |
| tropicanahostel.com (home + `/product/acatenango-hike/`) | Read |
| soytours.com | Read (no prices on the page) |
| V-Hiking | No own website found. Rezdy store returned **403**. Used the Quetzaltrekkers partner page and search snippets. |
| ASOAVA, CA Travelers, Camp AKT, Extreme Life, Trek Guatemala | Secondary only, via thoroughlytravel.com comparison (1 Oct 2026) |
| Rezdy stores (OX `laantiguaguatemala.rezdy.com`, Wicho `wichocharlies31.rezdy.com`) | **403**. Only search-engine snippets were available. |
| getyourguide.com | **403** |
| reddit.com (search JSON, WebFetch) | **403 / "unable to fetch"**. No Reddit thread surfaced in 6 search-engine queries either. Reddit sentiment is therefore **UNVERIFIED**. I used blogs and operator FAQs instead. |
| TripAdvisor forums | No thread surfaced in search. Not fetched. |
| backpacker.com "left behind" story | Login redirect (Outside account). Not read. |
| foratravel.com trip report | HTTP 429. Not read. |

### 1.2 Comparison matrix (8 operators read directly, 5 from a secondary source)

Prices are per person for a 2-day/1-night shared option unless stated. The **Side** column follows thoroughlytravel's classification (1 Oct 2026). Alexander's "left-hand side, facing Antigua/Guatemala City" corresponds to that article's **east** side, and his "right-hand side, Fuego ahead, sunset, Atitlán" to the **west** side.

| Operator | Price | Group / ratio | Camp | Side | Fuego add-on handling | Booking | Deposit / cancellation | Homepage leads with |
|---|---|---|---|---|---|---|---|---|
| **Solex Tours** (for reference) | **Q750 (≈US$98)**, incl. transport, park entry, guide, 3 meals, cabin bedding. Porter Q250 each way (13 kg). | 2–8 per guide, 2nd guide from 9. Groups of friends up to 40–50 taken. | Shared 6-bed cabins with mattress, sleeping bag and pillow. Private for 2 "if numbers allow". | West/"right": Fuego ahead, sunset, Atitlán (owner's claim) | Q300, decided and paid at camp (owner). **See §3.** | WhatsApp + Carrd form (current site) | **None published** | Spanish hero "Conquista el Volcán Acatenango con los Auténticos Guías Locales" |
| **OX Expeditions** (Antigua, since 2004) | **US$119** + **Q100 entry not incl.** (≈US$132 all-in). "Double Whammy" US$149. | Not stated. "Max 24" per thoroughlytravel. | Wood cabins ("watching the Fuego Volcano erupt … from the comfort of your wood cabin!"). Also Deluxe Camping and Camp 2. | East (lowest camp) | **+US$40, "decide to upgrade … when you get to our camp site". Paid "when you get back to our office in Antigua".** | Online calendar, **"Book Now, Deposit $29"**. WhatsApp + phone in header. | No refund terms on the page. Cancels only for "tropical storm or severe weather forecast warning". | "OX Expeditions, Experts in Adventure". Multi-activity, values strip. |
| **Wicho & Charlie's** (Antigua, 2017) | ~US$150–160 shared, US$395 private for 2 (thoroughlytravel). Rezdy snippets: 2025 6-person shared cabin from **US$165**, private for 2 from **US$354**. | ~16. **1 guide : 6**. | A-frame wooden cabins, shared 4/6/8, private 2. 4x4 carries big bags ~80% of the way. | East (highest camp) | 250Q Fuego hike, or 100Q alternative **sunset hike**. Decided at base camp, **paid at the office on return**. Cancelled on the reviewers' day because "gases were deemed too unsafe". | "Book Now" + WhatsApp ("If you don't have WhatsApp please email us") | **90% refund ≥72 h, 40% at 48–72 h, 0% <48 h.** No refund for weather on the hike. Refund/reschedule for government advisories. | "ACATENANGO VOLCANO HIKE / READY, SET… HIKE!", 6 TripAdvisor award badges, National Geographic UK mention |
| **Old Town Outfitters** | **US$148–253** depending on group size. Porter **US$75** round trip. | Not stated. "Without fixed departure days and required minimums". | High-altitude tents on a private bench-cut camp ~3,750 m, "sweeping views of the Antigua valley and Volcan Fuego" | East-facing (Antigua valley) | **Not offered** on the overnight tour | Online "join or start a group" + phone + WhatsApp | Deposit = 2-person price. **25% cancellation fee. No refunds <15 days.** PayPal +3.8%. | Tour page: "Witness the evening fireworks show from nearby and very active Volcan Fuego". Guide "from the community of La Soledad". |
| **Tropicana Hostel** (Antigua) | **US$90** regular, US$109 Flashpacker, US$125 VIP cabin, US$350 couple package | Booking form up to 8. **"Per each 8 people … 1 guide"**. Groups "can exceed 70" (thoroughlytravel). | Shared cabins (15/8/6 beds) with blanket and pillows | West | Not on the product page. 250–300Q per thoroughlytravel ("inconsistent"). | **Online checkout** + WhatsApp "Chat with us" + Hostelworld | "cancellation … must be made 72 hours prior". Booking form: "Refund not applicable if booked within 24 hours". | "Traveling to Guatemala? Acatenango Tour running everyday!", "After guiding more than 100,000 travellers" |
| **Lava Trails** | US$94–116 (Camp 1, 10-bed dorm cabins), US$99–120 (Camp 2, 4-bed). Prices **inconsistent on the homepage**. Deposit **US$24** (search snippet). | Camp 1 max 20, Camp 2 max 12. 1:6 (thoroughlytravel). | Cabins, two camps | Not stated | 200Q (thoroughlytravel). Not on the homepage. | Rezdy "Book Now" + WhatsApp + Google Forms + "Request tour" | Not on the homepage (T&C link) | "Elevating Adventure and Comfort", "Overall 4.9/5 star reviews" (no count) |
| **Soy Tours** (office in La Soledad per thoroughlytravel) | **Q660** incl. park entry (livinginguatemala, read 25 Oct 2026, and thoroughlytravel) | "Can exceed 40", "up to 45". Base camp seats ~10–15. | A-frame cabins 2/3/4 | West | 250Q. "Extra Fuego walk at 05:00 pm". | Online reservation page ("QUIERO RESERVAR") | Not stated | "Sube Acatenango con nosotros", "main local guide agency", "thousands of clients … each year" |
| **V-Hiking** (Elvin, La Soledad) | **"From Q 600"** + Q100 entry (Quetzaltrekkers page, undated; thoroughlytravel) | Max 30, 1:6 (thoroughlytravel) | Shared 3–4 / private 2 cabins, front window facing Fuego (Rezdy snippet) | East | 200Q, "optionally hike over to Fuego" | Rezdy + partner link. No own site found. | Not found | No website. **Breakfast at the guide's family home, luggage stored there, and the only operator one blogger found offering transport straight to Lake Atitlán.** |
| ASOAVA (guides' association)* | Q500 | ~20, 1:7 | Shared 4 / private 1–2 cabins | East | 250Q | **WhatsApp, Instagram, Facebook only** | — | Spanish website |
| CA Travelers* | Q700 | Max 24 | Cabins + tents | East | ~US$30 | Link | — | — |
| Camp AKT* | US$80 shared / US$125 private + Q100 entry | Max 12 | 4-bed / 2-bed cabins | West | 300Q | Link | — | "Some guides have limited English" |
| Extreme Life* | US$70–85 | Max 11 | Shared cabins, private Miratenango entrance | — | 200Q / US$35 | Link | — | — |
| Trek Guatemala* | US$169–319 | Max 24 | Tents / glamping | — | **US$109, must be arranged in advance** | Link | — | — |

\* Source for starred rows: thoroughlytravel.com (1 Oct 2026). Not checked on the operators' own sites.

**Sources for the matrix (date the data refers to):**
- OX: https://oxexpeditions.com/ , https://oxexpeditions.com/tours/acatenango-overnight/ , https://oxexpeditions.com/tours/acatenango-overnight-hike/ (live pages read 2026-11-01). Also livinginguatemala (read 25 Oct 2026): US$119 + US$40 upgrade, https://livinginguatemala.com/activities/volcan-fuego-hike/
- Wicho & Charlie's: https://www.wichoandcharlies.com/ and https://www.wichoandcharlies.com/acatenango-volcano-hike (read 2026-11-01). Rezdy listing snippets "(2025) Acatenango 6 person shared cabin … From USD $165.00", https://wichocharlies31.rezdy.com/669583/2025-acatenango-6-person-shared-cabin , and "(2025) … Private Cabin (Price for 2 hikers) … USD 354", https://wichocharlies31.rezdy.com/669586/2025-acatenango-private-cabin-price-for-2-hikers (2025 prices, snippet only). Experience review by Thoroughly Travel (8 Sep 2026): https://www.thoroughlytravel.com/?p=47001
- Old Town Outfitters: https://adventureguatemala.com/tour/acatenango-volcano-overnight-hike (read 2026-11-01). Refund terms via search snippet of https://adventureguatemala.com/payments-and-refunds (undated).
- Tropicana: https://tropicanahostel.com/ and https://tropicanahostel.com/product/acatenango-hike/ (read 2026-11-01)
- Lava Trails: https://lava-trails.com/ (read 2026-11-01). The US$24 deposit comes from a search snippet of https://lavatrails.rezdy.com (UNVERIFIED directly).
- Soy Tours: https://www.soytours.com/ (read 2026-11-01). Price from livinginguatemala (25 Oct 2026) and thoroughlytravel (1 Oct 2026).
- V-Hiking: https://www.quetzaltrekkers.com/xela/acatenango/ (undated, read 2026-11-01). Rezdy snippet https://vhikingtours16.rezdy.com/411247/shared-cabin-acatenango-overnight . Lake Atitlán transfer from https://imperfectidealist.com/guatemala-1-week-itinerary/ (dated 15 Dec 2025, updated 9 Sep 2026).
- All operators, secondary: "12 Best Acatenango Volcano Tour Companies Compared", Thoroughly Travel, **1 Oct 2026**, https://www.thoroughlytravel.com/?p=45772
- Exchange rate: Banguat, **7.64187 GTQ per USD, valid 31 Oct 2026**, https://www.banguat.gob.gt/tipo_cambio/

### 1.3 What the matrix means for Solex

**Price position.**

| Band (2026) | Operators | All-in per person |
|---|---|---|
| Budget local | ASOAVA Q500 · V-Hiking Q600+Q100 · Soy Q660 · Camp AKT US$80+Q100 | ≈US$65–93 |
| **Solex** | **Q750 incl. entry and transport** | **≈US$98** |
| Mid Antigua | Tropicana US$90–125 · Lava Trails US$94–120 | US$90–125 |
| Upper Antigua | OX US$119+Q100 (≈US$132) · Wicho & Charlie's ~US$150–165 · OTO US$148–253 | US$132–253 |

- Solex costs **~Q50–250 more than its La Soledad neighbours**. The site must justify that premium with the view, the camp, small groups and its reviews.
- Against OX, Solex is **~US$34 cheaper all-in**, because OX excludes the Q100 entry fee. That is an honest price anchor: "Park entry included, no surprise fee at the gate."
- The market range quoted by bloggers is "US$84–150" (livinginguatemala, updated 28 Oct 2026, https://livinginguatemala.com/volcanoes/acatenango-overnight-hike-guatemala-2026/), "70–150 USD" (bucketlistly, 29 Oct 2026, https://www.bucketlistly.blog/posts/acatenango-fuego-complete-hiking-guide) and "US$50 to over US$350" (Travelling Troubadour, 4 Feb 2026). Q750 sits in the middle.

**Inclusion gaps compared with mid and upper competitors** (these will come up as objections):
- **Warm jacket.** It is included at OX, Wicho & Charlie's, Lava Trails, Tropicana, Soy, CA Travelers and ASOAVA. At Solex, jackets are a rental (current site: "Alquiler… Chaquetas"), and only gloves and hats are included. *Either include a jacket or show the rental price next to the main price.*
- **Water.** Tropicana and Lava Trails include 4 L. Solex makes 4 L per person mandatory to carry ("REGLA DE ORO"). *Say where to buy it (Alexander's house at the trailhead?), UNVERIFIED.*
- **Meals.** Most competitors list 4 meals (often breakfast before the hike). Solex has 3 per the voice note, but the current site says 4. *Resolve before launch.*
- **Big-bag transport.** Wicho & Charlie's (4x4) carries packs most of the way up. Solex offers a porter at Q250 each way.

**Group size.** Don't market "1:8" as better than others, because it isn't (1:6 at Wicho & Charlie's, Lava Trails and V-Hiking). Market **"2–8 hikers per guide, and a second guide from the 9th hiker"**, the owner's story about leaving 35–60-person groups, and reviews that say "never rushed". Competitor group totals that Solex visibly undercuts: Soy "up to 45", Tropicana "can exceed 70", OX "max 24", V-Hiking "max 30" (thoroughlytravel, 1 Oct 2026). Bucketlistly (29 Oct 2026) saw "groups of 40 to 60, which the author found too loud".

**Booking mechanics.** Big Antigua brands take a small online deposit (OX US$29, Lava Trails US$24, OTO 2-person price) and keep WhatsApp for questions. Local operators (ASOAVA, V-Hiking word of mouth) and Solex rely on WhatsApp. A **WhatsApp-only flow with no deposit** is low-friction for the guest but risks no-shows. Alexander should decide whether to take a deposit (§7).

**Homepage messaging.** Every competitor leads with adventure language, the eruption, awards or volume ("100,000 travellers", "thousands each year"). **Nobody leads with the person** (owner or guide) or with the photo from the actual cabin. That is Solex's opening.

---

## 2. Traveller questions and objections (2024–2026)

### 2.1 Evidence by theme

| Theme | What travellers and writers say | Source (date) |
|---|---|---|
| **Difficulty** | "Very Hard… not technically difficult but very physically demanding, mostly uphill". Ascent ~5 h. | bucketlistly, 29 Oct 2026, https://www.bucketlistly.blog/posts/acatenango-fuego-complete-hiking-guide |
| | "You don't need to be an athlete, but you do need decent stamina, determination, and the willingness to go slow." ~14 km round trip, ~1,600 m gain. Descent hard on knees. | backpackerswanderlust, 16 May 2026 (upd. 20 Oct 2026), https://www.backpackerswanderlust.com/acatenango-volcano-hike-difficulty/ |
| | ~5 h to base camp. Start 2,400 m, camp 3,750 m, summit 3,976 m. Steep "slip and slide" scree on the sunrise summit. | Thoroughly Travel, 8 Sep 2026, https://www.thoroughlytravel.com/?p=47001 |
| **Altitude** | "Altitude was a bigger challenge than the walking". Dizziness and nausea at night. | Thoroughly Travel, 8 Sep 2026 (as above) |
| | Spend 1–2 days in Antigua first. | adventuresfromelle, 7 Nov 2025, https://adventuresfromelle.com/2025/11/07/acatenango/ |
| **Cold at night** | Campsite nights "usually 0°C to -2°C", rare fronts to about -5°C. Dry-season nights about 0–5°C. (Operator blog.) | Tropicana blog, 8 Dec 2025, https://tropicanahostel.com/acatenango-temperature-how-cold-it-gets-and-the-best-time-to-hike/ |
| | Dec–Jan base camp 0–5°C. | livinginguatemala, upd. 28 Oct 2026 |
| | Summer-weight sleeping bags with a broken zipper on a cheap tour. Writer would "choose one with cabins". | Our Escape Clause, upd. 17 Jan 2026, https://www.ourescapeclause.com/hiking-volcano-acatenango/ |
| **Toilets** | Single latrine at camp. | adventuresfromelle, 7 Nov 2025 |
| | Trailhead restrooms 5–10Q cash. Compost toilets on the trail, so bring paper and sanitiser. | Thoroughly Travel, 8 Sep 2026 |
| | "Bathrooms stay basic". | Tropicana blog, 2 Feb 2026, https://tropicanahostel.com/is-camping-acatenango-worth-it-honest-pros-and-cons-checklist-before-you-go/ |
| **Crowds / noise** | "Hundreds of people climb the trail at once". "Avoid companies that run excessively large groups." | Travelling Troubadour, 4 Feb 2026, https://travellingtroubadour.substack.com/p/the-mountain-the-algorithm-built |
| | Author's group ~18; others 40–60, "too loud". | bucketlistly, 29 Oct 2026 |
| | Soy base camp seats ~10–15, "not everyone can sit". Tropicana "crowded and noisy". | thoroughlytravel, 1 Oct 2026 |
| **Rushed / mixed-pace groups** | Mixed groups from several agencies, "paces varied widely". "The actual organization of the tour made the entire experience less pleasant than it had to be." | Our Escape Clause, upd. 17 Jan 2026 |
| | Groups split by pace. | Thoroughly Travel, 8 Sep 2026 |
| **Guide language** | Search-snippet summaries of tour reviews mention "challenges due to guides primarily speaking Spanish" and a group "put on a Spanish tour even though we booked the tour in English". | WebSearch summaries of theabroadguide.com / booking-site reviews, 2026-11-01. **Wording UNVERIFIED** (snippet, not read in full). |
| | Camp AKT: "some guides have limited English". ASOAVA: "less guaranteed English". | thoroughlytravel, 1 Oct 2026 |
| | Porters "often speak only Spanish, but they can guide you". | backpackerswanderlust, 2026 |
| **Food** | Cheap tours: "meals were more like snacks" (bologna sandwich, bruised banana, instant ramen). | Our Escape Clause, upd. 17 Jan 2026 |
| | Advice: don't pick the cheapest tour, because weak food, cramped camps or inattentive guides are hard to fix on the mountain. | bucketlistly, 29 Oct 2026 |
| **Seeing Fuego** | A friend on a cloudy day "saw nothing". Eruptions every ~15–20 min after sunset. | bucketlistly, 29 Oct 2026 |
| | Fog first evening, eruptions visible from ~1 AM. | adventuresfromelle, 7 Nov 2025 |
| **Fuego hike** | "Technically not allowed". Company guides won't go, but "can arrange a local guide for about 250 GTQ … cash". | bucketlistly, 29 Oct 2026 |
| | "Our tour company took them for an extra $25 per person", described as "willing to take us outside the confines of the law". | alittlebithuman, 26 Feb 2023, https://alittlebithuman.com/hiking-acatenango-volcano-guatemala/ |
| **Luggage / Lake Atitlán** | Writer cancelled OX because V-Hiking "was the only one that offered transportation" from the volcano straight to the lake, and left bags at the owner's house. | imperfectidealist, 15 Dec 2025 / 9 Sep 2026, https://imperfectidealist.com/guatemala-1-week-itinerary/ |
| | Most travellers leave luggage in Antigua. "Some tour companies will hold bags for an extra fee." | bucketlistly, 29 Oct 2026 |
| **Porters** | Q150–200 one way for ~10 kg, "pay the porter directly". | backpackerswanderlust, 2026 |
| | 200 GTQ each way. | bucketlistly, 29 Oct 2026 |
| **Safety** | Aug 2024: a tourist died and another was badly injured in "La Meseta", a restricted high-risk area between Acatenango and Fuego. INGUAT asked prosecutors to identify the operator. | AGN, 22 Aug 2024, https://agn.gt/inguat-pide-al-mp-investigar-caso-de-turista-fallecida-en-faldas-del-acatenango |
| | Blogs repeat that six hikers died of hypothermia on Acatenango in 2017. | livingoutlau (upd. 9 Feb 2023), Our Escape Clause. **Date and details UNVERIFIED** against primary news. |
| **Closures** | Fuego began a new eruptive phase on 3 Aug 2026. Acatenango access was restricted, then reopened **7 Aug 2026** (Municipalidad de Acatenango, Comunicado 09-08-2026). | elsalvador.com, 10 Aug 2026, https://www.elsalvador.com/?p=1287218 |
| **Booking advice** | Cancel 24–48 h for partial refund is typical. Closures usually lead to rescheduling or credit. | thoroughlytravel, 1 Oct 2026 |
| | Peak season sells out 1–3 weeks ahead (late Nov–early Apr). | livinginguatemala, upd. 28 Oct 2026 |
| **Solo travellers** | Two people per tent on one tour, so a solo hiker "may end up sleeping next to a stranger". | alittlebithuman, 26 Feb 2023 |

### 2.2 What Solex's own Google reviews already answer

From `02_social.md` §3.4 (Google Maps, retrieved 2026-11-01, https://maps.google.com/?cid=8806719826350754210):
- **Never rushed:** "él nunca nos apresuró ni nos dejó atrás" (Tania P., Mar 2025).
- **Guides spread across a group of 17:** Elena C., Apr 2024.
- **View:** "The hut at base camp has probably the best view of volcán de fuego" (Jeremy H., Jul 2026), plus 4 similar.
- **Food:** "The food was absolutely delicious" (Rachel C., Feb 2026).
- **Flexibility:** "Alex was super helpful when we wanted to change days at last minute" (Ricky S., May 2026).
- **Local:** "It's nice to be paying a local family and local guide rather than a big agency" (Meghan J., May 2026).

Use these as proof directly under the matching FAQ answers.

### 2.3 Ranked top-15 FAQ for the new site

Ranking is based on how often a theme appeared across the sources above and how directly it blocks a booking decision. Answers are outlines built only from Solex facts. ⚠ marks a point Alexander must confirm.

| # | Question | Answer outline (Solex facts) | Proof / note |
|---|---|---|---|
| 1 | **How hard is it? Am I fit enough?** | Steep, non-technical, ~5 h up to camp (industry-wide figure). Small groups mean you walk at your own pace. A second guide joins from the 9th hiker. ⚠ Turn-back policy: what happens if someone can't continue? | Review Q10 "never rushed". Suggest 1–2 nights in Antigua to acclimatise. |
| 2 | **How cold is it, and what keeps me warm?** | Cabin (not a tent) with mattress, sleeping bag and pillow already there. Gloves and hat included. ⚠ Jacket: included or rental price? Bring layers. Nights around freezing in dry season (Tropicana blog, Dec 2025). | Show the cabin interior video frame. |
| 3 | **What's included, and what's the real total?** | Q750 (≈US$98): round-trip transport from Antigua, park entry, local guide, lunch, dinner and breakfast, hot chocolate and coffee, cabin bedding. Extras only if you want them: porter Q250 up / Q250 down (13 kg), gear rental. You carry 4 L water. ⚠ 3 or 4 meals. | "Park entry included" (OX excludes Q100). |
| 4 | **Will I actually see Fuego erupt?** | Camp sits on the right-hand route with Fuego straight ahead, so you can see small eruptions too, but only when it's clear. Clouds are common May–Oct, clearer Nov–Apr. Nobody can promise the weather. | Owner photos `cabin_fuego_day.jpg`, `fuego_eruption_night_*.jpg`. Reviews Q6, Q7, Q12. |
| 5 | **Can I hike to Fuego?** | See §3. Recommended honest answer: authorities currently prohibit ascending Fuego (CONRED/INGUAT, Aug–Oct 2026). From our camp you watch it straight ahead, so you don't need the extra 4-hour hike. | Owner decision required. |
| 6 | **How big is the group? Will I be rushed?** | 2–8 hikers per guide, with a second guide from 9. Alexander started Solex after guiding 35–60-person groups where slow walkers were hurried. | Owner story + Q10, Q11 |
| 7 | **Where do I sleep? Shared or private?** | Shared cabins for 6. Couples can sometimes have a cabin to themselves if there are few guests, and Alexander confirms closer to the date. ⚠ Are cabins mixed-gender for solo travellers? | Don't present private as standard (02 §4 rule 6). |
| 8 | **Is there a toilet at camp? Can I wash?** | ⚠ **UNVERIFIED for Solex. Ask Alexander:** latrine or dry toilet at camp, paper provided, hand-washing water? Bathroom at Alexander's house before the hike is confirmed (voice note 09). | Every competitor avoids this question, so a straight answer is a trust win. |
| 9 | **Do the guides speak English?** | Mainly Spanish, some English. See §4.3 for wording. | Owner voice note 08 |
| 10 | **Altitude sickness: what if I feel bad?** | Go slowly and tell your guide. ⚠ Policy on descending with a guide at night, and whether there's a second guide or radio. | Needs Alexander's answer |
| 11 | **What should I pack?** | 4 L water (mandatory), warm layers, rain jacket (wet season), headlamp, sun protection, snacks, cash for extras. Rentals: jacket, backpack, headlamp, poles, shoes. | Current site rental list |
| 12 | **Can I hire a porter?** | Yes: Q250 up, Q250 down, up to 13 kg. Book in your WhatsApp message. | Current site |
| 13 | **Where do I leave my luggage? Can I go straight to Lake Atitlán?** | Bring your suitcase on the shuttle and leave it at Alexander's house at the trailhead in La Soledad. Collect it on the way down. Going to Panajachel the same day can save ~40 min (owner's estimate). ⚠ Can Solex arrange the onward transfer, and at what price? | Competitor proof that demand exists: imperfectidealist (V-Hiking transfer) |
| 14 | **Where and when is pickup, and when am I back?** | Café Condesa (Parque Central) or Café La Parada (Parque La Merced), Antigua. ⚠ **8:00 (voice note) vs 6:30 (current site).** ~1 h drive. Dropped back at the same point. ⚠ Return time. | Resolve the conflict |
| 15 | **How do I book, pay and cancel? What if the volcano is closed or it rains?** | ⚠ **UNVERIFIED. Needs a written policy:** deposit yes/no, cash GTQ/USD/card, cancellation window, reschedule when authorities close the park (as on 3–7 Aug 2026), weather. | Competitors publish tiers (Wicho & Charlie's 90/40/0, Tropicana 72 h) |

Runners-up (cover in tour detail or quick-reply messages): vegetarian/vegan meals ⚠, solo travellers and cabin mixing ⚠, travel insurance, best season, sunrise summit (camp is ~1 h below the summit and you leave bags at camp), phone charging and signal ⚠, tipping ⚠, children and age limits ⚠.

---

## 3. The Fuego question (regulation and how it changes positioning)

**Official position (latest found):**

| Date | Authority | What it says | Source |
|---|---|---|---|
| 3 Aug 2026 | CONRED | "está prohibido acercarse al cráter del volcán de Fuego y a la zona conocida como 'El Camellón'" | https://conred.gob.gt/recomendaciones-ante-nueva-fase-eruptiva-del-volcan-de-fuego/ |
| 9 Aug 2026 | CONRED (via Emisoras Unidas) | Ban on ascending Fuego remains in force, for civilians and CONRED staff alike: "no está autorizado el ascenso al Volcán de Fuego" | https://www.emisorasunidas.com/nacional/2026/08/09/continua-activa-la-prohibicion-para-subir-el-volcan-de-fuego/ |
| 7–10 Aug 2026 | Municipalidad de Acatenango (via elsalvador.com) | Park reopened 7 Aug. "el acceso al Volcán de Fuego por medio del parque permanece prohibido". Stay on authorised routes. | https://www.elsalvador.com/?p=1287218 |
| 10 Oct 2026 | INGUAT (via AGN) | Authorities maintain "la prohibición de ascenso al volcán de Fuego". Organising or selling trips to restricted areas "puede dar lugar a responsabilidades administrativas y penales". Named two unregistered entities. | https://agn.gt/inguat-denuncia-uso-indebido-de-su-imagen-en-promocion-turistica/ |
| 22 Aug 2024 | INGUAT (via AGN) | Fatal accident in restricted "La Meseta" between Acatenango and Fuego. INGUAT asked prosecutors to identify the operator. | https://agn.gt/inguat-pide-al-mp-investigar-caso-de-turista-fallecida-en-faldas-del-acatenango |

**The market's reality:** almost every operator still sells a Fuego option. OX US$40, Wicho & Charlie's 250Q, Lava Trails 200Q, Soy 250Q, Tropicana 250–300Q, AKT 300Q, ASOAVA 250Q, V-Hiking 200Q, Trek Guatemala US$109 (thoroughlytravel, 1 Oct 2026; operator pages above). livinginguatemala (25 Oct 2026) notes that operators describe it as a ridge/shoulder extension, and that CONRED's notices "do not establish official permission for a route sold commercially as a ridge extension". Whether the specific route Solex's guests take is inside the prohibited zone is **UNVERIFIED** (the editor's note in the transcript says "the exact route is unspecified").

**Recommendation for the proposal** (Alexander decides; this is not legal advice):
1. **Do not list a "Fuego extension" with a price, a CTA or a photo of people on Fuego** on the English site. Also avoid review excerpts that mention climbing Fuego (02 §4 rule 5). The current Spanish site's "Extensión a Volcán de Fuego por solo $40 / Q300" is exactly the kind of promotion the 10 Oct 2026 INGUAT notice targets.
2. **Turn this into the main selling point:** *"Fuego is straight in front of your cabin. No extra 4-hour hike in the dark, no extra cost. Watch it erupt from the door, with hot chocolate."* This is true by the owner's account, supported by 5 reviews and owner photos, and it lets Solex beat every competitor who needs the extra hike to deliver close-up eruptions.
3. FAQ wording (honest, neutral): *"Can I hike to Fuego? Guatemalan authorities currently prohibit ascending Fuego and approaching its crater (CONRED, INGUAT, 2026). We follow official guidance. From our camp you're looking straight at Fuego, so you don't need to go closer to see it erupt."* Link to the CONRED page.
4. If Alexander insists on keeping an optional walk, it must use only routes that authorities permit that day. It should be described generically ("ask your guide at camp about optional walks permitted that day") and not sold online.

---

## 4. Positioning: where Solex can win

### 4.1 Claim audit (what's unique, what's parity, how to say it)

| Solex strength | Competitor parity? | Proof available | Verdict and wording |
|---|---|---|---|
| **Fuego straight ahead from the cabin** (right-hand/west route) | East-side camps (OX, Wicho & Charlie's, V-Hiking, CA, ASOAVA) see Fuego from a different angle. OX and Tropicana also claim cabin views of Fuego. Soy, Tropicana and AKT are also on the west side. | Owner photos. 5 reviews ("probably the best view", "perfect view"). | **Lead message, shown with photos, not superlatives.** "The view from your cabin door" and the actual photo. Avoid "the only/best view". Let the reviews say "best". |
| **Sunset from camp, no extra hike** | Wicho & Charlie's sells a 100Q sunset hike. East-side camps face sunrise and Antigua. | Owner photos `sunset_*.jpg` | **Strong.** "Sunset from camp, included. No extra hike." |
| **Start at Alexander's home at the La Soledad trailhead** | V-Hiking (breakfast at Elvin's family home), Soy (La Soledad office). OTO's guide is from La Soledad. | Google pin G4R7+6M Aldea La Soledad. Owner story. | **Strong if personal.** Show Alexander's face and name, and "I welcome you at my house" (his words). Don't claim "first local agency" (unverifiable, 02 §3.1). |
| **Leave luggage at the trailhead, shorter route to Atitlán** | Storage is standard. A direct transfer is rare (V-Hiking was "the only one" for one blogger). | Owner voice notes 08–09 | **Good secondary point.** "Heading to Lake Atitlán next? Leave your bag with us at the trailhead." ⚠ Offer a transfer only if Alexander can arrange one. |
| **2–8 per guide, second guide from 9** | 1:6 at Wicho & Charlie's, Lava Trails and V-Hiking. 1:7 ASOAVA. 1:8 Tropicana. | Owner + reviews Q10, Q11 | **Use with the story, not as a ratio war.** "Small groups, at your pace. I used to guide groups of 40–60. Never again." |
| **Cabins with bedding already up** | Parity with every cabin operator | Owner video | **Table stakes.** Show it to reassure, but don't claim it as unique. Contrast only with tent tours. |
| **Decide on extras at camp, pay only if you go** | OX and Wicho & Charlie's do the same | Owner | **Parity.** Use only as generic reassurance ("no prepaid extras"). Never attach it to Fuego (§3). |
| **"What we tell you is what you get"** | Competitors contradict themselves (Lava Trails and Tropicana price conflicts, Tropicana porter conflicts) | Owner voice note 08. Review "very professional". | **Brand voice.** Back it with a clear inclusion list, a published policy and real photos only. |
| **Park entry included in the price** | OX, V-Hiking and AKT exclude Q100 | Current site, voice note 02 | **Good price anchor.** "No surprise fee at the gate." |
| **Guides speak mainly Spanish** | OX and OTO promise bilingual guides | Owner voice note 08 | **Honest-expectation asset** (§4.3) |
| **5.0 on Google, 25 reviews** | Lava Trails "4.9/5" (no count). Others show badges but no numbers. | 02 §3 | **Trust strip**, dated "(Nov 2026)" |

### 4.2 Positioning statement (draft)

> **Acatenango the local way.** Start at Alexander's home at the trailhead in La Soledad, hike in a small group at your own pace, and sleep in a cabin that looks straight at Fuego, with sunset from camp. Q750 covers transport, park entry, guide, three meals and your bed on the mountain.

Proof triplet under the hero: **Fuego from your cabin** · **2–8 hikers per guide** · **5.0★ Google (25 reviews)**.

### 4.3 Turning "guides speak mainly Spanish" into a positive, honest expectation

Why say it up front: mismatched language expectations are a recurring complaint (search-snippet summaries, §2.1, wording UNVERIFIED). Two competitors are already candid about it (AKT, ASOAVA in thoroughlytravel). Alexander himself insists on disclosing it ("I do want to tell you that"). Stating it before booking turns a possible 1-star surprise into a self-selected, well-matched guest.

Principles:
1. **Say it plainly, once, near the price and in the FAQ.** Don't hide it in small print.
2. **Reframe it as authenticity and care.** The guide grew up on this volcano. Reviews describe guides as caring, fun and attentive (Sergio "keeping the positive vibes up", guides "checking in on every member").
3. **Remove the safety worry.** Explain that safety basics are covered (⚠ suggest Alexander gives the briefing with a simple English card or phone translation), and that WhatsApp has built-in message translation (rolled out from Sept 2025: Android EN/ES among the first 6 languages, iPhone 19+; on-device; https://about.fb.com/news/2025/09/introducing-message-translations-whatsapp/).
4. **Give an exit.** "If you need a fluent English-speaking guide, tell us before you book and we'll be honest about whether we can help." This builds trust even with people who don't book.

Copy options:
- **A (warm):** "Your guide is from La Soledad and has walked this volcano all his life. He speaks mainly Spanish and some English. Between smiles, gestures and a few words, our guests say it works. You'll be checked on all the way up."
- **B (practical):** "Language: guides speak mainly Spanish, with some English. Safety basics are explained before you start. Need a fluent English guide? Ask before booking and we'll tell you honestly."
- **C (playful, for the FAQ):** "¿Hablas español? Great, you'll love it. No? Our guides speak some English, and 'Fuego!' needs no translation."

### 4.4 Comparison table for the site: "Solex vs a typical big Antigua tour"

Rules: name no competitors. Each row must be true for Solex and fair to "typical big tours". **Include one row where the big agency wins (language)**, because a table with an honest loss is more believable.

| | **Solex Tours (La Soledad)** | **Typical big Antigua tour** |
|---|---|---|
| Where you start | Alexander's home at the trailhead | An office in Antigua, sometimes with a briefing the evening before |
| Group size | 2–8 hikers per guide, a 2nd guide from 9 | Shared departures that can reach 20–70 hikers |
| Your camp view | Fuego straight ahead from the cabin | Often Fuego to one side, with Antigua in front |
| Sunset | From camp, no extra walk | Sometimes an extra sunset hike |
| Park entry | Included | Sometimes added at the gate (Q100) |
| Your bed | Cabin with mattress, sleeping bag and pillow already up | Cabin or tent, depending on the tour |
| Your suitcase | Stays at the trailhead, handy for going on to Lake Atitlán | Stays in Antigua |
| Guide language | Mainly Spanish, some English | **Usually bilingual** ✔ |
| Price | Q750 (≈US$98) all-in | US$90–165, plus extras |

Evidence per row: start (OX "Pre-Trip meeting at 5 PM the day before", oxexpeditions.com, 2026-11-01); group (Soy "up to 45", Tropicana "can exceed 70", thoroughlytravel 1 Oct 2026; bucketlistly "groups of 40 to 60", 29 Oct 2026); view (owner voice notes 06 and 08, east/west camps per thoroughlytravel); sunset (Wicho & Charlie's 100Q sunset hike, thoroughlytravel / Thoroughly Travel 8 Sep 2026); entry (OX, V-Hiking, AKT exclude Q100); price band (thoroughlytravel 1 Oct 2026, livinginguatemala 28 Oct 2026). Keep the "20–70" figure only if the proposal accepts these secondary sources. Otherwise write "Large shared departures".

---

## 5. Conversion patterns for a WhatsApp-first tour business on mobile

### 5.1 Evidence base (and its limits)

- **WhatsApp is how this market books.** ASOAVA takes bookings only via "WhatsApp, Instagram, or Facebook" (thoroughlytravel, 1 Oct 2026). Wicho & Charlie's says "If you don't have WhatsApp please email us" (homepage, 2026-11-01). OX shows "+(502) 37270652 - WhatsApp" in the header (2026-11-01). Tropicana has "Chat with us" (+502 4313 3215) next to checkout (2026-11-01). Lava Trails mixes Rezdy, WhatsApp and Google Forms (2026-11-01).
- **But not every visitor has WhatsApp.** 32% of US adults used WhatsApp in 2025 (Pew Research Center, survey 5 Feb–18 Jun 2025, https://www.pewresearch.org/internet/2025/11/20/americans-social-media-use-2025; figure via secondary coverage, Pew page not read directly). Europeans and Latin Americans use it far more (no source fetched, UNVERIFIED). **A fallback is required:** a phone call, Instagram DM or Facebook Messenger. The domain has no email (01 report: no MX record).
- **Hard data on WhatsApp buttons is weak.** The only "10× conversion" figure for a travel WhatsApp button is a vendor claim with no data (Omnichat blog, https://blog.omnichat.ai/travel-whatsapp-business-growth-strategy/). Sticky-CTA lifts of 3–9% come from e-commerce vendor A/B tests with mixed results, including one test with a 20% *drop* in add-to-cart (https://cleancommit.io/ab-tests/mobile-bottom-sticky-add-to-cart-button/ and related pages, undated). No primary Baymard or NN/g finding was accessible (Baymard case study paywalled). **Treat these patterns as best practice to measure, not guaranteed lifts.**
- **Free cancellation and pay-later:** Viator launched "Reserve Now & Pay Later" in 2019 and said conversion data was "too preliminary to share" (Arival, https://arival.travel/tripadvisor-launches-reserve-now-pay-later-booking/). Airbnb self-reported a 70% booking uplift on eligible stays (lodging, not tours; secondary press, 2025–2026). Direction: lowering upfront commitment helps. Solex's "no payment to ask" is the WhatsApp equivalent.

### 5.2 Patterns to build (with Solex-specific specs)

**1. Sticky bottom bar (mobile).**
- Left: "Q750 · ≈US$98 per person". Right: a green button **"Check my date on WhatsApp"**.
- Height ≤ 64 px. One vendor guide (https://cartylabs.com/blog/shopify-sticky-add-to-cart-bar) warns that bars over ~70 px feel intrusive. Respect the iOS safe area.
- Hide the bar while the booking widget (pattern 2) is on screen, so two CTAs don't compete.
- Fallback link under the main CTA: "No WhatsApp? Call +502 4834 7003 · Instagram".

**2. Prefilled WhatsApp message builder (the core conversion widget).**
- Fields: tour (default *Acatenango 2 days/1 night*), date (native date picker), people (stepper 1–8+, showing "9+? We send a second guide"), optional extras checkboxes (porter up / down, jacket rental).
- The button builds a `wa.me` link. Format: `https://wa.me/<digits>?text=<url-encoded>`, with the number in digits only and no "+" (Bird explainer, https://bird.com/explained/whatsapp/what-is-a-whatsapp-click-to-chat-link, read 2026-11-01). WhatsApp only places the text in the composer: "It does not send a message automatically". The guest still has to tap send, so tell them: *"WhatsApp will open with your message ready. Just tap send."*
- Keep the message short. Bird notes Meta's **140-character limit for prefilled messages on Meta-generated short links/QR codes**. Plain `wa.me?text=` links aren't documented with that limit (UNVERIFIED), but brevity still helps.
- Template, bilingual so Alexander can read it at a glance:
  ```
  Hi Solex! I'd like to book Acatenango 2 days/1 night.
  Date: Sat 8 Nov 2026
  People: 2
  Pickup: Antigua
  (Hola Alexander: Acatenango 2D/1N, 08/11/2026, 2 personas)
  ```
  Encoded example (159 chars before encoding; trim the Spanish line if needed):
  `https://wa.me/50248347003?text=Hi%20Solex%21%20I%27d%20like%20to%20book%20Acatenango%202%20days%2F1%20night.%0ADate%3A%20Sat%208%20Nov%202026%0APeople%3A%202%0APickup%3A%20Antigua%0A%28Hola%20Alexander%3A%20Acatenango%202D%2F1N%2C%2008%2F11%2F2026%2C%202%20personas%29`
- Route to **+502 4834 7003**, the number on Google and on 7 of the 8 current links (01, 02 reports). Show +502 4946 8883 as "second number" in the footer only.
- Write dates unambiguously ("Sat 8 Nov 2026" and "08/11/2026"). Guatemala uses day/month, many US guests use month/day.

**3. Price display and anchoring.**
- Lead with **GTQ, then USD**: "**Q750** per person · about US$98". Explain once: "We price in quetzales. USD is approximate (Banguat rate 7.64, 31 Oct 2026)."
- ⚠ The current site uses a fixed 7.5 rate (Q750 = US$100). If Alexander accepts **US$100 cash** as a fixed alternative, say "Q750 or US$100 cash". That is simpler, but guests paying USD lose about 2% at today's rate. Alexander should choose.
- **Anchor on what's included, not on competitors' names:** "Transport + park entry + guide + 3 meals + cabin bed. No surprise fee at the gate." Then show the optional extras with prices (porter Q250 each way, jacket rental ⚠ price). Transparency here answers FAQ #3, the most common money objection.
- Show the four tours as cards with the overnight tour as "Most booked". Keep the Day, Sunset and Midnight tours (Q675 / Q750) visibly secondary.

**4. Trust strip** (directly under the hero, one line, horizontally scrollable on small screens):
`★ 5.0 Google · 25 reviews (Nov 2026)` · `Based at the trailhead, La Soledad` · `2–8 hikers per guide` · `Cabins with beds ready` · ⚠ `INGUAT-registered` (only if Alexander supplies his registration. The Facebook snippet "guías certificados por INGUAT" is UNVERIFIED, see 02 §2. INGUAT urges tourists to check that providers are registered: AGN, Apr 2022, https://agn.gt/?p=141236).

**5. Reassurance microcopy** (next to every WhatsApp CTA, max 2 lines):
- "Asking is free. No payment until we confirm your date."
- "Alexander replies personally ⚠ (usual reply time: ____)."
- "We'll send you real photos of the cabins and camp before you book."
- "Guides speak mainly Spanish, with some English" (link to FAQ).
- Under the price: "Pay extras only if you use them." Don't promise "free cancellation" until a written policy exists.

**6. WhatsApp Business app setup** (free; features as described at https://whatsappbusiness.com/products/business-app-features/, read 2026-11-01):
- **Greeting message** (auto-sent to new chats), in English plus one Spanish line: "Thanks for writing to Solex Tours 🌋 Alexander will reply soon. Meanwhile, here's what's included: …"
- **Away message:** sets expectations overnight, since Alexander answers late at night (voice note 08).
- **Quick replies** for the top-15 FAQ answers above, as pre-translated English text: `/included`, `/cold`, `/pickup`, `/luggage`, `/language`, `/policy`.
- **Labels:** New · Quoted · Date held · Paid · Done.
- **Catalog:** the 4 tours with photos and prices.
- **Business profile:** address G4R7+6M Aldea La Soledad, website link, hours.

**7. Page order for mobile** (each block answers one objection before the next CTA):
1. Hero photo from the cabin facing Fuego. Headline + 3-point proof. CTA.
2. Trust strip.
3. "What's included in Q750" plus optional extras with prices.
4. The view (day / sunset / eruption photos, 3 reviews).
5. How it works, as a timeline: pickup at Café Condesa/La Parada → Alexander's house (bathroom, bags, guide) → ~5 h hike → cabin, sunset, dinner, Fuego → sunrise summit → breakfast → down → Antigua or onward.
6. Small groups and Alexander's story (his quotes, with his photo ⚠).
7. Comparison table (§4.4).
8. Booking widget (pattern 2).
9. FAQ (top 15, accordions).
10. Other tours.
11. Footer: both numbers, Instagram, Facebook, Google review link, map pin.

**8. Measurement (keep it light).**
- Count taps on each `wa.me` link by position (hero, sticky, widget, FAQ) with a privacy-friendly counter, or simply by giving each position a slightly different prefilled text (e.g. "Hi Solex!" vs "Hello Solex!") that Alexander tallies.
- Ask "How did you find us?" in the greeting message.

### 5.3 Competitor patterns worth copying, and what to avoid

| Do (seen on competitors) | Avoid (seen on competitors) |
|---|---|
| Publish refund tiers clearly on the homepage (Wicho & Charlie's) | Contradictory prices and limits on the same page (Lava Trails US$94/104/116; Tropicana porter 10 kg/$35 vs 11 kg/Q250) |
| Show the cabin window facing Fuego (OX, V-Hiking listings) | Leading with generic "Experts in Adventure" (OX) or "Traveling to Guatemala?" (Tropicana) |
| Join-or-start-a-group transparency (OTO) | Excluding the entry fee from the headline price (OX), which feels like a surprise at the gate |
| A WhatsApp button next to every booking path (Tropicana, OX, Lava Trails) | Badges without numbers. Lava Trails' "4.9/5" with no count. |
| A small deposit online (OX $29, Lava Trails $24) if Alexander wants to cut no-shows | Selling a prohibited Fuego ascent (§3) |

---

## 6. Discrepancies to resolve before writing copy

| Item | Current site (16 Apr 2026) | Voice notes (31 Oct 2026) |
|---|---|---|
| Pickup time | 6:30 AM (camping tour) | "at eight in the morning" |
| Meals | 4 ("Desayuno, Almuerzo, Cena y Desayuno del día 2") | 3 (lunch, dinner, breakfast) + hot chocolate and coffee |
| Sleeping | "Duerme bajo las estrellas" + "Equipo de acampar instalado y cabañas" | Shared 6-person cabins with mattress, sleeping bag and pillow |
| Guides | "Guía local certificado" | "local guides… mostly Spanish". No certification mentioned. |
| Fuego | "Extensión a Volcán de Fuego por solo $40 / Q300" | Q300, decided at camp. Editor's note: ascent prohibited. |

---

## 7. Questions for Alexander (needed for conversion copy)

1. **Booking and payment:** deposit or not? Accepted payment (GTQ cash, USD cash at what rate, card, bank transfer)? When is it paid?
2. **Cancellation, weather and closure policy** in one sentence each (e.g. "Authorities close the volcano → free new date or full refund").
3. **Toilets at camp:** type, paper, hand-washing. Water for sale at the trailhead?
4. **Warm jacket:** included or rental (price)? Other rental prices.
5. **Pickup time** (6:30 or 8:00) and usual return time to Antigua.
6. **Meals:** 3 or 4? Vegetarian/vegan options?
7. **Turn-back / altitude policy:** what happens if someone can't go on?
8. **Solo travellers:** mixed cabins? Typical number of guests at camp in high season?
9. **Onward transfer to Panajachel/Lake Atitlán** from La Soledad: can he arrange it, and at what price?
10. **INGUAT registration number** (agency and/or guides), if any.
11. **Fuego:** agree to remove the priced extension from the English site (§3)?
12. **Typical WhatsApp reply time**, and who answers English messages (he replies in Spanish voice notes today).
13. Permission to show **his photo and name**, and guides' names from reviews.
14. Confirm the self-reported Google claims: founded 2019, "over 20 years" of experience, "first local agency" (02 §3.1).

---

## 8. Source list (all read or searched 2026-11-01 unless stated)

Operators: oxexpeditions.com (home, /tours/acatenango-overnight/, /tours/acatenango-overnight-hike/) · wichoandcharlies.com (home, /acatenango-volcano-hike) · adventureguatemala.com/tour/acatenango-volcano-overnight-hike · adventureguatemala.com/payments-and-refunds (snippet) · lava-trails.com · tropicanahostel.com (home, /product/acatenango-hike/) · soytours.com · quetzaltrekkers.com/xela/acatenango/ · Rezdy snippets (wichocharlies31, lavatrails, vhikingtours16, laantiguaguatemala).
Comparisons and guides: thoroughlytravel.com/?p=45772 (1 Oct 2026) · thoroughlytravel.com/?p=47001 (8 Sep 2026) · livinginguatemala.com/activities/volcan-fuego-hike/ (25 Oct 2026) · livinginguatemala.com/volcanoes/acatenango-overnight-hike-guatemala-2026/ (upd. 28 Oct 2026) · bucketlistly.blog (29 Oct 2026) · backpackerswanderlust.com (upd. 20 Oct 2026) · adventuresfromelle.com (7 Nov 2025) · ourescapeclause.com (upd. 17 Jan 2026) · travellingtroubadour.substack.com (4 Feb 2026) · imperfectidealist.com (15 Dec 2025 / 9 Sep 2026) · alittlebithuman.com (26 Feb 2023) · livingoutlau.com (upd. 9 Feb 2023) · tropicanahostel.com blog posts (8 Dec 2025, 2 Feb 2026, 17 Jul 2026).
Authorities and news: conred.gob.gt (3 Aug 2026) · emisorasunidas.com (9 Aug 2026) · elsalvador.com (10 Aug 2026) · agn.gt (10 Oct 2026; 22 Aug 2024; Apr 2022) · banguat.gob.gt (rate for 31 Oct 2026).
Conversion: bird.com WhatsApp click-to-chat explainer · whatsappbusiness.com business-app-features · about.fb.com (Sept 2025, message translations) · pewresearch.org (2025 social media use; via secondary coverage) · arival.travel (Viator RNPL) · cleancommit.io / cartylabs.com (vendor sticky-CTA tests) · blog.omnichat.ai (vendor claim).
Solex internal: /tmp/solex_raw/transcript.txt · about_owner_summary.txt · site_text.txt · /tmp/solex_research/01_site.md · 02_social.md.
