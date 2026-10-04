import "server-only";

import { todayInIndia } from "@/features/crops/dates";

import { normalizeImdWarnings, type ImdWarnings } from "./imd";
import { normalizeImdRainfall, type ImdRainfall } from "./imd-rainfall";

// IMD district warnings (imd.ts) and district rainfall (imd-rainfall.ts); see docs/WEATHER.md.
// Each is off unless its URL is set (IMD_API_URL for warnings, IMD_RAINFALL_URL for rainfall) to
// the full URL of IMD's district list, which IMD only serves to registered, whitelisted servers.
// Cached for an hour: IMD updates warnings a few times a day and rainfall once a day.

async function fetchImdList(url: string, what: string): Promise<unknown> {
  try {
    const response = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      console.error(`imd ${what}: provider error`, { status: response.status });
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`imd ${what}: request failed`, { message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

export function isImdEnabled(): boolean {
  return Boolean(process.env.IMD_API_URL);
}

/** The district's current IMD warnings, or null when IMD is off, unreachable, or the data is not usable. */
export async function fetchImdWarnings(place: { district: string; state: string }): Promise<ImdWarnings | null> {
  const url = process.env.IMD_API_URL;
  if (!url) return null;
  const json = await fetchImdList(url, "warnings");
  if (json === null) return null;
  const warnings = normalizeImdWarnings(json, place, todayInIndia());
  if (!warnings) console.warn("imd warnings: no usable warnings for the district", { district: place.district });
  return warnings;
}

/** The district's latest IMD measured rainfall, or null when it is off, unreachable, too old or not usable. */
export async function fetchImdRainfall(place: { district: string; state: string }): Promise<ImdRainfall | null> {
  const url = process.env.IMD_RAINFALL_URL;
  if (!url) return null;
  const json = await fetchImdList(url, "rainfall");
  if (json === null) return null;
  const rainfall = normalizeImdRainfall(json, place, todayInIndia());
  if (!rainfall) console.warn("imd rainfall: no usable rainfall for the district", { district: place.district });
  return rainfall;
}
