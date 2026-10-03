# Government scheme information — how the team maintains it

Kisan 360 shows farmers government schemes that **may** be relevant to them
(USER_WORKFLOWS.md section 10). The app never decides eligibility. All scheme information is
official external data (SYSTEM_ARCHITECTURE.md section 12), loaded by the Kisan 360 team after
checking it. **No scheme information ships with the app**: until the team loads it, farmers see
"No scheme information is available yet".

## Rules

- Copy eligibility, benefit and documents from the **official source**. You may simplify the
  wording for farmers, but never change a rule (PRODUCT_SPEC.md section 12).
- Every scheme needs `source_name`, `source_url` (https) and `last_verified_at` (the day you
  checked it against the source). The database refuses a scheme without them.
- Write both Hindi (`hi`) and English (`en`) text. A native speaker should check the Hindi.
- Re-check every scheme at least every 6 months. After 180 days the app warns farmers that the
  information may have changed.
- When a scheme ends, import it again with `"status": "ARCHIVED"`. Farmers stop seeing it.

## Format

A JSON array of schemes. Example with placeholders (not a real scheme):

```json
[
  {
    "slug": "example-seed-subsidy-2026",
    "department": "<department name, as on the official source>",
    "state": "Bihar",
    "districts": [],
    "crops": ["Wheat"],
    "seasons": ["rabi"],
    "application_deadline": "2026-12-15",
    "official_url": "https://<official application page>",
    "source_name": "<name of the official source>",
    "source_url": "https://<official page you checked>",
    "last_verified_at": "2026-10-03",
    "status": "PUBLISHED",
    "texts": {
      "hi": {
        "name": "…",
        "summary": "One or two plain sentences.",
        "eligibility": "Who can apply, from the official rules.",
        "benefit": "What the farmer gets.",
        "required_documents": ["…", "…"],
        "how_to_apply": "Where and how to apply."
      },
      "en": { "name": "…", "summary": "…", "eligibility": "…", "benefit": "…", "required_documents": [], "how_to_apply": "…" }
    }
  }
]
```

| Field | Meaning |
|---|---|
| `slug` | Stable id (lowercase words with hyphens). Importing the same slug again updates the scheme. |
| `state` | `null` for a scheme across India; otherwise the state's name as farmers write it in their profile. |
| `districts` | Empty for the whole state; otherwise the districts it applies to. Needs a `state`. |
| `crops` | English crop names exactly as in the crop catalog (e.g. `"Wheat"`, `"Lentil (masoor)"`). Empty: any crop. |
| `seasons` | `kharif`, `rabi`, `zaid`. Empty: any season. |
| `application_deadline` | `YYYY-MM-DD`, or `null` when no deadline is announced. |
| `official_url` | Where to apply (optional, https). |

## How a scheme is matched to a farmer

Shown as **"May be relevant for you"** when all of these hold, otherwise under "Other schemes in
your area" (schemes for other states or districts are not shown):

1. The scheme is for all of India, for the farmer's state (no districts), or for their district.
2. It is for any crop and season, or one of the farmer's planned, growing or harvested crops is
   one of its crops and seasons.
3. Its deadline has not passed.

## Loading

```bash
npm run schemes:import -- schemes.json
# same as: node --env-file=.env.local scripts/import-official-data.mjs schemes schemes.json
```

The script needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` for the project you are
loading into. Each scheme is saved in one step or not at all; errors name the scheme and field.
