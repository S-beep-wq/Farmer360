// Matching official scheme information to a farmer (USER_WORKFLOWS.md section 10). This only says
// a scheme MAY be relevant; it never decides eligibility (PRODUCT_SPEC.md section 12).

/** Scheme information checked longer ago than this is flagged as possibly out of date. */
export const STALE_AFTER_DAYS = 180;

export type SchemeScope = {
  state: string | null;
  districts: string[];
  seasons: string[];
  cropIds: string[];
  application_deadline: string | null;
};

export type FarmerPlace = { state: string; district: string };
export type CurrentCrop = { crop_id: string; season: string };

export type SchemeMatch = {
  /** "india": applies everywhere; "state": the farmer's whole state; "district": their district. */
  area: "india" | "state" | "district" | null;
  /** The farmer's crops (with season) that the scheme is for; empty when it is for any crop. */
  crops: CurrentCrop[];
  /** True when the scheme is for particular crops or seasons and none of the farmer's match. */
  cropMismatch: boolean;
  deadlinePassed: boolean;
};

const same = (a: string, b: string) => a.trim().toLocaleLowerCase("en-IN") === b.trim().toLocaleLowerCase("en-IN");

export function schemeArea(scheme: Pick<SchemeScope, "state" | "districts">, farmer: FarmerPlace): SchemeMatch["area"] {
  if (scheme.state === null) return "india";
  if (!same(scheme.state, farmer.state)) return null;
  if (scheme.districts.length === 0) return "state";
  return scheme.districts.some((d) => same(d, farmer.district)) ? "district" : null;
}

export function matchScheme(scheme: SchemeScope, farmer: FarmerPlace, crops: CurrentCrop[], today: string): SchemeMatch {
  const area = schemeArea(scheme, farmer);
  const forAnyCrop = scheme.cropIds.length === 0 && scheme.seasons.length === 0;
  const matching = forAnyCrop
    ? []
    : crops.filter(
        (c) => (scheme.cropIds.length === 0 || scheme.cropIds.includes(c.crop_id)) && (scheme.seasons.length === 0 || scheme.seasons.includes(c.season)),
      );
  return {
    area,
    crops: matching,
    cropMismatch: !forAnyCrop && matching.length === 0,
    deadlinePassed: scheme.application_deadline !== null && scheme.application_deadline < today,
  };
}

/** May be relevant: for the farmer's area, for one of their crops (or any crop), and still open. */
export function mayBeRelevant(match: SchemeMatch): boolean {
  return match.area !== null && !match.cropMismatch && !match.deadlinePassed;
}

/** Days between two ISO dates (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function isStale(lastVerifiedAt: string, today: string): boolean {
  return daysBetween(lastVerifiedAt, today) > STALE_AFTER_DAYS;
}

/** Soonest deadline first; schemes without a deadline after those with one. */
export function byDeadline(a: { application_deadline: string | null }, b: { application_deadline: string | null }): number {
  if (a.application_deadline === b.application_deadline) return 0;
  if (a.application_deadline === null) return 1;
  if (b.application_deadline === null) return -1;
  return a.application_deadline < b.application_deadline ? -1 : 1;
}
