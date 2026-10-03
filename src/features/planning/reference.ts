import { areaFor, type FarmerPlace } from "@/features/shared/official-data";

import { range, type Range } from "./engine";

// Reference estimates for crop planning (USER_WORKFLOWS.md section 5): typical ranges from an
// agronomic or official source, kept apart from the farmer's own records (which are facts).

export type CropReference = {
  id: string;
  crop_id: string;
  season: string;
  state: string | null;
  districts: string[];
  duration_days_min: number | null;
  duration_days_max: number | null;
  water_need: string | null;
  labour_days_per_acre_min: number | null;
  labour_days_per_acre_max: number | null;
  cost_per_acre_min: number | null;
  cost_per_acre_max: number | null;
  yield_kg_per_acre_min: number | null;
  yield_kg_per_acre_max: number | null;
  price_per_quintal_min: number | null;
  price_per_quintal_max: number | null;
  source_name: string;
  source_url: string;
  last_verified_at: string;
  text: { input_needs: string | null; production_risks: string | null; market_notes: string | null } | null;
};

const SPECIFICITY = { district: 3, state: 2, india: 1 } as const;

/** The reference that fits the farmer's place best: their district, else state, else all of India; newest check wins a tie. */
export function pickReference(references: CropReference[], farmer: FarmerPlace): CropReference | null {
  let best: { ref: CropReference; score: number } | null = null;
  for (const ref of references) {
    const area = areaFor(ref, farmer);
    if (!area) continue;
    const score = SPECIFICITY[area];
    if (!best || score > best.score || (score === best.score && ref.last_verified_at > best.ref.last_verified_at)) best = { ref, score };
  }
  return best?.ref ?? null;
}

const pair = (min: number | null, max: number | null): Range | null => (min === null || max === null ? null : { ...range([min, max])!, count: 1 });

export type ReferenceEstimate = {
  durationDays: Range | null;
  waterNeed: string | null;
  labourDaysPerAcre: Range | null;
  costPerAcre: Range | null;
  yieldKgPerAcre: Range | null;
  pricePerQuintal: Range | null;
  /** Yield × price, low with low and high with high. */
  revenuePerAcre: Range | null;
  /** Revenue minus cost, from the worst case (low revenue, high cost) to the best. */
  marginPerAcre: Range | null;
  text: CropReference["text"];
  sourceName: string;
  sourceUrl: string;
  lastVerifiedAt: string;
};

const round = (n: number) => Math.round(n);

export function referenceEstimate(ref: CropReference): ReferenceEstimate {
  const cost = pair(ref.cost_per_acre_min, ref.cost_per_acre_max);
  const yieldKg = pair(ref.yield_kg_per_acre_min, ref.yield_kg_per_acre_max);
  const price = pair(ref.price_per_quintal_min, ref.price_per_quintal_max);
  const revenue = yieldKg && price ? pair(round((yieldKg.min / 100) * price.min), round((yieldKg.max / 100) * price.max)) : null;
  const margin = revenue && cost ? { min: round(revenue.min - cost.max), max: round(revenue.max - cost.min), average: round((revenue.min - cost.max + revenue.max - cost.min) / 2), count: 1 } : null;
  return {
    durationDays: pair(ref.duration_days_min, ref.duration_days_max),
    waterNeed: ref.water_need,
    labourDaysPerAcre: pair(ref.labour_days_per_acre_min, ref.labour_days_per_acre_max),
    costPerAcre: cost,
    yieldKgPerAcre: yieldKg,
    pricePerQuintal: price,
    revenuePerAcre: revenue,
    marginPerAcre: margin,
    text: ref.text,
    sourceName: ref.source_name,
    sourceUrl: ref.source_url,
    lastVerifiedAt: ref.last_verified_at,
  };
}
