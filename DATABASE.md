# Farmer 365 — Database Specification

| | |
|---|---|
| **Version** | 0.1 |
| **Database** | PostgreSQL / Supabase |
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
created_at
updated_at
```

Relationship:

```text
farmer 1 → many farms
```

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
