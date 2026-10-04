import { z } from "zod";

import { addDays, displayName, findDistrictEntry } from "./imd";

// IMD (India Meteorological Department) district rainfall: rain MEASURED by IMD's rain gauges,
// averaged over the district, with the normal for the period. See docs/WEATHER.md.
//
// NOT YET CHECKED AGAINST IMD: like the warnings (imd.ts), IMD's API is open only to registered,
// whitelisted servers and could not be reached from the build environment. The field names follow
// IMD's district rainfall API as publicly described; compare one real response before switching it
// on (IMD_RAINFALL_URL). Anything that does not match is rejected.

/** IMD's categories for rain compared with normal. */
export const IMD_RAIN_CATEGORIES = ["LE", "E", "N", "D", "LD", "NR"] as const;
export type ImdRainCategory = (typeof IMD_RAIN_CATEGORIES)[number];

export type ImdRainPeriod = {
  /** First and last day of the period (ISO dates), when IMD gives them. */
  from: string | null;
  to: string | null;
  actualMm: number;
  normalMm: number | null;
  /** Percentage above (+) or below (−) normal. */
  departurePct: number | null;
  category: ImdRainCategory | null;
};

export type ImdRainfall = {
  source: "IMD";
  district: string;
  /** The day the 24-hour total ends (IMD reports rain for the 24 hours to 08:30 IST). */
  date: string;
  day: ImdRainPeriod | null;
  week: ImdRainPeriod | null;
  season: ImdRainPeriod | null;
};

/** Rainfall reported more than this many days ago is not shown as recent. */
export const IMD_RAIN_MAX_AGE_DAYS = 2;

const text = z.union([z.string(), z.number()]).transform((v) => String(v).trim());
const MISSING = new Set(["", "NA", "N.A.", "ND", "-", "--"]);

const entrySchema = z.object({
  District: z.string().min(1),
  Date: z.string(),
  "Daily Actual": text,
  "Daily Normal": text.optional(),
  "Daily Departure Per": text.optional(),
  "Daily Category": text.optional(),
  "Week Date": text.optional(),
  "Weekly Actual": text.optional(),
  "Weekly Normal": text.optional(),
  "Weekly Departure Per": text.optional(),
  "Weekly Category": text.optional(),
  "Cumulative Date": text.optional(),
  "Cumulative Actual": text.optional(),
  "Cumulative Normal": text.optional(),
  "Cumulative Departure Per": text.optional(),
  "Cumulative Category": text.optional(),
});

/** Thrown inside the parser when a value is present but not understood. */
class Unreadable extends Error {}

/** "2026-10-04" or "04-10-2026" → "2026-10-04". */
export function imdDate(value: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : [];
  if (!y) return null;
  const date = `${y}-${m}-${d}`;
  return new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date ? date : null;
}

function amount(value: string | undefined): number | null {
  if (value === undefined || MISSING.has(value)) return null;
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Unreadable(value);
  return Number(value);
}

function percent(value: string | undefined): number | null {
  if (value === undefined || MISSING.has(value)) return null;
  const m = /^([+-]?\d+(\.\d+)?)\s*%?$/.exec(value);
  if (!m) throw new Unreadable(value);
  const n = Number(m[1]);
  if (n < -100) throw new Unreadable(value);
  return n;
}

function category(value: string | undefined): ImdRainCategory | null {
  if (value === undefined || MISSING.has(value)) return null;
  const upper = value.toUpperCase();
  if (!(IMD_RAIN_CATEGORIES as readonly string[]).includes(upper)) throw new Unreadable(value);
  return upper as ImdRainCategory;
}

/** "19-01-2023 To 25-01-2023" → its two dates. */
function range(value: string | undefined): { from: string | null; to: string | null } {
  if (value === undefined || MISSING.has(value)) return { from: null, to: null };
  const parts = value.split(/\s+to\s+/i).map((p) => imdDate(p.trim()));
  if (parts.length !== 2 || !parts[0] || !parts[1] || parts[0] > parts[1]) throw new Unreadable(value);
  return { from: parts[0], to: parts[1] };
}

function period(fields: { actual?: string; normal?: string; departure?: string; category?: string }, dates: { from: string | null; to: string | null }): ImdRainPeriod | null {
  const actualMm = amount(fields.actual);
  if (actualMm === null) return null;
  const p: ImdRainPeriod = { ...dates, actualMm, normalMm: amount(fields.normal), departurePct: percent(fields.departure), category: category(fields.category) };
  // No rain must be category NR (or none given): anything else means the fields were misread.
  if (p.category === "NR" && actualMm > 0) throw new Unreadable("NR with rain");
  return p;
}

/**
 * The district's measured rainfall from IMD's district rainfall list, or null when the district is
 * missing or ambiguous, the report is too old, or anything is not in the expected format.
 */
export function normalizeImdRainfall(json: unknown, place: { district: string; state: string }, today: string): ImdRainfall | null {
  const found = findDistrictEntry(json, place);
  if (found === null) return null;
  const parsed = entrySchema.safeParse(found);
  if (!parsed.success) return null;
  const e = parsed.data;
  const date = imdDate(e.Date);
  if (!date || date > today || addDays(date, IMD_RAIN_MAX_AGE_DAYS) < today) return null;
  try {
    const result: ImdRainfall = {
      source: "IMD",
      district: displayName(e.District),
      date,
      day: period(
        { actual: e["Daily Actual"], normal: e["Daily Normal"], departure: e["Daily Departure Per"], category: e["Daily Category"] },
        { from: date, to: date },
      ),
      week: period(
        { actual: e["Weekly Actual"], normal: e["Weekly Normal"], departure: e["Weekly Departure Per"], category: e["Weekly Category"] },
        range(e["Week Date"]),
      ),
      season: period(
        { actual: e["Cumulative Actual"], normal: e["Cumulative Normal"], departure: e["Cumulative Departure Per"], category: e["Cumulative Category"] },
        { from: e["Cumulative Date"] ? imdDate(e["Cumulative Date"]) : null, to: date },
      ),
    };
    if (result.season && e["Cumulative Date"] && !MISSING.has(e["Cumulative Date"]) && !result.season.from) return null;
    if (!result.day && !result.week && !result.season) return null;
    return result;
  } catch (error) {
    if (error instanceof Unreadable) return null;
    throw error;
  }
}
