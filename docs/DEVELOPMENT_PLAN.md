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

## Next slices (proposed, not started)

1. Government scheme / insurance information (sections 10–11) — needs verified source data.
2. Buyer discovery (section 14) — the marketplace `buyers` table.
3. AI crop-health assistance on observations (PRODUCT_SPEC.md section 16) — needs a model choice,
   a confidence/uncertainty design and field validation.
4. Account deletion that also removes the farmer's photos from storage.

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
- Hindi wording should be reviewed by a native speaker from the pilot area.
