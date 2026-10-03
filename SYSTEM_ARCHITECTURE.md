# Farmer 365 — System Architecture

| | |
|---|---|
| **Version** | 0.1 |
| **Status** | MVP Foundation |

---

## 1. Architecture Goal

The system must be:

- Simple
- Maintainable
- Secure
- Testable
- Modular
- Cost-efficient
- Easy for AI coding agents to understand
- Capable of scaling beyond the initial MVP

Avoid unnecessary infrastructure.

## 2. Initial Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage

### Deployment

- Vercel

### Version Control

- Git
- GitHub

### AI

External AI APIs initially.

No custom foundation model in MVP.

## 3. High-Level Architecture

```text
                         FARMER
                           │
                           ↓
                    Next.js Application
                           │
              ┌────────────┼────────────┐
              ↓            ↓            ↓
             UI       Server/API       AI
              │            │            │
              └────────────┼────────────┘
                           ↓
                        Supabase
              ┌────────────┼────────────┐
              ↓            ↓            ↓
         PostgreSQL       Auth        Storage
              │
              ↓
        Farmer Domain Data
```

## 4. Frontend Architecture

The frontend should be organized by business domain.

Example:

```text
src/
├── app/
├── components/
├── features/
│   ├── farmer/
│   ├── farms/
│   ├── plots/
│   ├── crops/
│   ├── observations/
│   ├── schemes/
│   ├── market/
│   └── economics/
├── lib/
├── services/
├── types/
└── tests/
```

Avoid putting all application logic inside UI components.

## 5. Domain Architecture

The main domains are:

```text
Farmer
  │
Farm
  │
Plot
  │
Crop Cycle
  ├── Activities
  ├── Observations
  ├── Photos
  ├── Expenses
  ├── Harvest
  └── Sales
```

Supporting domains:

```text
Government Schemes
Insurance
Buyers
Market Information
AI
```

## 6. Backend Architecture

Supabase provides:

```text
Authentication
      +
PostgreSQL
      +
Storage
      +
API access
```

Business logic should be placed in appropriate server-side services rather than duplicated across frontend components.

## 7. Authentication

Initial authentication:

```text
Phone
 ↓
OTP
 ↓
Authenticated user
 ↓
Farmer profile
```

Every protected resource must be associated with an authenticated user.

## 8. Authorization

Use database-level access controls.

A farmer should only be able to access resources they are authorized to access.

Conceptually:

```text
User
 ↓
Farmer
 ↓
Farm
 ↓
Plot
 ↓
Crop Cycle
```

A farmer must not be able to access another farmer's farm by changing an ID in a request.

Use PostgreSQL Row Level Security where appropriate.

## 9. Storage Architecture

Use Supabase Storage for farmer-uploaded files.

Initial structure:

```text
storage/
└── crop-photos/
    └── farmer/
        └── farm/
            └── plot/
                └── crop-cycle/
                    └── observation/
```

Store metadata in PostgreSQL.

Do not store large binary files directly inside normal database tables.

## 10. AI Architecture

AI should be isolated from the core database.

```text
Farmer
   ↓
Application
   ↓
AI Service
   ↓
Model API
   ↓
Structured Response
   ↓
Application
```

AI should not directly modify critical farm data without validation.

For example:

```text
AI suggests:
"Possible water stress"

Application stores:
AI observation

Farmer confirms:
Actual observation

System preserves:
Both records
```

## 11. AI Context

When the farmer asks a contextual question, the application may provide relevant structured context:

```text
Farmer
Farm
Plot
Crop
Crop Stage
Recent Activities
Recent Observations
Weather Data
Relevant Official Information
```

The AI should receive only the information necessary for the task.

## 12. External Data Architecture

External information should be separated from farmer-generated data.

Examples:

```text
Official Government Data
        ↓
External Data Service
        ↓
Normalized Internal Data
        ↓
Farmer Application
```

External sources must have:

- Source
- Retrieval date
- Verification date where applicable
- Relevant geography
- Data type

## 13. Weather Architecture

Do not build a custom weather-prediction model initially.

Use external authoritative weather data.

Architecture:

```text
Weather Provider
      ↓
Weather Service
      ↓
Normalize
      ↓
Store relevant observations/forecast
      ↓
Crop Planning / Crop Monitoring
```

The application should distinguish:

- Observed weather
- Forecast weather
- Historical climate information
- Model-derived interpretation

## 14. Crop Planning Architecture

Crop planning should be implemented as a separate domain service.

```text
Plot Data
   +
Soil
   +
Water
   +
Season
   +
Previous Crop
   +
Market Information
   +
Crop Database
        ↓
Crop Planning Engine
        ↓
Candidate Crops
        ↓
Scenario Comparison
```

The planning engine should return structured results rather than only free-form AI text.

## 15. Marketplace Architecture

The marketplace should be independent from crop planning.

```text
Farmer
 ↓
Harvest / Expected Harvest
 ↓
Demand Matching
 ↓
Buyer
 ↓
Interaction
 ↓
Transaction
```

Later this architecture can support:

- Labour
- Machinery
- Inputs
- Transport
- Buyers

Do not implement all marketplaces simultaneously.

## 16. Application Layers

Use clear separation:

```text
Presentation Layer
        ↓
Application Layer
        ↓
Domain Layer
        ↓
Data Access Layer
        ↓
Supabase/PostgreSQL
```

Example:

```text
UI
 ↓
CreateCropCycle()
 ↓
CropCycleService
 ↓
Database Repository
 ↓
PostgreSQL
```

The UI should not contain raw database logic everywhere.

## 17. API Design

APIs should be organized around business resources.

Examples:

```text
/farmers
/farms
/plots
/crop-cycles
/crop-activities
/observations
/expenses
/harvests
/buyers
/sales
/schemes
```

Use consistent validation and error responses.

## 18. Validation

Validate data at multiple levels:

```text
Frontend validation
        +
Server validation
        +
Database constraints
```

Never rely exclusively on frontend validation.

## 19. Error Handling

Errors should be:

- Logged
- Understandable to developers
- Safe for users
- Free of secrets

User-facing errors should use simple language.

Developer logs can contain technical details where appropriate.

## 20. Testing Architecture

Every important domain should have tests.

```text
Unit Tests
    ↓
Integration Tests
    ↓
End-to-End Tests
```

Critical workflows:

```text
Registration
Farm creation
Plot creation
Crop-cycle creation
Photo upload
Expense recording
Harvest recording
Sale recording
Authorization
```

## 21. Observability

Initial MVP should have basic:

- Application error logging
- Database error monitoring
- API failure monitoring
- Authentication failure monitoring

Advanced observability can be added later.

## 22. Security Principles

Never:

- Commit secrets
- Expose API keys
- Trust client-side authorization
- Disable database security for convenience
- Allow unrestricted file access
- Log sensitive credentials

Use environment variables for secrets.

## 23. Scalability Principle

Do not optimize prematurely.

Initial target:

```text
1 district
↓
~50 farmers
↓
~500 farmers
↓
Multiple FPOs
↓
Multiple districts
```

The architecture should be capable of scaling, but infrastructure complexity should only increase when actual usage requires it.

## 24. Deployment

Initial deployment:

```text
GitHub
   ↓
Vercel
   ↓
Next.js
   ↓
Supabase
```

Development:

```text
Local machine
 ↓
Git
 ↓
GitHub
 ↓
Preview deployment
 ↓
Production
```

Use separate development and production environments when practical.

## 25. Architectural Rule

Prefer:

**Simple → Modular → Tested → Observable → Scalable**

over:

**Complex → Distributed → Prematurely optimized**

Every new infrastructure component must have a demonstrated reason to exist.
