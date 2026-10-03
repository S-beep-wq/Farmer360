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

## Next slices (proposed, not started)

1. Verified crop reference data for planning (duration, water and labour needs, typical cost and
   price ranges for the pilot district, which seasons each crop suits), loaded with a source and
   check date like schemes — needs a source agreed with agronomists.
2. AI crop-health assistance on observations (PRODUCT_SPEC.md section 16) — needs a model choice,
   a confidence/uncertainty design and field validation.

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
- Hindi wording should be reviewed by a native speaker from the pilot area.
