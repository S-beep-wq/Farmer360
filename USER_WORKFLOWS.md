# Farmer 365 — User Workflows

| | |
|---|---|
| **Version** | 0.1 |
| **Status** | MVP Foundation |

---

## 1. Workflow Philosophy

Farmer 365 should be organized around the farmer's real agricultural workflow rather than around isolated software features.

The fundamental lifecycle is:

```text
Farmer
→ Farm
→ Plot
→ Crop Plan
→ Crop Cycle
→ Activities
→ Crop Monitoring
→ Harvest
→ Sale
→ Economics
→ Next Crop
```

The system should preserve this history.

## 2. Farmer Onboarding

### Goal

Create a farmer account and establish basic identity and location information.

### Flow

```text
Open application
      ↓
Register
      ↓
Phone verification
      ↓
Create farmer profile
      ↓
Select preferred language
      ↓
Enter village / district
      ↓
Complete onboarding
```

### Required information

- Name
- Phone number
- Preferred language
- State
- District
- Village

### Acceptance criteria

- Farmer can create an account.
- Phone verification works.
- Farmer profile is persisted.
- Farmer can log back in.
- Farmer cannot access another farmer's data.

## 3. Farm Creation

### Goal

Allow a farmer to register a physical farm.

### Flow

```text
Farmer Dashboard
      ↓
Add Farm
      ↓
Enter farm information
      ↓
Save
      ↓
Farm Dashboard
```

### Farm information

- Farm name
- Location
- Total area
- Irrigation availability
- Irrigation type
- Soil information
- Optional notes

A farmer may have multiple farms.

## 4. Plot Creation

### Goal

Represent individual agricultural plots.

### Flow

```text
Farm
 ↓
Add Plot
 ↓
Enter area
 ↓
Enter location
 ↓
Enter soil information
 ↓
Enter irrigation information
 ↓
Save
```

A farm may contain multiple plots.

Example:

```text
Farm A
 ├── Plot 1 — 1.2 acre
 ├── Plot 2 — 0.8 acre
 └── Plot 3 — 2.0 acre
```

The plot is the fundamental unit for crop management.

## 5. Crop Planning Workflow

### Goal

Help the farmer compare possible crops for a specific plot and season.

### Inputs

- Plot
- Area
- Season
- Soil
- Water availability
- Previous crop
- Labour availability
- Budget
- Farmer preferences
- Available market information

### Flow

```text
Select Plot
      ↓
Select Season
      ↓
System collects available farm information
      ↓
Crop planning engine
      ↓
Generate candidate crops
      ↓
Display comparison
      ↓
Farmer selects crop
      ↓
Create Crop Cycle
```

### Crop comparison

Each candidate should potentially display:

- Crop
- Duration
- Water requirement
- Labour requirement
- Input requirement
- Estimated cost range
- Potential revenue range
- Potential margin range
- Production risks
- Market considerations
- Relevant government support

The system must clearly distinguish estimates from verified facts.

## 6. Crop Cycle Creation

### Goal

Create a trackable production cycle for a plot.

### Flow

```text
Select crop
 ↓
Select variety where applicable
 ↓
Enter planned sowing date
 ↓
Confirm plot
 ↓
Create crop cycle
```

### Crop cycle contains

- Plot
- Crop
- Variety
- Season
- Planned sowing date
- Actual sowing date
- Expected harvest date
- Current crop stage
- Status

Possible status:

```text
PLANNED
ACTIVE
HARVESTED
COMPLETED
CANCELLED
```

## 7. Crop Activity Workflow

### Goal

Record farm operations.

### Flow

```text
Crop Cycle
 ↓
Add Activity
 ↓
Select activity type
 ↓
Enter date
 ↓
Enter quantity/cost
 ↓
Add notes
 ↓
Save
```

Activity types may include:

- Land preparation
- Sowing
- Irrigation
- Fertilization
- Weeding
- Crop protection
- Labour
- Machinery
- Harvest preparation
- Other

## 8. Crop Observation Workflow

### Goal

Allow the farmer to document crop condition.

### Flow

```text
Crop Cycle
 ↓
Add Observation
 ↓
Take/upload photo
 ↓
Enter optional note
 ↓
Save observation
 ↓
AI analysis (if enabled)
 ↓
Store result
 ↓
Add to timeline
```

The original photograph must be retained.

AI analysis must not overwrite the original farmer observation.

## 9. Crop Health Timeline

The farmer should be able to see crop development chronologically.

Example:

```text
Day 20
Photo
Healthy growth

      ↓

Day 27
Photo
Possible mild stress

      ↓

Day 34
Photo
Change detected

      ↓

Day 41
Photo
Further assessment
```

The system should compare observations when sufficient historical data exists.

## 10. Government Scheme Workflow

### Goal

Help the farmer discover potentially relevant schemes.

### Flow

```text
Farmer Profile
      ↓
Farm + Plot Information
      ↓
Crop + Location + Season
      ↓
Scheme Matching
      ↓
Potentially Relevant Schemes
      ↓
Farmer selects scheme
      ↓
Eligibility information
      ↓
Required documents
      ↓
Official application route
```

The system should display:

- Scheme name
- Eligibility
- Benefit
- Required documents
- Deadline
- Official source
- Last verification date

The system should not claim eligibility unless the official rules clearly establish it.

## 11. Insurance Workflow

```text
Farmer
 ↓
Select Crop Cycle
 ↓
Check applicable insurance information
 ↓
Show eligibility / coverage information
 ↓
Show premium / important dates where available
 ↓
Show claim reporting process
 ↓
Official source
```

The system must not guarantee a claim outcome.

## 12. Expense Workflow

```text
Crop Cycle
 ↓
Add Expense
 ↓
Select category
 ↓
Enter amount
 ↓
Enter date
 ↓
Optional quantity/vendor
 ↓
Save
```

Categories:

- Seed
- Fertilizer
- Crop protection
- Labour
- Machinery
- Irrigation
- Transport
- Other

## 13. Harvest Workflow

```text
Crop Cycle
 ↓
Harvest
 ↓
Enter harvest date
 ↓
Enter quantity
 ↓
Enter quality information where applicable
 ↓
Save
```

The system should preserve the relationship:

**Plot → Crop Cycle → Harvest.**

## 14. Buyer Workflow

### Farmer side

```text
Harvest / Expected Harvest
 ↓
Search buyers
 ↓
Filter by crop
 ↓
Filter by quantity
 ↓
Filter by location
 ↓
View buyer information
 ↓
Contact / express interest
```

### Buyer side

```text
Buyer
 ↓
Create demand
 ↓
Select crop
 ↓
Quantity
 ↓
Quality requirements
 ↓
Required date
 ↓
Location
 ↓
Payment terms
 ↓
Publish
```

The system must distinguish:

- Confirmed order
- Buyer interest
- Indicative demand
- General market information

## 15. Sale Workflow

```text
Harvest
 ↓
Select Buyer
 ↓
Enter quantity
 ↓
Enter price
 ↓
Enter date
 ↓
Enter transaction costs
 ↓
Save sale
```

The system calculates:

```text
Gross Revenue
      -
Production Costs
      -
Selling / Transport Costs
      =
Net Result
```

## 16. Season Review Workflow

After harvest:

```text
Crop Cycle
 ↓
Season Review
 ↓
Total Cost
 ↓
Harvest
 ↓
Revenue
 ↓
Net Result
 ↓
Activities
 ↓
Crop Health History
 ↓
Farmer Notes
 ↓
Save Season
```

This historical record should be available when planning the next crop.

## 17. AI Assistant Workflow

The farmer can ask natural-language questions.

Example:

```text
Farmer:
"आज मुझे क्या करना चाहिए?"

        ↓

AI interprets request

        ↓

Retrieves:
- Farm
- Plot
- Crop
- Crop stage
- Recent activities
- Recent observations
- Relevant available information

        ↓

Generates contextual response

        ↓

Farmer receives answer
```

AI should not invent missing farm information.

If required information is missing, the system should ask for it.

## 18. Error and Uncertainty Workflow

When information is uncertain:

```text
Input
 ↓
System evaluates confidence
 ↓
High confidence → response
 ↓
Low confidence → explain uncertainty
                         ↓
                    Ask for more data
                         OR
                    Recommend expert review
```

The system should never hide uncertainty simply to produce an answer.

## 19. Core Navigation

Initial application navigation:

```text
Dashboard
Farm
Crops
Tasks
Health
Schemes
Market
Economics
Profile
```

The exact mobile navigation can be changed after user testing.

## 20. End-to-End MVP Workflow

The complete MVP journey is:

```text
REGISTER
   ↓
CREATE FARM
   ↓
CREATE PLOT
   ↓
ENTER FARM DATA
   ↓
SELECT SEASON
   ↓
COMPARE CROPS
   ↓
SELECT CROP
   ↓
CREATE CROP CYCLE
   ↓
RECORD ACTIVITIES
   ↓
UPLOAD PHOTOS
   ↓
MONITOR CROP
   ↓
RECORD EXPENSES
   ↓
HARVEST
   ↓
FIND/RECORD BUYER
   ↓
RECORD SALE
   ↓
CALCULATE ECONOMICS
   ↓
SEASON REVIEW
   ↓
NEXT CROP
```

This is the primary workflow that should guide MVP development.
