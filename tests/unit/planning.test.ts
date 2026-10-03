import { describe, expect, it } from "vitest";

import { cropHistory, planCandidates, range, type PastSeason } from "@/features/planning/engine";
import { formatRange, rupees } from "@/features/planning/format";
import { supportCounts } from "@/features/planning/support";
import type { CropTotals } from "@/features/season-review/repository";
import { getMessages } from "@/lib/i18n";

const t = getMessages("en");
const PLOT = "plot-1";
const OTHER_PLOT = "plot-2";

function totals(fields: Partial<CropTotals>): CropTotals {
  return { crop_cycle_id: "x", work_costs: 0, expense_total: 0, harvested_kg: 0, sold_kg: 0, revenue: 0, selling_costs: 0, unpaid_sales: 0, ...fields };
}

function past(crop_id: string, fields: Partial<PastSeason> = {}, money: Partial<CropTotals> = {}): PastSeason {
  return { crop_id, season: "rabi", plot_id: PLOT, acres: 2, sowingDate: "2025-11-10", harvestDate: "2026-03-30", totals: totals(money), ...fields };
}

describe("range", () => {
  it("gives min, max and average, or nothing for no values", () => {
    expect(range([10, 20, 30])).toEqual({ min: 10, max: 30, average: 20, count: 3 });
    expect(range([])).toBeNull();
  });
});

describe("cropHistory", () => {
  it("works out the farmer's own results per acre", () => {
    const h = cropHistory(
      [
        // 2 acres: spent 20,000, sold 50,000, selling costs 2,000 → net 28,000 → 14,000/acre.
        past("wheat", {}, { expense_total: 20000, revenue: 50000, selling_costs: 2000, harvested_kg: 4000 }),
        // 1 acre on another plot: net 6,000/acre.
        past("wheat", { plot_id: OTHER_PLOT, acres: 1, sowingDate: "2024-11-01", harvestDate: "2025-03-01" }, { work_costs: 9000, revenue: 15000, harvested_kg: 1500 }),
      ],
      PLOT,
    );
    expect(h.seasons).toBe(2);
    expect(h.onThisPlot).toBe(1);
    expect(h.netPerAcre).toEqual({ min: 6000, max: 14000, average: 10000, count: 2 });
    expect(h.costPerAcre).toEqual({ min: 9000, max: 10000, average: 9500, count: 2 });
    expect(h.harvestKgPerAcre).toEqual({ min: 1500, max: 2000, average: 1750, count: 2 });
    expect(h.daysInField).toEqual({ min: 120, max: 140, average: 130, count: 2 });
  });

  it("does not count seasons per acre when the plot size is unknown, and keeps losses negative", () => {
    const h = cropHistory([past("maize", { acres: null }, { revenue: 1000 }), past("maize", {}, { expense_total: 10000, revenue: 6000 })], PLOT);
    expect(h.seasons).toBe(2);
    expect(h.netPerAcre).toEqual({ min: -2000, max: -2000, average: -2000, count: 1 });
  });
});

describe("planCandidates", () => {
  const base = {
    season: "rabi",
    plotId: PLOT,
    cropIds: ["wheat", "mustard", "lentil", "maize"],
    lastCropOnPlot: "mustard",
    openDemand: new Map([["lentil", 2]]),
    schemes: new Map([["wheat", 1]]),
    insurance: new Map<string, number>(),
  };

  it("puts crops with closed seasons in this season first, best own result per acre first", () => {
    const plan = planCandidates({
      ...base,
      pastSeasons: [
        past("wheat", {}, { revenue: 20000 }),
        past("mustard", {}, { revenue: 40000 }),
        past("maize", { season: "kharif" }, { revenue: 90000 }),
      ],
    });
    expect(plan.withHistory.map((c) => c.crop_id)).toEqual(["mustard", "wheat"]);
    expect(plan.others.map((c) => c.crop_id)).toEqual(["lentil", "maize"]);
  });

  it("carries what is in the app today: last crop here, buyers, schemes and insurance", () => {
    const plan = planCandidates({ ...base, pastSeasons: [] });
    const byId = Object.fromEntries(plan.others.map((c) => [c.crop_id, c]));
    expect(byId.mustard.grownHereLast).toBe(true);
    expect(byId.lentil.openDemand).toBe(2);
    expect(byId.wheat.schemes).toBe(1);
    expect(byId.maize).toMatchObject({ grownHereLast: false, openDemand: 0, schemes: 0, insurance: 0 });
  });
});

describe("supportCounts", () => {
  const farmer = { state: "Bihar", district: "Vaishali" };
  const scheme = (fields: object) => ({ state: "Bihar", districts: [], seasons: [], cropIds: [], application_deadline: null, ...fields });
  const product = (fields: object) => ({ state: "Bihar", districts: [], seasons: [], cropIds: ["wheat"], enrollment_deadline: null, ...fields });

  it("counts crop-specific schemes and open insurance for the season and place", () => {
    const { schemes, insurance } = supportCounts(
      ["wheat", "maize"],
      "rabi",
      farmer,
      [scheme({}), scheme({ cropIds: ["wheat"] }), scheme({ cropIds: ["wheat"], seasons: ["kharif"] }), scheme({ cropIds: ["maize"], state: "Odisha" })],
      [product({}), product({ enrollment_deadline: "2026-01-01" }), product({ cropIds: ["maize"], seasons: ["kharif"] })],
      "2026-10-03",
    );
    expect(Object.fromEntries(schemes)).toEqual({ wheat: 1 });
    expect(Object.fromEntries(insurance)).toEqual({ wheat: 1 });
  });
});

describe("formatRange", () => {
  it("shows one value, or a range with the average", () => {
    const money = rupees("en");
    expect(formatRange({ min: 5000, max: 5000, average: 5000, count: 1 }, money, t)).toBe("₹5,000");
    expect(formatRange({ min: -2000, max: 14000, average: 6000, count: 2 }, money, t)).toBe("-₹2,000 to ₹14,000 (average ₹6,000)");
  });
});
