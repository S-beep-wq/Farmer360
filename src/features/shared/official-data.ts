// Rules shared by official external information (government schemes, crop insurance), which the
// Kisan 360 team loads from official sources (SYSTEM_ARCHITECTURE.md section 12).

/** Information checked longer ago than this is flagged as possibly out of date. */
export const STALE_AFTER_DAYS = 180;

export type FarmerPlace = { state: string; district: string };

/** Where information applies: null state is all of India; no districts is the whole state. */
export type OfficialArea = { state: string | null; districts: string[] };

const same = (a: string, b: string) => a.trim().toLocaleLowerCase("en-IN") === b.trim().toLocaleLowerCase("en-IN");

/** "india", "state" or "district" when the information applies to the farmer's place, else null. */
export function areaFor(info: OfficialArea, farmer: FarmerPlace): "india" | "state" | "district" | null {
  if (info.state === null) return "india";
  if (!same(info.state, farmer.state)) return null;
  if (info.districts.length === 0) return "state";
  return info.districts.some((d) => same(d, farmer.district)) ? "district" : null;
}

/** Days between two ISO dates (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function isStale(lastVerifiedAt: string, today: string): boolean {
  return daysBetween(lastVerifiedAt, today) > STALE_AFTER_DAYS;
}
