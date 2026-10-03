# Crop insurance information — how the team maintains it

Kisan 360 shows, on each crop, the crop insurance information that may cover it
(USER_WORKFLOWS.md section 11). The app never decides eligibility and **never promises that a
claim will be paid** (PRODUCT_SPEC.md section 13). **No insurance information ships with the
app**: until the team loads it, farmers see "No crop insurance information for this crop is
available yet".

The rules are the same as for schemes (see `docs/SCHEMES.md`): copy from the official source
without changing any rule; `source_name`, `source_url` (https) and `last_verified_at` are
required; write Hindi and English; re-check at least every 6 months; archive with
`"status": "ARCHIVED"`.

## Format

A JSON array. Example with placeholders (not real insurance):

```json
[
  {
    "slug": "example-crop-insurance-rabi-2026",
    "provider": "<programme or insurer, as on the official source>",
    "state": "Bihar",
    "districts": [],
    "crops": ["Wheat", "Lentil (masoor)"],
    "seasons": ["rabi"],
    "enrollment_deadline": "2026-12-31",
    "official_url": "https://<official enrolment page>",
    "source_name": "<name of the official source>",
    "source_url": "https://<official page you checked>",
    "last_verified_at": "2026-10-03",
    "status": "PUBLISHED",
    "texts": {
      "hi": {
        "name": "…",
        "summary": "One or two plain sentences.",
        "eligibility": "Who can take it, from the official rules.",
        "coverage": "Which losses are covered.",
        "premium": "What the farmer pays.",
        "important_dates": "Enrolment window, other dates (optional).",
        "claim_process": "How and how soon to report crop damage, and to whom."
      },
      "en": { "name": "…", "summary": "…", "eligibility": "…", "coverage": "…", "premium": "…", "important_dates": "…", "claim_process": "…" }
    }
  }
]
```

| Field | Meaning |
|---|---|
| `crops` | **Required**, at least one English crop name exactly as in the crop catalog (e.g. `"Lentil (masoor)"`). |
| `seasons` | `kharif`, `rabi`, `zaid`. Empty: any season. |
| `state`, `districts` | As for schemes: `null` state for all of India; empty districts for the whole state. |
| `enrollment_deadline` | `YYYY-MM-DD`, or `null` when not announced. |

## How it is matched

Shown on a crop (planned, in the field or harvested) when the product covers that crop, in that
crop's season, in the farmer's state or district. Products whose enrolment has closed are shown
last, marked "Enrolment closed".

## Loading

```bash
npm run insurance:import -- insurance.json
```
