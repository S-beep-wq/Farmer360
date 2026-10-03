# Kisan 360 — Development Plan

Status of the MVP build, slice by slice. Each slice is a complete, tested path through the
product loop (PRODUCT_SPEC.md section 6). Scope comes from PRODUCT_SPEC.md section 24.

## Slice 1 — Farmer, farm and plot ✅ complete

Register → farmer profile → create farm → create plot → capture plot location → store → display.

| Task | Status |
|---|---|
| Next.js 16 + TypeScript + Tailwind project, ESLint | ✅ |
| Local Supabase (Docker), phone OTP with local test numbers | ✅ |
| Migration: PostGIS, `farmers`, `farms`, `plots` (location + boundary), triggers, RLS | ✅ |
| Session refresh proxy, server-side auth guards | ✅ |
| Hindi/English text system (Hindi default) and language switch | ✅ |
| Phone login (registration and login are one flow) | ✅ |
| Farmer profile onboarding | ✅ |
| Create and list farms | ✅ |
| Create plot: name, area or boundary, soil, irrigation | ✅ |
| Plot location: phone GPS (with accuracy), map pin, boundary drawing, area from map | ✅ |
| Farm page (map of plots + list) and plot page (map + details) | ✅ |
| Unit, integration (RLS) and end-to-end tests | ✅ |
| Docs: README, DATABASE.md v0.2 | ✅ |

## Slice 2 — Edit farm and plot ✅ complete

| Task | Status |
|---|---|
| Edit farm details (name, village, area, irrigation, soil); state/district stay from the profile | ✅ |
| Edit plot details, including moving or removing the pin and redrawing or clearing the boundary | ✅ |
| Shared forms for add and edit; saved values prefilled; map starts on the saved plot | ✅ |
| "Remove pin" on the location picker (also available when adding) | ✅ |
| Unit, integration and end-to-end tests for editing | ✅ |

Editing overwrites the current values (with `updated_at`); earlier boundaries are not kept.
See "Open questions" below.

## Next slices (proposed, not started)

1. **Crop cycle creation** (USER_WORKFLOWS.md section 6) — needs `crop_catalog` with a small,
   verified crop list for the pilot district.
2. Crop activities (section 7) and expenses (section 12).
3. Crop observations with photos (section 8–9) — needs Supabase Storage.
4. Harvest, sale and season economics (sections 13, 15, 16).
5. Government scheme / insurance information (sections 10–11).

## Open questions for the product owner

- Which district is the pilot district? (Profile currently takes free-text state/district.)
- Should bigha/katha be supported, and with which conversion for that district?
- Which map tile provider (ideally satellite imagery) and SMS provider will be used in production?
- Once crop cycles exist, should a plot's earlier boundaries be kept (so past seasons keep the
  area they were grown on)? Today an edit replaces the boundary.
- Hindi wording should be reviewed by a native speaker from the pilot area.
