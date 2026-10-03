# Kisan 360 — Development Plan

Status of the MVP build, slice by slice. Each slice is a complete, tested path through the
product loop (PRODUCT_SPEC.md section 6). Scope comes from PRODUCT_SPEC.md section 24.

## Slice 1 — Farmer, farm and plot ✅ complete

Register → farmer profile → create farm → create plot → capture plot location → store → display.

| Task | Status |
|---|---|
| Next.js 16 + TypeScript + Tailwind project, ESLint | ✅ |
| Local Supabase (Docker), phone OTP with local test numbers | ✅ |
| Migration: PostGIS, `farmers`, `farms`, `plots` (location + boundary), triggers, RLS | ✅ |
| Session refresh proxy, server-side auth guards | ✅ |
| Hindi/English text system (Hindi default) and language switch | ✅ |
| Phone login (registration and login are one flow) | ✅ |
| Farmer profile onboarding | ✅ |
| Create and list farms | ✅ |
| Create plot: name, area or boundary, soil, irrigation | ✅ |
| Plot location: phone GPS (with accuracy), map pin, boundary drawing, area from map | ✅ |
| Farm page (map of plots + list) and plot page (map + details) | ✅ |
| Unit, integration (RLS) and end-to-end tests | ✅ |
| Docs: README, DATABASE.md v0.2 | ✅ |

## Slice 2 — Edit farm and plot ✅ complete

| Task | Status |
|---|---|
| Edit farm details (name, village, area, irrigation, soil); state/district stay from the profile | ✅ |
| Edit plot details, including moving or removing the pin and redrawing or clearing the boundary | ✅ |
| Shared forms for add and edit; saved values prefilled; map starts on the saved plot | ✅ |
| "Remove pin" on the location picker (also available when adding) | ✅ |
| Unit, integration and end-to-end tests for editing | ✅ |

Editing overwrites the current values (with `updated_at`); earlier boundaries are not kept.
See "Open questions" below.

## Slice 3 — Crop cycle creation ✅ complete

| Task | Status |
|---|---|
| Migration: `crop_catalog` (starter list, names in English and Hindi), `crop_cycles`, RLS | ✅ |
| Add a crop to a plot: crop, variety (typed), season, already sown?, sowing date, expected harvest | ✅ |
| Crop page; crops listed on the plot page; current crops shown on the farm page | ✅ |
| Fix: dropdown choices were lost after a form error (all forms) | ✅ |
| Unit, integration and end-to-end tests | ✅ |

## Slice 4 — Crop status changes ✅ complete

| Task | Status |
|---|---|
| Record sowing (Planned → In the field), adjusting the expected harvest if needed | ✅ |
| Harvest finished (In the field → Harvested) | ✅ |
| Cancel a planned or growing crop, with confirmation; cancelled crops are read-only history | ✅ |
| Change crop details (crop, variety, season, the dates that apply to its status) | ✅ |
| Database trigger enforcing allowed status changes; no lost updates between tabs | ✅ |
| Unit, integration and end-to-end tests | ✅ |

Not included on purpose: undoing a status change (for example, "harvested" by mistake), and
`COMPLETED`, which belongs to the season review.

## Slice 5 — Crop activities and expenses ✅ complete

| Task | Status |
|---|---|
| Migration: `crop_activities`, `expenses` with soft delete, RLS, closed after COMPLETED | ✅ |
| Record work done: type, date, optional quantity + unit, cost and notes | ✅ |
| Add a cost: category, amount (₹, accepts "2,500"), date, optional quantity, shop/person, notes | ✅ |
| Edit and remove (soft delete, with confirmation) entries made by mistake | ✅ |
| Crop page: "spent so far" total with work/cost split, work and cost lists | ✅ |
| Unit, integration and end-to-end tests | ✅ |

## Slice 6 — Harvest quantities and sales ✅ complete

| Task | Status |
|---|---|
| Migration: `harvests`, `sales` (generated gross/net, oversell check with row lock), soft delete, RLS | ✅ |
| Record harvests (one or more per crop): date, quantity in kg/quintal/tonne, quality, notes | ✅ |
| Record sales per harvest: who bought, quantity, price per unit, date, transport/other costs, payment | ✅ |
| "Sold / not sold yet" per harvest; no selling more than was harvested | ✅ |
| Crop result: money from sales − spent on the crop − selling costs = net (profit/loss), unpaid note | ✅ |
| Edit and remove harvests and sales (a harvest with sales cannot be removed) | ✅ |
| Unit, integration and end-to-end tests | ✅ |

## Slice 7 — Season review ✅ complete

| Task | Status |
|---|---|
| Migration: `completed_at` (set by the database), payment-only updates after closing, `crop_cycle_totals` view | ✅ |
| Review page: dates and days in the field, total cost, harvest, harvest per acre, sold, revenue, selling costs, net result, work done | ✅ |
| Reminders before closing (no harvest, unsold produce, unpaid sales) — they do not block | ✅ |
| Notes for next season; "Save season and close crop" sets COMPLETED | ✅ |
| After closing: read-only review, sales can still be marked as paid | ✅ |
| Plot page shows each closed season's profit or loss, for planning the next crop | ✅ |
| Unit, integration and end-to-end tests | ✅ |

The core loop from USER_WORKFLOWS.md section 20 now runs end to end, except crop photos and
monitoring (sections 8–9), buyer discovery (section 14) and scheme/insurance information.

## Slice 8 — Crop observations with photos ✅ complete

| Task | Status |
|---|---|
| Migration: `crop_observations` (farmers cannot write AI fields), `crop_photos`, private `crop-photos` bucket, storage policies | ✅ |
| Add an observation: photo (made smaller in the browser) and/or note, how the crop looks, date | ✅ |
| Photo kept in the form after an error; real image check on the server | ✅ |
| "Serious problem" suggests showing the crop to an agriculture expert (KVK, block office) | ✅ |
| Crop page "Crop health" section; timeline (Day N since sowing); remove an observation | ✅ |
| Crop health history in the season review | ✅ |
| Unit, integration (incl. storage policies) and end-to-end tests | ✅ |

AI analysis of photos (USER_WORKFLOWS.md section 8, "if enabled") is not built: the columns are
ready and protected, but choosing and validating an AI service is a separate decision.

## Slice 9 — Account deletion with photo cleanup ✅ complete

| Task | Status |
|---|---|
| Migration: `farmers.deletion_requested_at` (one-way), photo delete only after a request, `delete_my_account()` | ✅ |
| Profile page (name, mobile, village, district, state, language), linked from "My farms" | ✅ |
| "Delete my account": what is deleted, cannot be undone, tick to confirm, "Keep my account" | ✅ |
| Removes all photo files from storage, then the user and all farmer data; signs out | ✅ |
| A deletion that fails midway is finished on the next visit; the same number can start again | ✅ |
| Unit, integration (incl. storage and other farmers) and end-to-end tests | ✅ |

## Slice 10 — Farmer profile editing ✅ complete

| Task | Status |
|---|---|
| Migration: farmers may update only their profile fields (column-level grant) | ✅ |
| "Change my details" from the profile: name, language, state, district, village (saved values prefilled) | ✅ |
| Mobile number shown but not editable; farms already added keep their state and district | ✅ |
| Changing the language switches the app and is remembered | ✅ |
| Integration and end-to-end tests | ✅ |

## Slice 11 — Buyer discovery ✅ complete

| Task | Status |
|---|---|
| Migration: `buyers`, `buyer_demands`, `demand_interests`, one role per login, RLS | ✅ |
| Buyer registration ("Not a farmer? Register as a buyer"), with consent to show contact details | ✅ |
| Buyer publishes demand: crop, quantity, confirmed or indicative, quality, date, place, pickup, payment terms | ✅ |
| Buyer's demand list (farmers interested), demand page with interested farmers and call buttons | ✅ |
| Buyer closes demand (bought enough / cancelled), with confirmation | ✅ |
| Farmer market: filter by crop, place (district / state / anywhere) and quantity they have | ✅ |
| Demand page for farmers: confirmed vs indicative, verified or not, no-guarantee note, call the buyer | ✅ |
| "I'm interested" (shares name, village and phone with that buyer only, after a tick), with a message | ✅ |
| Links from "My farms" and from a crop in the field or harvested; buyer profile, edit and deletion | ✅ |
| Unit, integration (roles, privacy, filters) and end-to-end tests | ✅ |

## Slice 12 — Government scheme information ✅ complete

| Task | Status |
|---|---|
| Migration: `government_schemes`, `scheme_texts` (Hindi + English), `scheme_crops`, read-only RLS | ✅ |
| `import_scheme()` (service role) and `scripts/import-schemes.mjs` (now `import-official-data.mjs`) for the team; `docs/SCHEMES.md` | ✅ |
| Source and check date required; schemes checked more than 6 months ago are flagged | ✅ |
| Matching by state/district, the farmer's current crops and seasons, and deadline | ✅ |
| "May be relevant for you" with reasons, "Other schemes in your area"; never claims eligibility | ✅ |
| Scheme page: eligibility (official rules), benefit, documents, how to apply, deadline, official link, source | ✅ |
| Unit, integration (loading, validation, access) and end-to-end tests | ✅ |

**No real scheme information is loaded.** It has to be collected from official sources and
checked by the team (docs/SCHEMES.md); until then farmers see "No scheme information is
available yet".

## Slice 13 — Crop insurance information ✅ complete

| Task | Status |
|---|---|
| Migration: `insurance_products`, `insurance_texts` (Hindi + English), `insurance_crops`, read-only RLS | ✅ |
| `import_insurance_product()` (service role); `scripts/import-official-data.mjs` for schemes and insurance; `docs/INSURANCE.md` | ✅ |
| "Crop insurance for this crop" on a planned, growing or harvested crop: matched by crop, season and place | ✅ |
| Details: eligibility, coverage, premium, dates, how to report a claim, official link, source, check date | ✅ |
| Never promises a claim; enrolment closed and out-of-date information are flagged | ✅ |
| Shared rules and page parts for official information (schemes and insurance) | ✅ |
| Unit, integration and end-to-end tests | ✅ |

**No real insurance information is loaded**, for the same reason as schemes (docs/INSURANCE.md).

## Slice 14 — Crop planning ✅ complete

| Task | Status |
|---|---|
| "Plan the next crop" on a plot: plot facts (area, soil, irrigation) and the last crop grown there | ✅ |
| Choose a season; every catalog crop is a candidate | ✅ |
| From the farmer's own closed seasons in that season: result, cost, sales and harvest per acre (range and average), days in the field, seasons on this plot | ✅ |
| From the app today: buyers looking for the crop, crop schemes that may apply, open crop insurance | ✅ |
| Crops with records first, sorted by own average result per acre; "grown on this plot last" shown | ✅ |
| Clear note: facts from the farmer's records, not a prediction; no cost, harvest or price estimates | ✅ |
| "Plan this crop" opens "Add a crop" with the crop and season filled in | ✅ |
| Planning engine as a pure function with structured results; unit, integration and end-to-end tests | ✅ |

No migration: planning reads existing data. Not shown, because there is no verified data yet:
duration, water, labour and input needs, cost/revenue/margin estimates, production risks and
whether a crop suits the season (USER_WORKFLOWS.md section 5 lists these as "potentially").

## Slice 15 — AI crop-health assistance ✅ complete

| Task | Status |
|---|---|
| Migration: `crop_health_analyses` (separate from the observation), limits, feedback-only updates, RLS | ✅ |
| "Ask AI to look at the photo" on an observation with a photo, with what is sent explained first | ✅ |
| AI service (server only, `claude-opus-5-5`, structured output, refusal fallback); off without `ANTHROPIC_API_KEY` | ✅ |
| Only needed facts sent: photo, crop, season, days since sowing, district/state, farmer's status and note | ✅ |
| Answer shows confidence first, possible causes with likelihood, safe next steps, what would help, expert box | ✅ |
| Cautious rules: unusable photo → no causes; unsure → more information or expert; farmer's "serious" → expert | ✅ |
| Never names chemicals or doses; "AI suggestion, not a diagnosis" on every answer | ✅ |
| "Did this help?" feedback for field validation; 3 per photo, 20 per day | ✅ |
| Unit, integration (service against a local stand-in API, DB rules) and end-to-end tests | ✅ |

Not built: the natural-language assistant ("What should I do today?", USER_WORKFLOWS.md section 17).
The answers have not been checked by agronomists; field validation should review the stored
answers and the farmers' feedback before wider use.

## Slice 16 — AI farm assistant ✅ complete

| Task | Status |
|---|---|
| Migration: `ai_interactions` — metadata only (no question or answer text), 30 per day, feedback-only updates | ✅ |
| "Ask a question about your farm" (from My farms) and "Ask a question about this crop" (from a crop) | ✅ |
| Question in the farmer's own words, with example questions; whole farm or one crop | ✅ |
| Context from the farmer's records only: crops and dates, costs, harvest/sales, plots, last 30 days of work and observations; no name, village or phone; "no weather data" stated | ✅ |
| Structured answer: the answer, which records it used, what is missing (asked back), confidence, expert | ✅ |
| Cautious rules: unsure with nothing to ask → expert; no records used → never "fairly sure"; no chemicals, no eligibility claims | ✅ |
| Shared server-only AI set-up (`src/lib/ai.ts`) for both AI features; hidden without `ANTHROPIC_API_KEY` | ✅ |
| Unit, integration (context from real records, AI call against a local stand-in) and end-to-end tests | ✅ |

One question at a time (no conversation memory), and answers are not saved, by design (DATABASE.md
section 20). Weather is not available to the assistant.

## Slice 17 — Weather forecasts ✅ complete

| Task | Status |
|---|---|
| Provider adapter for Open-Meteo (server only; customer API when `OPEN_METEO_API_KEY` is set), response checked and normalised | ✅ |
| Plot page: "Weather for this plot" — 7 days (sky, rain in mm with IMD rain category and chance, min–max °C, wind), "now (estimate)" | ✅ |
| Heavy-rain (IMD "heavy" or worse) and very-hot-day (40 °C or more) warnings | ✅ |
| Clearly a forecast from weather models, with source, update time and "can be wrong"; streamed so the page does not wait | ✅ |
| Plot location rounded to about 5 km before it is sent to the provider; no location → "add the plot's location" | ✅ |
| Farm assistant gets the forecast for the plots in question (at most two locations), labelled as a forecast | ✅ |
| Unit, integration (against a local stand-in shaped like Open-Meteo) and end-to-end tests | ✅ |

No migration: forecasts are cached for an hour per rounded location (Next.js data cache), not stored
in the database, because they contain no farmer data and change hourly. Not built: recent observed
weather, IMD as a source, weather in crop planning.

**Not yet checked against the real Open-Meteo API**: this environment's network policy blocks
`api.open-meteo.com`, so the adapter was built from Open-Meteo's documented response format and
tested against a stand-in. Check one real response before release.

## Next slices (proposed, not started)

1. Verified crop reference data for planning (duration, water and labour needs, typical cost and
   price ranges for the pilot district, which seasons each crop suits), loaded with a source and
   check date like schemes — needs a source agreed with agronomists.
2. Recent observed weather (rain in the last 7 days) and IMD district forecasts/agro-advisories as
   a second, official source.

## Open questions for the product owner

- Which district is the pilot district? (Profile currently takes free-text state/district.)
- Should bigha/katha be supported, and with which conversion for that district?
- Which map tile provider (ideally satellite imagery) and SMS provider will be used in production?
- Once crop cycles exist, should a plot's earlier boundaries be kept (so past seasons keep the
  area they were grown on)? Today an edit replaces the boundary.
- Which crops (and, later, which verified varieties and durations) should the catalog hold for the
  pilot district? The starter list is a reasonable guess, not a validated list.
- Should a farmer be able to add a crop that is not in the catalog ("other")? Today they cannot.
- Should a farmer be able to undo a status change made by mistake (e.g. "harvest finished")?
  Today the dates can be corrected, but the status cannot go back.
- Costs can be entered with work done or as a separate cost, which risks counting the same money
  twice. Should costs live in one place only (e.g. work cost creates a cost entry)?
- Should vegetables be recorded in pieces or crates as well as kg/quintal? Today only weight units
  are supported, so sales can be checked against the harvest.
- Should a sale record how much money has been received so far (for "partly paid")?
- For crop planning, which source should give crop reference data (KVK, state agriculture
  department, the team's agronomist)? Until then only the farmer's own records are compared.
- Which crop insurance information applies in the pilot district (crops, seasons, enrolment
  dates, claim reporting), and who checks it each season?
- Which schemes should be loaded for the pilot district, and who in the team checks and re-checks
  them (at least every 6 months)?
- Buyer verification is done by the team directly in the database. Who verifies buyers, how
  (documents, visit), and is an admin screen needed?
- Should demand carry an offered price? The spec's buyer fields do not include one, so it is not
  built; buyers can only write payment terms.
- The quantity filter shows buyers who need **at most** what the farmer has (demand the farmer can
  fill alone). Should it also show bigger buyers who may take part of their need?
- Buyers cannot edit published demand (only close it and publish a new one), and farmers cannot
  withdraw an interest. Are these needed?
- All signed-in farmers can see every buyer's phone number. Should it be shown only for open
  demand, or only after a farmer says they are interested?
- Account deletion is immediate and permanent. Should there be a waiting period (for example,
  7 days to change one's mind), or an export of the farmer's records before deleting?
- Changing the mobile number (e.g. a new SIM) needs a verified OTP to the new number. Not built;
  today a farmer with a new number would start a new account.
- Weather: Open-Meteo is free only for non-commercial use. Which plan (or IMD access) will be used
  in production?
- Farm assistant: should farmers be able to see their earlier questions and answers (which would mean
  storing them, with consent and a retention period)? Should it hold a short conversation?
- AI crop-health help: who reviews the stored AI answers and feedback during field validation, and
  what accuracy is needed before it is offered widely? How long should AI answers be kept?
- Hindi wording should be reviewed by a native speaker from the pilot area.
