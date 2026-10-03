import { areaFor, type FarmerPlace } from "@/features/shared/official-data";

// Which crop insurance information applies to one of the farmer's crops (USER_WORKFLOWS.md
// section 11). It says what MAY apply; it never decides eligibility or promises a claim
// (PRODUCT_SPEC.md section 13).

export { isStale } from "@/features/shared/official-data";

export type InsuranceScope = {
  state: string | null;
  districts: string[];
  seasons: string[];
  cropIds: string[];
  enrollment_deadline: string | null;
};

export type InsuranceMatch = {
  area: "india" | "state" | "district" | null;
  /** Covers this crop in this season, in the farmer's area. */
  applies: boolean;
  enrollmentClosed: boolean;
};

export function matchInsurance(product: InsuranceScope, farmer: FarmerPlace, crop: { crop_id: string; season: string }, today: string): InsuranceMatch {
  const area = areaFor(product, farmer);
  const forCrop = product.cropIds.includes(crop.crop_id);
  const forSeason = product.seasons.length === 0 || product.seasons.includes(crop.season);
  return {
    area,
    applies: area !== null && forCrop && forSeason,
    enrollmentClosed: product.enrollment_deadline !== null && product.enrollment_deadline < today,
  };
}
