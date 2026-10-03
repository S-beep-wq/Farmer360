# Crop reference data for planning — how the team maintains it

Crop planning (USER_WORKFLOWS.md section 5) compares crops for a plot and season. It always shows
the farmer's **own** past results first (facts). Reference data adds **estimates**: typical ranges
for a crop in a season and area, such as time in the field, water and labour needs, cost per acre,
harvest per acre and price. The app shows them in a separate, dashed box marked "Reference
estimates (not your records)", with the source and the date they were checked, and never uses them
to reorder the farmer's own results.

**No reference data ships with the app.** Until the team loads it, planning shows only the
farmer's records, buyers and support, and says that Kisan 360 does not estimate costs, harvests
or prices yet.

## Rules

- Take numbers from an agronomic or official source for the pilot area: for example the state
  agriculture department's cost-of-cultivation data, the local Krishi Vigyan Kendra, or the
  Commission for Agricultural Costs and Prices (CACP). Give ranges, not single numbers.
- `source_name`, `source_url` (https) and `last_verified_at` are required; the database refuses a
  row without them. Every number is optional: leave out what the source does not give.
- Prices change every season. Re-check at least every 6 months (the app warns after 180 days).
- A reference row for a crop and season means "usually grown in this season" in that area; the
  app shows it as such. Do not add rows for seasons the crop is not suited to.
- Write the texts in Hindi and English. Do not name pesticides or doses in `input_needs`.

## Format

A JSON array. Example with placeholders (**not real numbers**):

```json
[
  {
    "slug": "example-wheat-rabi-bihar",
    "crop": "Wheat",
    "season": "rabi",
    "state": "Bihar",
    "districts": [],
    "duration_days_min": 0,
    "duration_days_max": 0,
    "water_need": "MEDIUM",
    "labour_days_per_acre_min": 0,
    "labour_days_per_acre_max": 0,
    "cost_per_acre_min": 0,
    "cost_per_acre_max": 0,
    "yield_kg_per_acre_min": 0,
    "yield_kg_per_acre_max": 0,
    "price_per_quintal_min": 0,
    "price_per_quintal_max": 0,
    "source_name": "<name of the source>",
    "source_url": "https://<page or document you used>",
    "last_verified_at": "2026-10-03",
    "texts": {
      "hi": { "input_needs": "…", "production_risks": "…", "market_notes": "…" },
      "en": { "input_needs": "…", "production_risks": "…", "market_notes": "…" }
    }
  }
]
```

(Replace every 0 with the source's numbers, or remove the field. Zero is refused by the database.)

| Field | Meaning |
|---|---|
| `crop` | English crop name exactly as in the crop catalog, e.g. `"Lentil (masoor)"`. |
| `season` | `kharif`, `rabi` or `zaid`. |
| `state`, `districts` | `null` state for all of India; empty districts for the whole state. The most specific match for the farmer is used (district, then state, then India). |
| `*_min` / `*_max` | A range; give both or neither, with min ≤ max. Costs and prices in rupees; harvest in kg per acre; price per quintal (100 kg); labour in person-days per acre. |
| `water_need` | `LOW`, `MEDIUM` or `HIGH`. |

The app works out, per acre: possible money from sales = harvest × price (low × low to high ×
high), and possible result = that minus cost (worst case: lowest sales − highest cost).

## Loading

```bash
npm run crop-references:import -- crop-references.json
```
