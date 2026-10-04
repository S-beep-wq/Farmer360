import "server-only";

import { todayInIndia } from "@/features/crops/dates";

import { normalizeImdWarnings, type ImdWarnings } from "./imd";

// IMD district warnings (see imd.ts and docs/WEATHER.md). Off unless IMD_API_URL is set to the
// full URL of IMD's district warning list, which IMD only serves to registered, whitelisted
// servers. Cached for an hour: IMD updates warnings a few times a day.

export function isImdEnabled(): boolean {
  return Boolean(process.env.IMD_API_URL);
}

/** The district's current IMD warnings, or null when IMD is off, unreachable, or the data is not usable. */
export async function fetchImdWarnings(place: { district: string; state: string }): Promise<ImdWarnings | null> {
  const url = process.env.IMD_API_URL;
  if (!url) return null;
  try {
    const response = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      console.error("imd: provider error", { status: response.status });
      return null;
    }
    const warnings = normalizeImdWarnings(await response.json(), place, todayInIndia());
    if (!warnings) console.warn("imd: no usable warnings for the district", { district: place.district });
    return warnings;
  } catch (error) {
    console.error("imd: request failed", { message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
