import { z } from "zod";

// IMD (India Meteorological Department) district warnings for the next 5 days: the official,
// colour-coded warnings IMD issues for each district. See docs/WEATHER.md.
//
// NOT YET CHECKED AGAINST IMD: IMD's API is open only to registered, whitelisted servers and its
// documentation could not be reached from the build environment. The response format and the two
// code tables below follow IMD's district warning API as publicly described; before switching it on
// (IMD_API_URL), compare one real response and IMD's API reference with them. Anything that does
// not match is rejected, so a wrong format shows nothing rather than a wrong warning.

const code = z.union([z.string(), z.number()]).transform((v) => String(v).trim());

const entrySchema = z.object({
  Date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  District: z.string().min(1),
  State: z.string().optional(),
  Day_1: code,
  Day_2: code,
  Day_3: code,
  Day_4: code,
  Day_5: code,
  Day1_Color: code,
  Day2_Color: code,
  Day3_Color: code,
  Day4_Color: code,
  Day5_Color: code,
});

export const imdWarningsSchema = z.array(z.unknown());

/** IMD's colour code: how serious the day is, with what to do. */
export const IMD_LEVELS = ["GREEN", "YELLOW", "ORANGE", "RED"] as const;
export type ImdLevel = (typeof IMD_LEVELS)[number];

/** Colour numbers in the API (to verify): 1 red, 2 orange, 3 yellow, 4 green. */
const LEVEL_BY_CODE: Record<string, ImdLevel> = { "1": "RED", "2": "ORANGE", "3": "YELLOW", "4": "GREEN" };

export const IMD_HAZARDS = [
  "HEAVY_RAIN",
  "VERY_HEAVY_RAIN",
  "EXTREMELY_HEAVY_RAIN",
  "HEAVY_SNOW",
  "THUNDERSTORM",
  "HAILSTORM",
  "DUST_STORM",
  "DUST_RAISING_WINDS",
  "STRONG_WINDS",
  "HEAT_WAVE",
  "HOT_DAY",
  "WARM_NIGHT",
  "COLD_WAVE",
  "COLD_DAY",
  "GROUND_FROST",
  "FOG",
] as const;
export type ImdHazard = (typeof IMD_HAZARDS)[number];

/** Warning numbers in the API (to verify). 1 means no warning. */
const HAZARD_BY_CODE: Record<string, ImdHazard | null> = {
  "1": null,
  "2": "HEAVY_RAIN",
  "3": "HEAVY_SNOW",
  "4": "THUNDERSTORM",
  "5": "HAILSTORM",
  "6": "DUST_STORM",
  "7": "DUST_RAISING_WINDS",
  "8": "STRONG_WINDS",
  "9": "HEAT_WAVE",
  "10": "HOT_DAY",
  "11": "WARM_NIGHT",
  "12": "COLD_WAVE",
  "13": "COLD_DAY",
  "14": "GROUND_FROST",
  "15": "FOG",
  "16": "VERY_HEAVY_RAIN",
  "17": "EXTREMELY_HEAVY_RAIN",
};

export type ImdDay = { date: string; level: ImdLevel; hazards: ImdHazard[] };
export type ImdWarnings = { source: "IMD"; district: string; issuedOn: string; days: ImdDay[] };

/** Warnings issued more than this many days ago are not shown as current. */
export const IMD_MAX_AGE_DAYS = 1;

/** "East Champaran", "east  champaran " and "East-Champaran" match; other spellings do not. */
export function districtKey(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z]/g, "");
}

/**
 * The one entry for the district in an IMD district list (matched by name, and by `State` when the
 * list gives it), or null when the list is not an array or the district is missing or ambiguous.
 */
export function findDistrictEntry(json: unknown, place: { district: string; state: string }): unknown {
  const list = imdWarningsSchema.safeParse(json);
  if (!list.success) return null;
  const wanted = districtKey(place.district);
  const matches = list.data.filter(
    (e) => typeof e === "object" && e !== null && typeof (e as { District?: unknown }).District === "string" && districtKey((e as { District: string }).District) === wanted,
  );
  const inState = matches.filter((e) => {
    const state = (e as { State?: unknown }).State;
    return typeof state !== "string" || districtKey(state) === districtKey(place.state);
  });
  return inState.length === 1 ? inState[0] : null;
}

/** IMD often writes names in capitals ("EAST CHAMPARAN"); show them as "East Champaran". */
export function displayName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

function parseDay(warnings: string, colour: string, date: string): ImdDay | null {
  const level = LEVEL_BY_CODE[colour];
  if (!level) return null;
  const codes = warnings.split(",").map((c) => c.trim()).filter(Boolean);
  if (codes.length === 0) return null;
  const hazards: ImdHazard[] = [];
  for (const c of codes) {
    if (!(c in HAZARD_BY_CODE)) return null;
    const hazard = HAZARD_BY_CODE[c];
    if (hazard && !hazards.includes(hazard)) hazards.push(hazard);
  }
  // A coloured day without a hazard, or a hazard on a green day, means we misread the codes.
  if ((level === "GREEN") !== (hazards.length === 0)) return null;
  return { date, level, hazards };
}

/**
 * The 5-day warnings for one district from IMD's district warning list, or null when the district
 * is not found, is listed more than once (e.g. Aurangabad in Bihar and in Maharashtra, unless the
 * response names the state), was issued too long ago, or anything is not in the expected format.
 */
export function normalizeImdWarnings(json: unknown, place: { district: string; state: string }, today: string): ImdWarnings | null {
  const found = findDistrictEntry(json, place);
  if (found === null) return null;
  const entry = entrySchema.safeParse(found);
  if (!entry.success) return null;
  const e = entry.data;
  const issuedOn = e.Date.slice(0, 10);
  if (issuedOn > today || addDays(issuedOn, IMD_MAX_AGE_DAYS) < today) return null;

  const raw = [
    [e.Day_1, e.Day1_Color],
    [e.Day_2, e.Day2_Color],
    [e.Day_3, e.Day3_Color],
    [e.Day_4, e.Day4_Color],
    [e.Day_5, e.Day5_Color],
  ] as const;
  const days: ImdDay[] = [];
  for (const [i, [warnings, colour]] of raw.entries()) {
    const day = parseDay(warnings, colour, addDays(issuedOn, i));
    if (!day) return null;
    if (day.date >= today) days.push(day);
  }
  return { source: "IMD", district: displayName(e.District), issuedOn, days };
}
