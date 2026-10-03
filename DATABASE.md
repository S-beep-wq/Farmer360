# Farmer 365 — Database Specification

| | |
|---|---|
| **Version** | 0.8 |
| **Database** | PostgreSQL / Supabase (+ PostGIS) |
| **Status** | MVP Foundation |

---

## 1. Database Principles

The database is the long-term memory of Farmer 365.

It must preserve historical farm information rather than continuously overwriting it.

The fundamental relationship is:

```text
Farmer
  ↓
Farm
  ↓
Plot
  ↓
Crop Cycle
  ↓
Activities / Observations / Expenses / Harvest
  ↓
Sale
```

## 2. Entity Relationship

```text
users
  │
  ↓
farmers
  │
  ├───────────────┐
  ↓               ↓
farms         other farmer data
  │
  ↓
plots
  │
  ↓
crop_cycles
  │
  ├── crop_activities
  ├── crop_observations
  │       └── crop_photos
  ├── expenses
  └── harvests
          │
          ↓
        sales
          │
          ↓
        buyers
```

Supporting entities:

```text
government_schemes
insurance_products
crop_catalog
crop_varieties
```

## 3. `farmers`

Stores farmer-level information.

Fields:

```text
id
user_id
full_name
phone
preferred_language
state
district
village
created_at
updated_at
```

Rules:

- `id` is the primary key.
- `user_id` links to the authenticated user.
- Phone number must be appropriately protected.
- A farmer must only access their own profile.
- `user_id` defaults to `auth.uid()`, and a trigger copies `phone` from the verified login
  (`auth.users.phone`). Neither can be set or changed by the client.

## 4. `farms`

A farmer may have multiple farms.

Fields:

```text
id
farmer_id
name
state
district
village
latitude
longitude
total_area
area_unit
irrigation_available
irrigation_type
soil_type
soil_source
notes
created_at
updated_at
```

Relationship:

```text
farmer 1 → many farms
```

`notes` was added in v0.2 because USER_WORKFLOWS.md section 3 lists "optional notes" for a farm.

## 5. `plots`

A farm may contain multiple plots.

Fields:

```text
id
farm_id
name
area
area_unit
latitude
longitude
location_source
location_accuracy_m
boundary
boundary_area_sq_m
soil_type
soil_ph
soil_source
irrigation_available
irrigation_type
notes
created_at
updated_at
```

Relationship:

```text
farm 1 → many plots
```

The plot is the primary unit for crop-cycle management.

### Plot location and boundary (added in v0.2)

The first vertical slice needs plot location from the phone, a map pin, or a drawn boundary.
The four location columns were added for that:

| Column | Type | Meaning |
|---|---|---|
| `latitude`, `longitude` | `numeric(9,6)`, WGS 84 | One representative point for the plot. |
| `location_source` | text | How the point was set: `device_gps` (phone location), `map_pin` (tapped on the map) or `boundary_centroid` (centre of the drawn boundary). Required when a point is stored. |
| `location_accuracy_m` | numeric | Accuracy reported by the phone, in metres. Only for `device_gps`. |
| `boundary` | `geography(Polygon, 4326)` (PostGIS) | The field boundary, drawn by tapping its corners on the map. |
| `boundary_area_sq_m` | numeric | Area of `boundary` in square metres. **Calculated by a database trigger** (`ST_Area` on the spheroid); any value sent by a client is overwritten. |

Rules enforced in the database:

- `latitude`/`longitude` are both set or both empty, and a point always has a `location_source`.
- `area` and `area_unit` are both set or both empty.
- A plot must have an `area` (stated by the farmer) or a `boundary`, or both.
- The boundary must be a valid polygon (no self-crossing), have at most 500 corners, and be
  larger than 0 and at most 1,000 ha (a larger "plot" is treated as a drawing mistake).
- If a boundary is given without a point, the point is set to the boundary's centre with
  `location_source = 'boundary_centroid'`.

`area` (what the farmer says) and `boundary_area_sq_m` (what the map measures) are kept
separately and both shown, because they can legitimately differ. Neither overwrites the other.

When a plot is edited, the app sends the full location again. If there is no pin, it sends
`latitude`/`longitude` as null, so the database recalculates the centre from the (possibly
redrawn) boundary. An edit replaces the current boundary; earlier boundaries are not kept yet.
If past seasons need the boundary they were grown on, add a boundary history table before
crop cycles start relying on plot area.

The API writes `boundary` as EWKT (`SRID=4326;POLYGON((lng lat, ...))`) and reads it as GeoJSON
through the computed field `boundary_geojson` (`select=boundary_geojson`).

### Allowed values (v0.2)

Stored as `text` with `CHECK` constraints, so a value can be added with a small migration:

- `area_unit` (farms, plots): `acre`, `decimal` (1/100 acre, "dismil"), `hectare`.
  Bigha and katha are **not** supported yet because their size differs between regions of Bihar;
  adding them needs a confirmed conversion for the pilot district.
- `irrigation_type`: `tubewell`, `canal`, `well`, `pond_or_river`, `other`.
  "Rainfed" is `irrigation_available = false`.
- `soil_type`: `loam`, `clay`, `sandy`, `sandy_loam`, `clay_loam`, `other`, `unknown`.
- `soil_source`: `farmer_estimate`, `soil_health_card`, `lab_test`.

### Future: government land records / GIS

There is no government land-record integration, and the app does not assume one. When an
authorised integration exists, it should be added without changing the columns above:

- a new `location_source` value (for example `land_record`) for points or boundaries taken from
  an official record;
- a separate table (for example `plot_land_records`) holding the record reference, the provider,
  the retrieval and verification dates and the official geometry, linked to `plots.id`, so that
  official data stays separate from farmer-drawn data (SYSTEM_ARCHITECTURE.md section 12);
- a server-side adapter per provider. Official geometry must never silently replace the
  farmer's own boundary; both are kept and shown.

## 6. `crop_catalog`

Contains standardized crop information.

Fields may include:

```text
id
name
scientific_name
category
season
typical_duration_days
water_requirement
labour_requirement
description
created_at
updated_at
```

Examples:

```text
Rice
Wheat
Maize
Potato
Tomato
Onion
Vegetables
Pulses
Oilseeds
```

Crop data should not be hard-coded throughout the application.

### Implemented (v0.3)

- Added `name_hi` (required): the Hindi name shown in the Hindi-first interface. Crop names come
  from this table, not from the app's message files.
- `category` is one of `cereal`, `pulse`, `oilseed`, `vegetable`, `cash`, `other`.
- Starter list (in the migration): Rice (paddy), Wheat, Maize, Lentil, Chickpea, Pigeon pea,
  Green gram, Mustard, Potato, Onion, Tomato, Cauliflower, Brinjal, Okra, Sugarcane, Jute —
  **names only**. The agronomic columns (`season`, `typical_duration_days`, water and labour
  requirements) stay empty until filled from a verified source; the app does not estimate
  durations or harvest dates.
- Read-only for signed-in users; no access for signed-out visitors. Changes are made by migration.

## 7. `crop_varieties`

Stores variety-specific information.

Fields:

```text
id
crop_id
name
description
duration_days
suitable_seasons
notes
created_at
updated_at
```

Only verified/appropriate sources should be used when adding agronomic information.

**Not created yet (v0.3).** There is no verified variety data for the pilot district, so an empty
table would only invite invented data. Instead, `crop_cycles.variety_name` stores the variety
as the farmer names it (for example, from the seed packet). When verified variety data exists,
create this table and add a nullable `crop_cycles.variety_id`, keeping `variety_name` for
varieties not in the list.

## 8. `crop_cycles`

Represents one crop-production cycle on one plot.

Fields:

```text
id
plot_id
crop_id
variety_id
season
status
planned_sowing_date
actual_sowing_date
expected_harvest_date
actual_harvest_date
current_growth_stage
notes
created_at
updated_at
```

Possible statuses:

```text
PLANNED
ACTIVE
HARVESTED
COMPLETED
CANCELLED
```

Relationship:

```text
plot 1 → many crop_cycles
```

Historical crop cycles must not be deleted simply because a new crop is planted.

### Implemented (v0.3)

Differences from the field list above:

- `variety_name` (text, optional) instead of `variety_id` — see section 7.
- `season`: `kharif`, `rabi` or `zaid`, chosen by the farmer.

Rules enforced in the database:

- At least one of `planned_sowing_date` / `actual_sowing_date` is set.
- `PLANNED` has no `actual_sowing_date`; `ACTIVE`, `HARVESTED` and `COMPLETED` must have one;
  `CANCELLED` may have either.
- `expected_harvest_date` is on or after the (actual, else planned) sowing date;
  `actual_harvest_date` is on or after `actual_sowing_date`.
- `crop_id` must exist in `crop_catalog`.

How the app creates a cycle: the farmer answers "Has it been sown already?". "No" stores a
`planned_sowing_date` with status `PLANNED`; "Yes" stores an `actual_sowing_date` (not in the
future, by the farmer's date in India) with status `ACTIVE`. This lets farmers who join mid-season
record crops already in the field. `expected_harvest_date` is optional and entered by the farmer.

Access: `public.owns_plot(plot_id)` checks that the plot is on one of the signed-in farmer's
farms; select, insert and update policies use it, so a cycle cannot be read, added or moved onto
another farmer's plot. There is no delete: a crop that is not grown should be `CANCELLED`.

### Status changes (v0.4)

Enforced by the trigger `crop_cycles_check_status_change` and the constraint
`crop_cycles_harvest_matches_status`:

```text
PLANNED   → ACTIVE      sowing recorded (actual_sowing_date set)
PLANNED   → CANCELLED
ACTIVE    → HARVESTED   harvest finished (actual_harvest_date set)
ACTIVE    → CANCELLED   e.g. the crop was lost
HARVESTED → COMPLETED   season review (v0.7)
```

- A new cycle must be `PLANNED` or `ACTIVE`.
- `CANCELLED` and `COMPLETED` cycles can no longer be changed at all.
- `actual_harvest_date` is set exactly when the status is `HARVESTED` or `COMPLETED`.
- `plot_id` cannot change: a cycle's history belongs to the plot it was grown on.
- The app updates a cycle only if it still has the status the farmer saw
  (`... where status = <seen status>`), so two changes made at the same time cannot both apply.

### Season review (v0.7)

The season review (USER_WORKFLOWS.md section 16) closes a `HARVESTED` crop as `COMPLETED`:

- The farmer's notes for next season are saved in `crop_cycles.notes`.
- `completed_at` (added in v0.7) is set by the status trigger to the database's own clock when
  the crop becomes `COMPLETED`, and is empty otherwise (`crop_cycles_completed_at_matches_status`).
  The app cannot set it.
- A `COMPLETED` crop and all its activities, expenses, harvests and sales are frozen, **except
  a sale's `payment_status`**: buyers often pay after the season is closed, so `sales_check`
  allows an update that changes nothing but the payment status.
- Because the records are frozen, the season's totals are calculated, not copied: see the
  `crop_cycle_totals` view below. Crop health history is not part of the review yet, because
  crop observations (section 10) are not built.

### `crop_cycle_totals` view (v0.7)

One row per crop cycle: `work_costs`, `expense_total`, `harvested_kg`, `sold_kg`, `revenue`,
`selling_costs` and `unpaid_sales`, excluding removed entries. It is a `security_invoker` view, so
RLS on the underlying tables applies and a farmer only gets totals for their own crops; signed-out
visitors have no access. The net result is `revenue − work_costs − expense_total − selling_costs`,
the same formula the crop page uses (an integration test checks they agree). The plot page uses
it to show the result of each completed season, for planning the next crop.

`actual_harvest_date` is the day the harvest **finished** (for crops picked many times, the last
picking). Harvest quantities and quality belong to the `harvests` table (section 13), which is
not built yet.

## 9. `crop_activities`

Stores farm operations.

Fields:

```text
id
crop_cycle_id
activity_type
activity_date
quantity
quantity_unit
cost
notes
created_at
updated_at
```

Examples:

```text
LAND_PREPARATION
SOWING
IRRIGATION
FERTILIZATION
WEEDING
CROP_PROTECTION
LABOUR
MACHINERY
OTHER
```

### Implemented (v0.5)

- Added `HARVEST_PREPARATION` (listed in USER_WORKFLOWS.md section 7) to the activity types.
- `quantity_unit`: `kg`, `quintal`, `litre`, `bag`, `packet`, `hour` (machine or pump hours),
  `day` (worker-days). A quantity and its unit are set together.
- `cost` is optional, in rupees, greater than 0: what the farmer paid for this work.
- `deleted_at` added for soft deletion (section 24).
- The app records work done on or before today (in India); it does not plan future work.

## 10. `crop_observations`

Stores farmer or system observations.

Fields:

```text
id
crop_cycle_id
observation_date
growth_stage
health_status
farmer_notes
ai_analysis
ai_confidence
created_by
created_at
updated_at
```

**Important:** AI output must not overwrite farmer-provided observations.

### Implemented (v0.8)

- `health_status` (required): the farmer's own judgement — `HEALTHY`, `PROBLEM`, `SERIOUS`,
  `NOT_SURE`. `growth_stage` exists but is not asked for yet.
- `created_by` is `FARMER` (default) or `SYSTEM`; `deleted_at` added for soft deletion.
- **Column grants:** farmers can insert only `crop_cycle_id`, `observation_date`, `growth_stage`,
  `health_status` and `farmer_notes`, and can update only `deleted_at`. They cannot write
  `ai_analysis`, `ai_confidence` or `created_by` at all, and cannot change a saved observation.
  So AI output (added later, server-side) can never overwrite or pose as the farmer's own
  observation.
- New observations only for an `ACTIVE` crop, dated on or after its sowing date; nothing changes
  once the crop is `COMPLETED`. Access uses `public.owns_crop_cycle()`.
- An observation needs a photo or a note (checked by the app).

## 11. `crop_photos`

Stores metadata for crop images.

Fields:

```text
id
observation_id
storage_path
file_name
mime_type
file_size
captured_at
uploaded_at
created_at
```

The actual image should be stored in Supabase Storage.

The database stores metadata and the storage reference.

### Implemented (v0.8)

- Private Supabase Storage bucket `crop-photos` (created by the migration): JPEG, PNG or WebP,
  at most 5 MB. Path: `{farmer_id}/{farm_id}/{plot_id}/{crop_cycle_id}/{observation_id}/{file}`
  (SYSTEM_ARCHITECTURE.md section 9).
- `public.crop_photo_path_owned(path)` checks that every folder in the path belongs to the
  signed-in farmer, in order. The storage policies (upload and read) and the `crop_photos` insert
  policy use it. There are no update or delete policies: photos cannot be replaced or deleted.
- `crop_photos_path_matches_observation`: a photo row must point into its own observation's folder.
- Photos are shown through signed links valid for one hour; the bucket is never public.
- In the browser, photos are made smaller (at most 1600 px, JPEG) before upload, which also drops
  their EXIF metadata such as GPS. The server checks the file's first bytes to confirm it is a
  real JPEG, PNG or WebP image. `captured_at` is not filled yet.
- Deleting an account removes the database rows (cascade) but not the files in storage; cleaning
  up storage on account deletion is still to be done.

## 12. `expenses`

Stores crop-cycle expenses.

Fields:

```text
id
crop_cycle_id
category
amount
currency
expense_date
quantity
quantity_unit
vendor
notes
created_at
updated_at
```

Categories:

```text
SEED
FERTILIZER
CROP_PROTECTION
LABOUR
MACHINERY
IRRIGATION
TRANSPORT
OTHER
```

### Implemented (v0.5)

- `amount` is required, in rupees, greater than 0; `currency` is always `INR` for the MVP.
- Same quantity units as `crop_activities`; `vendor` is the shop or person paid (optional).
- `deleted_at` added for soft deletion (section 24).

### How costs are counted

A crop's "spent so far" is the sum of `crop_activities.cost` and `expenses.amount`, excluding
removed entries. Labour, machinery and irrigation can be entered either with the work done or as
a cost, so the add-cost form tells the farmer not to enter the same money twice. Whether to keep
two places for costs is an open product question (see docs/DEVELOPMENT_PLAN.md).

## 13. `harvests`

Stores harvested production.

Fields:

```text
id
crop_cycle_id
harvest_date
quantity
quantity_unit
quality_grade
notes
created_at
updated_at
```

Relationship:

```text
crop_cycle 1 → many harvests
```

This allows multiple harvest events where appropriate.

### Implemented (v0.6)

- `quantity` (> 0) and `quantity_unit` (`kg`, `quintal`, `tonne`) are required. These three units
  convert exactly (`public.produce_unit_kg()`), so sales can be checked against the harvest.
  Count-based units (pieces, crates) are not supported yet.
- `quality_grade`: optional, `GOOD`, `AVERAGE` or `POOR` (farmer's own judgement).
- `deleted_at` for soft deletion (section 24).
- Trigger rules: a new harvest needs a crop that is `ACTIVE` or `HARVESTED`; the harvest date is
  on or after the actual sowing date; the quantity cannot drop below what was sold from it; a
  harvest with sales cannot be removed; nothing changes once the crop is `COMPLETED`.

## 14. `buyers`

Stores buyer information.

Fields:

```text
id
name
organization_name
phone
location
buyer_type
verification_status
created_at
updated_at
```

Buyer information requires appropriate access controls.

**Not created yet (v0.6).** This table describes buyers for buyer discovery (a marketplace
feature with verification). Recording the farmer's own sale does not need it, and creating
marketplace buyer records from farmers' private sales would mix two different things. Sales
store the buyer as the farmer describes it (`sales.buyer_type` and `sales.buyer_name`); a
nullable `sales.buyer_id` can be added when buyer discovery is built.

## 15. `buyer_demands`

Represents buyer requirements.

Fields:

```text
id
buyer_id
crop_id
quantity
quantity_unit
quality_requirements
required_date
location
payment_terms
demand_status
created_at
updated_at
```

Possible status:

```text
DRAFT
ACTIVE
FULFILLED
EXPIRED
CANCELLED
```

## 16. `sales`

Records actual sales.

Fields:

```text
id
harvest_id
buyer_id
sale_date
quantity
quantity_unit
price_per_unit
gross_amount
transport_cost
other_cost
net_amount
payment_status
notes
created_at
updated_at
```

Possible payment status:

```text
PENDING
PARTIAL
PAID
```

### Implemented (v0.6)

Differences from the field list above:

- `buyer_type` (required: `LOCAL_TRADER`, `MANDI`, `GOVERNMENT_PROCUREMENT`, `FPO`, `COMPANY`,
  `CONSUMER`, `OTHER`) and `buyer_name` (optional) instead of `buyer_id` — see section 14.
- `quantity_unit`: `kg`, `quintal` or `tonne`; `price_per_unit` is rupees per one of that unit.
- `transport_cost` and `other_cost` default to 0.
- `gross_amount` (`quantity × price_per_unit`) and `net_amount` (`gross − transport − other`) are
  **generated columns**: the database calculates them and the app cannot write them.
- `deleted_at` for soft deletion (section 24).

Trigger rules: a sale stays on its harvest; it is on or after the harvest date; the total sold
from a harvest (in kg, removed sales excluded) cannot exceed the harvest, with the harvest row
locked so two sales saved at once cannot oversell it; the harvest must not be removed; nothing
changes once the crop is `COMPLETED`. Access uses `public.owns_harvest(harvest_id)`.

### Crop result

The crop page shows, from recorded data only:

```text
  money from sales (sum of gross_amount)
− spent on the crop (activity costs + expenses, section 12)
− selling costs (sum of transport_cost + other_cost)
= net result (profit or loss)
```

It also says when some sales are not fully paid (`payment_status` other than `PAID`): the money
is recorded, not necessarily received. It is not a forecast.

## 17. `government_schemes`

Stores structured government-scheme information.

Fields:

```text
id
name
state
district
description
eligibility
benefit
applicable_crops
required_documents
application_process
official_url
source_name
source_url
last_verified_at
status
created_at
updated_at
```

The source and verification date are mandatory for trusted scheme information.

## 18. `insurance_products`

Stores structured insurance information.

Fields:

```text
id
name
state
district
season
crop_id
eligibility
coverage_information
premium_information
claim_process
official_url
source_name
source_url
last_verified_at
created_at
updated_at
```

Insurance information must be traceable to authoritative sources.

## 19. `scheme_applications`

If application assistance is added later:

```text
id
farmer_id
scheme_id
status
application_date
reference_number
notes
created_at
updated_at
```

Do not store sensitive government credentials.

## 20. `ai_interactions`

Stores selected AI interaction metadata for product improvement.

Fields:

```text
id
farmer_id
interaction_type
input_summary
model
response_summary
confidence
created_at
```

Do not unnecessarily store sensitive raw conversations.

Retention policies should be defined before production use.

## 21. Relationships

Core relationship:

```text
Farmer
  │
  └── Farm
        │
        └── Plot
              │
              └── Crop Cycle
                    ├── Activities
                    ├── Observations
                    │      └── Photos
                    ├── Expenses
                    └── Harvest
                           │
                           └── Sales
                                  │
                                  └── Buyer
```

Supporting:

```text
Crop Cycle → Crop
Crop Cycle → Variety
Buyer → Buyer Demand
Farmer → Scheme Application
Crop → Insurance Product
```

## 22. IDs

Use UUIDs for primary keys unless there is a strong reason otherwise.

Do not expose sequential IDs for sensitive resources.

## 23. Timestamps

Most business tables should contain:

```text
created_at
updated_at
```

Historical events such as:

- sowing
- observations
- expenses
- harvest
- sales

must also contain their actual event date.

## 24. Soft Deletion

Important historical agricultural records should generally not be physically deleted.

Where deletion is required, consider:

```text
deleted_at
```

or an equivalent archival mechanism.

The system must preserve agricultural history.

Implemented for `crop_activities` and `expenses` (v0.5): "Remove this entry" sets `deleted_at`.
Removed entries are hidden and not counted, but stay in the database. `DELETE` is not allowed for
any farmer data table.

Access for both tables uses `public.owns_crop_cycle(crop_cycle_id)` in select, insert and update
policies. A trigger keeps each entry on its crop cycle and blocks changes once the cycle is
`COMPLETED`; entries can still be added to a `CANCELLED` crop, because money spent on a lost crop
is real.

## 25. Indexing

Indexes should initially cover common access patterns such as:

```text
farmers.user_id
farms.farmer_id
plots.farm_id
crop_cycles.plot_id
crop_cycles.status
crop_activities.crop_cycle_id
crop_observations.crop_cycle_id
expenses.crop_cycle_id
harvests.crop_cycle_id
sales.harvest_id
```

Add additional indexes based on observed query patterns.

## 26. Row-Level Security

Supabase Row Level Security must protect farmer-owned data.

Conceptually:

```text
Authenticated User
       ↓
Farmer
       ↓
Owned Farm
       ↓
Owned Plot
       ↓
Owned Crop Cycle
       ↓
Owned Records
```

A farmer must never be able to access another farmer's private farm data through manipulated requests.

Implemented in v0.2 for `farmers`, `farms` and `plots`:

- RLS is enabled on every table, and the `anon` role has no access at all.
- `public.current_farmer_id()` returns the signed-in user's farmer id. `farms.farmer_id`
  defaults to it, and farm policies compare against it.
- Plot policies check that the plot's farm belongs to the signed-in farmer, for reads, inserts
  and updates (so a plot cannot be moved onto someone else's farm).
- There are **no DELETE policies** and `DELETE` is revoked: history is preserved (section 24).
  Deleting an auth user (account removal) cascades to their farmer data.
- The application only ever uses the publishable key with the farmer's session. The secret key is
  used only by local tests for cleanup.

These rules are covered by `tests/integration/farm-data.test.ts`.

## 27. Data Integrity

Use database constraints for critical relationships.

Examples:

- Foreign keys
- NOT NULL where appropriate
- Valid status values
- Positive area
- Positive expense amounts
- Valid dates
- Valid relationships

Application validation should complement database constraints.

## 28. Data Evolution

Migrations live in `supabase/migrations/`. Applied so far:

| Migration | Contents |
|---|---|
| `20261003044516_slice1_farmers_farms_plots.sql` | PostGIS; `farmers`, `farms`, `plots` with location/boundary; triggers; RLS. |
| `20261003052122_slice3_crop_catalog_and_cycles.sql` | `crop_catalog` (+ starter list), `crop_cycles`, `owns_plot()`; RLS. |
| `20261003053318_slice4_crop_status_changes.sql` | Crop status transition trigger; harvest-date/status constraint. |
| `20261003054621_slice5_crop_activities_and_expenses.sql` | `crop_activities`, `expenses` (soft delete), `owns_crop_cycle()`; RLS. |
| `20261003062409_slice6_harvests_and_sales.sql` | `harvests`, `sales` (generated amounts, oversell check), `owns_harvest()`; RLS. |
| `20261003064819_slice7_season_review.sql` | `crop_cycles.completed_at`; payment updates after closing; `crop_cycle_totals` view. |
| `20261003073427_slice8_crop_observations.sql` | `crop_observations` (column grants), `crop_photos`, `crop-photos` bucket and storage policies. |


Database migrations must be version-controlled.

Never manually modify production schema without a migration.

Claude Code must:

1. Inspect current schema.
2. Create migration.
3. Apply migration in development.
4. Run tests.
5. Update `DATABASE.md`.
6. Only then consider the schema change complete.

## 29. MVP Database Principle

Do not create hundreds of tables before validation.

The initial implementation should prioritize:

```text
farmers
farms
plots
crop_catalog
crop_cycles
crop_activities
crop_observations
crop_photos
expenses
harvests
buyers
sales
government_schemes
```

Additional entities should be introduced when the corresponding workflow is actually implemented.

## 30. Long-Term Data Model

The long-term objective is to connect:

```text
Soil
 ↓
Crop
 ↓
Weather
 ↓
Activities
 ↓
Inputs
 ↓
Crop Health
 ↓
Yield
 ↓
Price
 ↓
Revenue
 ↓
Profit
```

This longitudinal relationship is one of the core strategic assets of Farmer 365.

The database must therefore preserve historical records and avoid destructive overwrites.
