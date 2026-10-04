# Weather sources

What the plot page and the farm assistant show about weather, where it comes from, and what must
be done before IMD data can be switched on. See SYSTEM_ARCHITECTURE.md section 13 (observed vs
forecast vs model-derived must be kept apart).

| Shown as | Source | Kind | Where |
|---|---|---|---|
| "IMD warnings for {district} district" | India Meteorological Department, district warnings (next 5 days, colour-coded) | **Official** forecast/warning | Plot page (first), farm assistant |
| "Rain measured by IMD in {district} district" | IMD district rainfall: last 24 hours, last reported week, season so far, each with normal and category | **Observed** (rain gauges, district average) | Plot page, farm assistant |
| "Rain in the last 7 days (estimate)" | Open-Meteo, `past_days=7` of the same request | **Model estimate** of past weather for the area, not a rain gauge; shown only when IMD rainfall is not available | Plot page, farm assistant |
| "Next 7 days (forecast)", "Now (estimate)" | Open-Meteo forecast | **Model forecast** | Plot page, farm assistant |
| "Official forecast from IMD" link | IMD website; IMD's Mausam and Meghdoot apps named | Link only | Plot page, always |

Nothing is stored in the database: responses are cached for an hour by the application
(DATABASE.md section 27a). The plot's location is rounded to about 5 km before it is sent to
Open-Meteo. IMD is asked for its district list; nothing about the farmer is sent.

## Recent rain (Open-Meteo `past_days`)

Open-Meteo returns modelled values for the past days in the same response as the forecast. They
are estimates for a ~5 km area, so the screen says "estimate" and "not measured by a rain gauge",
and the assistant is told the same. Rainy day = 2.5 mm or more (IMD's definition). If any day is
missing, no total is shown.

When IMD's measured district rainfall is available (below), it replaces this estimate on the plot
page and for the assistant: two different past-rain figures would confuse.

## IMD district warnings (off until checked)

IMD serves its APIs only to registered servers whose IP address it has whitelisted, and IMD's API
documentation could not be reached from the build environment. The adapter
(`src/features/weather/imd.ts`) therefore follows IMD's district warning API **as publicly
described**, and stays **off** until `IMD_API_URL` is set.

Expected response: a JSON array with one object per district:

```json
{ "Date": "2026-10-04", "District": "Patna", "State": "Bihar (optional)",
  "Day_1": "2,4", "Day_2": "16", "Day_3": "1", "Day_4": "9", "Day_5": "1",
  "Day1_Color": "2", "Day2_Color": "1", "Day3_Color": "4", "Day4_Color": "3", "Day5_Color": "4" }
```

- `Date` is the issue date; `Day_1` is that day, `Day_5` four days later.
- `DayN_Color`: 1 red, 2 orange, 3 yellow, 4 green.
- `Day_N`: comma-separated warning numbers. 1 no warning, 2 heavy rain, 3 heavy snow,
  4 thunderstorm and lightning, 5 hailstorm, 6 dust storm, 7 dust-raising winds, 8 strong surface
  winds, 9 heat wave, 10 hot day, 11 warm night, 12 cold wave, 13 cold day, 14 ground frost,
  15 fog, 16 very heavy rain, 17 extremely heavy rain.

Safety checks: the app shows **nothing** from IMD (only the link) when the response is not an
array of such objects; a code or colour is unknown; a coloured day has no warning or a green day
has one (this catches reversed colour numbers); the district is not found or appears more than
once (e.g. Aurangabad is in Bihar and in Maharashtra) without a `State` to tell them apart; or the
warnings were issued more than one day ago.

District matching ignores case, spaces and hyphens only. If the pilot district's name in IMD's list
differs from what farmers type, decide the pilot district list first (FIELD_READINESS item 1).

### Before switching it on

1. Register the production server with IMD for API access (IP whitelisting) and get the URL of the
   district warning list.
2. Fetch one real response from that server and compare it with the format above: field names,
   date format, colour numbers and warning numbers. Fix `imd.ts` (and its unit tests) where it
   differs. Check against IMD's API reference, not this file.
3. Confirm the pilot district appears exactly once (or with its state).
4. Set `IMD_API_URL` (server only) to that URL, open a plot in the pilot district and compare the
   screen with IMD's website for the same day.
5. Record the check (date, who, what was compared) in docs/FIELD_READINESS.md.

## IMD district rainfall (off until checked)

Rain measured by IMD's rain gauges and averaged over the district
(`src/features/weather/imd-rainfall.ts`), off until `IMD_RAINFALL_URL` is set. Same situation as
the warnings: the field names follow IMD's district rainfall API **as publicly described**, not
checked against a real response.

Expected response: a JSON array with one object per district (all values may be strings):

```json
{ "OBJ_ID": "164", "District": "PATNA", "Date": "2026-10-04",
  "Daily Actual": "12.40", "Daily Normal": "3.10", "Daily Departure Per": "300%", "Daily Category": "LE",
  "Week Date": "27-09-2026 To 03-10-2026",
  "Weekly Actual": "18.20", "Weekly Normal": "22.80", "Weekly Departure Per": "-20%", "Weekly Category": "D",
  "Cumulative Date": "2026-06-01",
  "Cumulative Actual": "845.30", "Cumulative Normal": "960.50", "Cumulative Departure Per": "-12%", "Cumulative Category": "N" }
```

- `Date`: the day the 24-hour total ends (IMD's day is 08:30 to 08:30 IST, shown as "24 hours to
  8:30 am"). Weekly figures are for IMD's reported week (`Week Date`), which need not end on `Date`;
  the screen shows its dates. "Cumulative" is shown as "since {Cumulative Date}". Monthly figures are
  not used.
- Categories: LE large excess (+60% or more), E excess (+20 to +59%), N normal (−19 to +19%),
  D deficient (−20 to −59%), LD large deficient (−60 to −99%), NR no rain. Shown in plain words
  ("Much more than normal" … "No rain").
- Dates may be `YYYY-MM-DD` or `DD-MM-YYYY`; district names in capitals are shown title-cased.

Safety checks: nothing is shown (the model estimate is shown instead) when the district is missing
or ambiguous, the report is more than 2 days old, or a value is not understood: an amount that is
not a plain number, an unknown category, a departure below −100%, an unreadable date, or "no rain"
with rain. A period IMD gives no figure for (empty, NA) is left out on its own.

### Before switching rainfall on

Same steps as for the warnings, with the district rainfall list and `IMD_RAINFALL_URL`. Also check:
the meaning of `Date` (end of the 24 hours), the week and season definitions, and whether amounts
for "trace" rain appear as text. Compare the screen with IMD's district rainfall page for the
same day.

Tests use stand-ins (`tests/support/mock-anthropic.ts`, `GET /imd/warnings` and `GET /imd/rainfall`)
with the formats above.
