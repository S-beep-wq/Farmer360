# Weather sources

What the plot page and the farm assistant show about weather, where it comes from, and what must
be done before IMD data can be switched on. See SYSTEM_ARCHITECTURE.md section 13 (observed vs
forecast vs model-derived must be kept apart).

| Shown as | Source | Kind | Where |
|---|---|---|---|
| "IMD warnings for {district} district" | India Meteorological Department, district warnings (next 5 days, colour-coded) | **Official** forecast/warning | Plot page (first), farm assistant |
| "Rain in the last 7 days (estimate)" | Open-Meteo, `past_days=7` of the same request | **Model estimate** of past weather for the area, not a rain gauge | Plot page, farm assistant |
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

To replace it with **observed** rain later: IMD district rainfall (daily actual vs normal) or IMD
gridded rainfall would be the official source. Keep the label honest about which one is shown.

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

Tests use a stand-in (`tests/support/mock-anthropic.ts`, `GET /imd/warnings`) with the format above.
