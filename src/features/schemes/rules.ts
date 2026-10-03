import { areaFor, type FarmerPlace } from "@/features/shared/official-data";

// Matching official scheme information to a farmer (USER_WORKFLOWS.md section 10). This only says
// a scheme MAY be relevant; it never decides eligibility (PRODUCT_SPEC.md section 12).

export { isStale, STALE_AFTER_DAYS, type FarmerPlace } from "@/features/shared/official-data";

export type SchemeScope = {
  state: string | null;
  districts: string[];
  seasons: string[];
  cropIds: string[];
  application_deadline: string | null;
};

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

export function schemeArea(scheme: Pick<SchemeScope, "state" | "districts">, farmer: FarmerPlace): SchemeMatch["area"] {
  return areaFor(scheme, farmer);
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

/** Soonest deadline first; schemes without a deadline after those with one. */
export function byDeadline(a: { application_deadline: string | null }, b: { application_deadline: string | null }): number {
  if (a.application_deadline === b.application_deadline) return 0;
  if (a.application_deadline === null) return 1;
  if (b.application_deadline === null) return -1;
  return a.application_deadline < b.application_deadline ? -1 : 1;
}
