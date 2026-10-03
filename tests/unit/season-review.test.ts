import { describe, expect, it } from "vitest";

import type { CropTotals } from "@/features/season-review/repository";
import { daysInField, displayWeight, plotAcres, seasonSummary } from "@/features/season-review/summary";

const TOTALS: CropTotals = {
  crop_cycle_id: "c",
  work_costs: 1200,
  expense_total: 5000,
  harvested_kg: 1200,
  sold_kg: 1000,
  revenue: 23000,
  selling_costs: 500,
  unpaid_sales: 1,
};

describe("seasonSummary", () => {
  it("uses the same formula as the crop page: revenue − costs − selling costs", () => {
    expect(seasonSummary(TOTALS, 3)).toEqual({
      totalCost: 6200,
      workCosts: 1200,
      expenseTotal: 5000,
      harvestedKg: 1200,
      soldKg: 1000,
      unsoldKg: 200,
      revenue: 23000,
      sellingCosts: 500,
      net: 16300,
      unpaidSales: 1,
      harvestKgPerAcre: 400,
    });
  });

  it("shows a loss when costs are higher than sales", () => {
    expect(seasonSummary({ ...TOTALS, revenue: 0 }, null).net).toBe(-6700);
  });

  it("gives no per-acre figure without a harvest or a plot area", () => {
    expect(seasonSummary(TOTALS, null).harvestKgPerAcre).toBeNull();
    expect(seasonSummary({ ...TOTALS, harvested_kg: 0, sold_kg: 0 }, 2).harvestKgPerAcre).toBeNull();
  });

  it("never reports negative unsold produce", () => {
    expect(seasonSummary({ ...TOTALS, sold_kg: 1200.0004 }, null).unsoldKg).toBe(0);
  });
});

describe("plotAcres", () => {
  it("uses the area the farmer entered, in any unit", () => {
    expect(plotAcres({ area: 1.5, area_unit: "acre", boundary_area_sq_m: 5000 })).toBe(1.5);
    expect(plotAcres({ area: 50, area_unit: "decimal", boundary_area_sq_m: null })).toBeCloseTo(0.5, 10);
    expect(plotAcres({ area: 1, area_unit: "hectare", boundary_area_sq_m: null })).toBeCloseTo(2.471, 3);
  });

  it("falls back to the area measured from the map", () => {
    expect(plotAcres({ area: null, area_unit: null, boundary_area_sq_m: 4046.8564224 })).toBeCloseTo(1, 10);
  });

  it("is unknown when neither is set", () => {
    expect(plotAcres({ area: null, area_unit: null, boundary_area_sq_m: null })).toBeNull();
  });
});

describe("displayWeight and daysInField", () => {
  it("shows quintals from 100 kg", () => {
    expect(displayWeight(1250)).toEqual({ quantity: 12.5, unit: "quintal" });
    expect(displayWeight(99.5)).toEqual({ quantity: 99.5, unit: "kg" });
  });

  it("counts days from sowing to the end of the harvest", () => {
    expect(daysInField("2026-07-01", "2026-10-29")).toBe(120);
    expect(daysInField(null, "2026-10-29")).toBeNull();
  });
});
