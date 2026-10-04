# Field readiness — before the pilot

What was checked in the code (October 2026), and what people still need to do before farmers use
Kisan 360 in the pilot district. The items in **section 2** block the pilot.

## 1. Checked and fixed in the code

### Accessibility — `tests/e2e/accessibility.spec.ts`

axe-core with the WCAG 2.1 A/AA and 2.2 AA rules (including touch-target size) on **40 screen
states**: signed out, onboarding, every farmer screen (with a farm, mapped plot, crop, photo and an
AI answer), a form showing errors, five screens in Hindi, and the buyer screens. It runs with the
other end-to-end tests, so new problems fail the build.

Found and fixed:
- Maps were marked `role="img"` while Leaflet puts focusable buttons and links inside them →
  now labelled regions.
- Map attribution links relied on colour alone → underlined.

Automated checks find only part of the problems. Still to do with people: screen reader
(TalkBack) on a real phone, very large system font, bright sunlight.

### Low-end phone and slow network — `npm run build && npm run test:perf`

Production build, Lighthouse "slow 3G" (400 Kbps, 400 ms round trip), CPU 4× slower, first visit,
no cache. Budgets: ≤ 350 KB JavaScript, ≤ 600 KB in total, main content within 10 s.

| Screen | JS (KB) | Total (KB) | Content shown (s) | Fully loaded (s) |
|---|---|---|---|---|
| My farms | 139 | 162 | 1.5 | 4.2 |
| Farm (map) | 140 | 169 | 1.5 | 4.4 |
| Plot (map, weather) | 140 | 170 | 1.5 | 4.4 |
| Add a plot (map picker) | 188 | 219 | 1.4 | 4.5 |
| Crop | 139 | 161 | 1.5 | 4.2 |
| Add a crop photo | 142 | 169 | 1.5 | 4.3 |
| Crop planning | 139 | 163 | 1.5 | 4.2 |
| Farm assistant | 143 | 169 | 1.5 | 4.4 |
| Market | 139 | 157 | 1.5 | 4.2 |

Not included: map tiles (from the tile provider; on 2G/3G they are the heaviest part of map
screens) and crop photos (made smaller to ≤ 1600 px in the phone before upload).

Added: a loading screen in the farmer's language for every page change, so a slow tap is not
repeated. Trade-off (documented by Next.js): pages now stream, so an address that does not exist
shows the "not found" screen with HTTP status 200 and a `noindex` tag instead of a 404 status.
All such pages are private signed-in pages, so this only matters for monitoring that counts 404s.

### Hindi

- Every interface text is in `hi.ts` (a unit test checks the keys match English); no English is
  hard-coded in screens except the bilingual error page.
- Spelling made consistent: तारीख़ (with nukta, like फ़सल, ज़िला).
- First-person texts a farmer or buyer chooses as their own are now gender-neutral:
  "मुझे पता है कि मेरी सारी जानकारी…" and "हाँ, पक्का खरीदना है".
- For the reviewer: `docs/translations-for-review.csv` has all 645 texts, English next to Hindi,
  with a column for suggestions (`npm run translations:export` makes a fresh copy).

### Security

Every page now sends `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` and a
`Permissions-Policy` that allows the camera and location only for the app itself
(`tests/e2e/security-headers.spec.ts`).

## 2. Before the pilot (people and decisions)

| # | What | Who | Why it blocks |
|---|---|---|---|
| 1 | **Choose the pilot district** and a fixed district list for profiles | Product | Schemes, insurance, references and buyer search match on the district name farmers type. |
| 2 | **Native Hindi review** of `docs/translations-for-review.csv` by someone from the pilot area, incl. crop names in `crop_catalog.name_hi` | Field team | Wording was written by the development team. Also decide whether the respectful "आप … सकते हैं" (grammatically masculine) is fine. |
| 3 | **Load verified data**: schemes (`docs/SCHEMES.md`), crop insurance (`docs/INSURANCE.md`), crop reference data (`docs/CROP_REFERENCES.md`), and plan re-checks every 6 months | Team + agronomist | None ships with the app; those screens are empty until loaded. |
| 4 | **Data-use notice and consent** in plain Hindi (what is stored, what goes to Anthropic, Open-Meteo, buyers), checked against India's DPDP Act 2023 | Product + legal | PRODUCT_SPEC section 18: farmers must understand how their data is used. The app explains each sharing step where it happens, but has no overall notice yet. |
| 5 | **SMS provider for login** in the hosted Supabase project, with DLT registration (TRAI) for the sender ID and OTP template | Ops | Without it no one can log in. Test OTP numbers must not exist in production. |
| 6 | **Production configuration**: hosted Supabase (`supabase db push` of all migrations), Vercel env (publishable key only — never `SUPABASE_SECRET_KEY`), `ANTHROPIC_API_KEY` with a spending limit, `OPEN_METEO_API_KEY` (commercial plan), licensed map tiles (`NEXT_PUBLIC_MAP_TILE_URL`) | Ops | Open-Meteo and OpenStreetMap tiles are free only for non-commercial/light use. |
| 7 | **Check real outside services once**: one Open-Meteo forecast and one Claude answer from the deployed app | Ops | Both were built from their documentation and tested only against local stand-ins (the build environment blocks them). |
| 8 | **Buyer verification process** (who checks buyers, how) | Product | Buyers show "Not verified" until the team marks them in the database. |
| 9 | **Real-device test** on 2–3 low-end Android phones (2–3 GB RAM, Android 10+), Chrome: login, add plot with GPS, crop photo, weather, outdoors, on 2G/3G | Field team | Emulation is not a real phone, camera or GPS. |
| 10 | **Backups and error monitoring**: Supabase point-in-time recovery, error logs reviewed weekly | Ops | Farmer records are the product's memory. |
| 11 | **AI review plan**: someone reads the first ~50 crop-photo answers and assistant feedback before widening | Agronomist | AI answers have not been validated in the field. |

## 3. Field test script (5–8 farmers, 30–40 minutes each)

Give the phone with the app open on the login screen and observe without helping. Note where
they hesitate, what they ask, and what they tap by mistake.

1. Log in with your own mobile number and fill in your details.
2. Add your farm and one field (plot), and mark where it is.
3. Add the crop growing in that field now.
4. Write down work you did last week and what it cost.
5. Take a photo of the crop and say how it looks; ask the AI about it.
6. Look at the weather for this field. What will happen in the next 3 days?
7. Ask the assistant: "आज मुझे क्या करना चाहिए?"
8. Find a buyer for your crop.
9. Find a government scheme that may help you.

Afterwards ask: What was hard? What did you not trust? What would make you open this again next week?

## 4. Known limitations to tell the pilot team

- No offline mode: entries need a network connection at the time of saving.
- Weather is a model forecast (not IMD); no observed rainfall yet.
- AI answers are one question at a time and are not saved.
- Content-Security-Policy header is not set yet (needs a list of allowed tile/image hosts).
