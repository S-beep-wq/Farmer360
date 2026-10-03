# Farmer 365 — Product Specification

| | |
|---|---|
| **Version** | 0.1 |
| **Status** | MVP Foundation |
| **Initial Geography** | Bihar, India |
| **Primary Users** | Small and medium-scale farmers |
| **Product Type** | Farm Management + Agricultural Decision Support Platform |

---

## 1. Product Vision

Farmer 365 is a digital operating system for farmers.

The product helps farmers manage their farms throughout the agricultural year — from deciding what to grow, preparing the field, monitoring crop health, managing labour and inputs, finding relevant government support, managing harvest, connecting with buyers, recording economics, and planning the next crop cycle.

The product should combine:

- Farm and plot data
- Soil information
- Weather information
- Crop calendars
- Crop history
- Crop-health observations
- Market and buyer information
- Government schemes
- Insurance information
- Farm expenses
- Harvest and sales data

AI should act as an intelligence and interaction layer on top of this agricultural operating system.

Farmer 365 is **not** intended to be merely an AI chatbot.

## 2. Problem

Farm decisions are often made using fragmented information.

A farmer may need to separately consider:

- What crop should be planted?
- Is the crop suitable for the soil?
- How much water will it require?
- When should it be planted?
- What activities need to happen next?
- What is causing a visible crop problem?
- What inputs or labour are required?
- Which government schemes may apply?
- What insurance coverage exists?
- What will the crop cost?
- Where can the harvest be sold?
- What price was actually received?
- Was the crop profitable?

Farmer 365 aims to connect these activities into one continuous workflow.

## 3. Product Principle

**The farmer owns the decision.**

Farmer 365 should provide information, calculations, comparisons, warnings, and workflow assistance.

It should not make unsupported guarantees.

The system must not claim:

- Guaranteed crop yield
- Guaranteed profit
- Guaranteed crop price
- Guaranteed buyer
- Guaranteed loan approval
- Guaranteed insurance claim
- Guaranteed disease diagnosis

Where uncertainty exists, the product should communicate it clearly.

## 4. Target User

### Primary user

Small and medium farmers in Bihar during the initial MVP.

The product should initially support farmers who may have:

- Small or medium land holdings
- Different soil conditions
- Irrigated or partially irrigated land
- Limited access to agricultural experts
- Limited digital literacy
- Hindi or regional-language preference
- Smartphone access

The product must therefore prioritize simplicity.

## 5. Initial Geography

The MVP should begin in one selected district of Bihar.

Do not attempt to launch across India initially.

The architecture should eventually support:

**Bihar → Uttar Pradesh → Other Indian states.**

However, geographic expansion must happen only after validating the workflow with real farmers.

## 6. Core Product Loop

The central product loop is:

```
Farmer
→ Farm
→ Plot
→ Crop Plan
→ Crop Cycle
→ Farm Activities
→ Crop Monitoring
→ Harvest
→ Buyer / Sale
→ Economics
→ Next Crop Plan
```

The system should continuously learn from the farmer's actual farm history.

## 7. MVP Scope

The first MVP should contain the following capabilities.

### 7.1 Farmer Profile

A farmer can:

- Register
- Create a profile
- Add name
- Add phone number
- Select preferred language
- Add village
- Add district
- Add basic farming information

### 7.2 Farm Profile

A farmer can create one or more farms.

Farm information may include:

- Farm name
- Location
- Total area
- Irrigation availability
- Irrigation type
- Soil information
- Ownership/tenancy information where relevant
- Farming history

### 7.3 Plot Management

A farm may contain multiple plots.

Each plot should have:

- Plot identifier
- Area
- Location
- Soil information
- Irrigation information
- Current crop
- Previous crop
- Crop history

The system should treat the **plot as the fundamental agricultural unit**.

## 8. Crop Planning

The system should help the farmer compare potential crops.

Inputs may include:

- Location
- Plot size
- Soil information
- Water availability
- Previous crop
- Season
- Labour availability
- Budget
- Crop duration
- Market information

The system may present several scenarios, such as:

- **Option A — Lower risk:** Prioritize established crops and lower operational complexity.
- **Option B — Higher potential return:** Consider crops with potentially higher economic value but potentially greater market or production risk.
- **Option C — Water constrained:** Prioritize crops compatible with limited water availability.

The system must show assumptions and uncertainty.

It must not simply state: *"This is the best crop."*

## 9. Crop Cycle

After selecting a crop, the farmer creates a crop cycle.

A crop cycle contains:

- Crop
- Variety where applicable
- Plot
- Sowing date
- Expected harvest period
- Crop stage
- Activities
- Observations
- Expenses
- Harvest
- Sales

The **crop cycle is the central object** connecting farm activities.

## 10. Crop Activity Tracking

Farmers should be able to record activities such as:

- Land preparation
- Sowing
- Irrigation
- Fertilization
- Weeding
- Pest-management activity
- Labour
- Machinery usage
- Other farm operations

Each activity should have:

- Date
- Activity type
- Quantity where applicable
- Cost where applicable
- Notes

## 11. Crop Health Timeline

Farmers should be able to periodically upload crop photographs.

The system should create a chronological crop-health timeline.

Example:

```
Day 20 → Crop image
Day 27 → Crop image
Day 34 → Crop image
Day 41 → Crop image
```

The system may use AI to compare observations over time.

Possible outputs include:

- Growth-stage estimation
- Visible changes
- Possible stress
- Possible disease/pest indicators
- Possible nutrient deficiency indicators
- Possible water stress

AI outputs must include uncertainty where appropriate.

The system should encourage expert inspection when confidence is low or the consequence of an incorrect recommendation is significant.

## 12. Government Schemes

The platform should help farmers discover potentially relevant government schemes.

Each scheme record should contain, where available:

- Scheme name
- Government department
- State
- District applicability
- Crop applicability
- Farmer eligibility
- Benefit
- Required documents
- Application process
- Application deadline
- Official application link
- Source
- Last verification date

Official government sources should be treated as the primary source of truth.

The AI should simplify official information into farmer-friendly language without changing the underlying eligibility rules.

## 13. Crop Insurance

The platform should help farmers understand relevant crop-insurance information.

The system may help identify:

- Relevant insurance scheme
- Applicable crop
- Applicable geography
- Season
- Eligibility
- Important dates
- Premium information
- Claim-reporting procedure
- Official source

The product must not promise that a farmer will receive an insurance payout.

## 14. Farm Economics

Farmers should be able to record:

### Costs

- Seeds
- Fertilizer
- Crop-protection inputs
- Labour
- Machinery
- Irrigation
- Transport
- Other expenses

### Revenue

- Harvest quantity
- Sale quantity
- Sale price
- Buyer
- Transport cost
- Other sale-related costs

The system should calculate:

```
  Revenue
− Costs
= Net farm result
```

The system should preserve historical results for future crop planning.

## 15. Buyer Discovery

The MVP may allow farmers to discover potential buyers.

Buyer information may include:

- Buyer name
- Crop
- Required quantity
- Quality requirements
- Location
- Expected date
- Pickup availability
- Payment terms
- Verification status

The platform must distinguish between:

- **Confirmed demand** — A buyer has explicitly committed to purchasing.
- **Indicative demand** — A buyer has expressed interest but has not committed.
- **Market information** — Information about broader market conditions.

The system must never represent indicative demand as a guaranteed buyer.

## 16. AI Layer

AI is not the product itself.

AI should be used where it provides meaningful value.

Initial AI capabilities:

### Natural-language interaction

Farmer can ask:

> "What should I do today?"

or:

> "मेरे खेत में पत्ते पीले हो रहे हैं।"

The system should use the farmer's actual farm context where available.

### Local-language assistance

The interface should eventually support:

- Hindi
- Hinglish
- Relevant regional languages

The exact languages supported by the MVP should be determined during field validation.

### Crop-health assistance

AI can analyze crop photographs and historical observations.

It should provide:

- Possible observations
- Confidence
- Alternative explanations where relevant
- Suggested next action
- Escalation to expert when appropriate

### Information explanation

AI can explain:

- Government schemes
- Insurance information
- Crop activities
- Farm economics
- Agricultural terminology

AI should not override authoritative source information.

## 17. Data Strategy

The long-term value of Farmer 365 depends on longitudinal farm data.

The system should eventually connect:

```
Soil → Crop → Weather → Crop activities → Inputs → Irrigation
→ Crop health → Labour → Yield → Price → Revenue → Profit
```

The system should preserve historical crop cycles rather than replacing them.

This enables future analytical capabilities such as:

- Farm performance analysis
- Crop comparison
- Yield analysis
- Cost analysis
- Crop-rotation analysis
- Risk analysis
- Personalized decision support

## 18. Data Privacy

Farmer data is sensitive business information.

The application must:

- Authenticate users
- Restrict access to authorized data
- Use row-level security where appropriate
- Protect API keys and secrets
- Avoid exposing private farmer information
- Maintain appropriate auditability
- Obtain appropriate consent for data use

Farmers should understand how their data is being used.

## 19. MVP Non-Goals

Do **NOT** build these in the first MVP unless validation demonstrates a strong need:

- Custom foundation model
- Custom weather-prediction model
- Autonomous farming
- IoT hardware
- Drone integration
- Complex financial products
- Full agricultural e-commerce
- National marketplace
- Large logistics network
- Automated pesticide prescription
- Cryptocurrency/blockchain
- Complex social network
- Excessive gamification

The objective is to validate the core agricultural workflow.

## 20. Technical Product Principle

Prefer simple, maintainable technology.

Initial architecture:

| Layer | Technology |
|---|---|
| Frontend | Next.js + TypeScript |
| Backend | Supabase |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| File storage | Supabase Storage |
| Deployment | Vercel |
| Version control | Git |
| AI | External model APIs initially |

Do not introduce additional infrastructure unless there is a demonstrated requirement.

## 21. Development Principle

Every feature must answer:

1. What farmer problem does this solve?
2. Who uses it?
3. What data does it require?
4. What does the system produce?
5. How do we know it works?
6. What happens when the system is uncertain or fails?

Features without a clear answer should not automatically be implemented.

## 22. MVP Success Criteria

The MVP is **not** successful because:

- The application looks beautiful.
- The application has many features.
- The application has an AI chatbot.
- The application has many downloads.

The MVP should demonstrate that real farmers can use it to complete meaningful agricultural workflows.

Initial validation metrics should include:

- Number of farmers onboarded
- Number of active farmers
- Number of farms created
- Number of plots created
- Number of crop cycles created
- Frequency of crop observations
- Number of completed workflows
- Number of successful buyer interactions
- Recorded farm economics
- Farmer retention

The most important metric is repeated real-world usage and measurable workflow completion.

## 23. Product Expansion After Validation

After validating the MVP, potential expansion areas include:

- Labour discovery
- Machinery services
- Input purchasing
- FPO management
- Buyer aggregation
- Logistics
- Financing connections
- Insurance workflows
- Advanced crop-health intelligence
- Weather-risk analysis
- Demand forecasting
- Multi-district deployment
- Multi-state deployment

Expansion should be driven by evidence from farmers and partners.

## 24. Definition of the First Release

The first usable release should allow a farmer to:

1. Register
2. Create a farm
3. Create a plot
4. Enter basic soil/water information
5. Create a crop cycle
6. Record farm activities
7. Upload crop photographs
8. View the crop timeline
9. View relevant government/insurance information
10. Record expenses
11. Record harvest
12. Record a sale
13. See basic crop economics

This is the minimum foundation for the Farmer 365 operating system.

## 25. Development Rule for AI Coding Agents

Any coding agent working on Farmer 365 must read this file before implementing product functionality.

The agent must not:

- Invent major product requirements
- Expand MVP scope without instruction
- Change core workflows without documentation
- Introduce unnecessary infrastructure
- Claim agricultural certainty where uncertainty exists

The agent should prioritize:

**Correctness → Security → Simplicity → Testability → User experience → Performance**

The product specification is a living document and should be updated when major product decisions change.
