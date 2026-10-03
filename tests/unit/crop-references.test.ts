import { describe, expect, it } from "vitest";

import { planCandidates, type PastSeason } from "@/features/planning/engine";
import { pickReference, referenceEstimate, type CropReference } from "@/features/planning/reference";

const farmer = { state: "Bihar", district: "Vaishali" };

function ref(fields: Partial<CropReference> = {}): CropReference {
  return {
    id: "r",
    crop_id: "wheat",
    season: "rabi",
    state: "Bihar",
    districts: [],
    duration_days_min: 110,
    duration_days_max: 130,
    water_need: "MEDIUM",
    labour_days_per_acre_min: 20,
    labour_days_per_acre_max: 30,
    cost_per_acre_min: 15000,
    cost_per_acre_max: 20000,
    yield_kg_per_acre_min: 1200,
    yield_kg_per_acre_max: 1600,
    price_per_quintal_min: 2000,
    price_per_quintal_max: 2400,
    source_name: "Test source",
    source_url: "https://example.gov.in",
    last_verified_at: "2026-09-01",
    text: null,
    ...fields,
  };
}

describe("pickReference", () => {
  it("prefers the farmer's district, then state, then all of India", () => {
    const india = ref({ id: "india", state: null });
    const state = ref({ id: "state" });
    const district = ref({ id: "district", districts: ["vaishali"] });
    expect(pickReference([india, state, district], farmer)?.id).toBe("district");
    expect(pickReference([india, state], farmer)?.id).toBe("state");
    expect(pickReference([india], farmer)?.id).toBe("india");
  });

  it("ignores other areas and picks the most recently checked on a tie", () => {
    expect(pickReference([ref({ state: "Odisha" }), ref({ districts: ["Patna"] })], farmer)).toBeNull();
    const older = ref({ id: "older", last_verified_at: "2026-01-01" });
    const newer = ref({ id: "newer", last_verified_at: "2026-08-01" });
    expect(pickReference([older, newer], farmer)?.id).toBe("newer");
  });
});

describe("referenceEstimate", () => {
  it("works out possible sales and result per acre from harvest, price and cost ranges", () => {
    const e = referenceEstimate(ref());
    // Sales: 12 q × 2,000 = 24,000 to 16 q × 2,400 = 38,400.
    expect(e.revenuePerAcre).toMatchObject({ min: 24000, max: 38400 });
    // Result: worst 24,000 − 20,000 = 4,000; best 38,400 − 15,000 = 23,400.
    expect(e.marginPerAcre).toMatchObject({ min: 4000, max: 23400 });
    expect(e.durationDays).toMatchObject({ min: 110, max: 130 });
    expect(e).toMatchObject({ waterNeed: "MEDIUM", sourceName: "Test source", lastVerifiedAt: "2026-09-01" });
  });

  it("leaves out what the source does not give, and can show a possible loss", () => {
    const noPrice = referenceEstimate(ref({ price_per_quintal_min: null, price_per_quintal_max: null }));
    expect(noPrice.revenuePerAcre).toBeNull();
    expect(noPrice.marginPerAcre).toBeNull();
    expect(noPrice.costPerAcre).toMatchObject({ min: 15000, max: 20000 });
    const loss = referenceEstimate(ref({ yield_kg_per_acre_min: 500, price_per_quintal_min: 1500 }));
    expect(loss.marginPerAcre!.min).toBe(500 * 15 - 20000);
  });
});

describe("planCandidates with references", () => {
  const base = {
    season: "rabi",
    plotId: "plot",
    cropIds: ["maize", "wheat", "mustard"],
    lastCropOnPlot: null,
    openDemand: new Map(),
    schemes: new Map(),
    insurance: new Map(),
  };
  const past = (crop_id: string, revenue: number): PastSeason => ({
    crop_id,
    season: "rabi",
    plot_id: "plot",
    acres: 1,
    sowingDate: null,
    harvestDate: null,
    totals: { crop_cycle_id: "c", work_costs: 0, expense_total: 0, harvested_kg: 0, sold_kg: 0, revenue, selling_costs: 0, unpaid_sales: 0 },
  });

  it("lists crops usually grown in the season first among the others, but never reorders the farmer's own results", () => {
    const references = new Map([
      ["mustard", referenceEstimate(ref({ crop_id: "mustard" }))],
      ["wheat", referenceEstimate(ref({ yield_kg_per_acre_max: 99999 }))],
    ]);
    const plan = planCandidates({ ...base, pastSeasons: [past("wheat", 1000), past("maize", 5000)], references });
    expect(plan.withHistory.map((c) => c.crop_id)).toEqual(["maize", "wheat"]);
    expect(plan.others.map((c) => c.crop_id)).toEqual(["mustard"]);
    expect(plan.others[0].reference?.sourceName).toBe("Test source");
    const none = planCandidates({ ...base, pastSeasons: [], references });
    expect(none.others.map((c) => c.crop_id)).toEqual(["wheat", "mustard", "maize"]);
  });
});
