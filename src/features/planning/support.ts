import { matchInsurance, type InsuranceScope } from "@/features/insurance/rules";
import { matchScheme, mayBeRelevant, type SchemeScope } from "@/features/schemes/rules";
import type { FarmerPlace } from "@/features/shared/official-data";

/**
 * Per crop, how many crop-specific schemes may be relevant and how much crop insurance
 * information is open for enrolment, for this season and the farmer's place. Schemes for any
 * crop are left out: they are the same whatever the farmer grows.
 */
export function supportCounts(
  cropIds: string[],
  season: string,
  farmer: FarmerPlace,
  schemes: SchemeScope[],
  insurance: InsuranceScope[],
  today: string,
): { schemes: Map<string, number>; insurance: Map<string, number> } {
  const schemeCounts = new Map<string, number>();
  const insuranceCounts = new Map<string, number>();
  for (const crop_id of cropIds) {
    const crop = { crop_id, season };
    const s = schemes.filter((scheme) => scheme.cropIds.includes(crop_id) && mayBeRelevant(matchScheme(scheme, farmer, [crop], today))).length;
    const i = insurance.filter((product) => {
      const m = matchInsurance(product, farmer, crop, today);
      return m.applies && !m.enrollmentClosed;
    }).length;
    if (s) schemeCounts.set(crop_id, s);
    if (i) insuranceCounts.set(crop_id, i);
  }
  return { schemes: schemeCounts, insurance: insuranceCounts };
}
