import { fromSquareMetres, SQ_M_PER_UNIT, type AreaUnit } from "@/features/shared/land";
import { sumRupees } from "@/features/shared/money";

import type { CropTotals } from "./repository";

/**
 * A crop season in numbers (USER_WORKFLOWS.md section 16), from recorded data only:
 * total cost, harvest, revenue, selling costs and the net result. Same formula as the crop page:
 *   revenue − (work costs + expenses) − selling costs = net result.
 */
export function seasonSummary(totals: CropTotals, plotAcres: number | null) {
  const totalCost = sumRupees([totals.work_costs, totals.expense_total]);
  const net = sumRupees([totals.revenue, -totalCost, -totals.selling_costs]);
  const unsoldKg = Math.max(0, Math.round((totals.harvested_kg - totals.sold_kg) * 1000) / 1000);
  return {
    totalCost,
    workCosts: totals.work_costs,
    expenseTotal: totals.expense_total,
    harvestedKg: totals.harvested_kg,
    soldKg: totals.sold_kg,
    unsoldKg,
    revenue: totals.revenue,
    sellingCosts: totals.selling_costs,
    net,
    unpaidSales: totals.unpaid_sales,
    /** Harvest per acre, only when both a harvest and the plot's area are known. */
    harvestKgPerAcre: plotAcres && totals.harvested_kg > 0 ? Math.round((totals.harvested_kg / plotAcres) * 10) / 10 : null,
  };
}

export type SeasonSummary = ReturnType<typeof seasonSummary>;

/**
 * The plot's size in acres: the area the farmer entered, or else the area measured from the map
 * boundary. Null when neither is known.
 */
export function plotAcres(plot: { area: number | null; area_unit: string | null; boundary_area_sq_m: number | null }): number | null {
  if (plot.area !== null && plot.area_unit !== null && plot.area_unit in SQ_M_PER_UNIT) {
    return fromSquareMetres(plot.area * SQ_M_PER_UNIT[plot.area_unit as AreaUnit], "acre");
  }
  if (plot.boundary_area_sq_m !== null && plot.boundary_area_sq_m > 0) {
    return fromSquareMetres(plot.boundary_area_sq_m, "acre");
  }
  return null;
}

/** Shows produce weight in quintals from 100 kg up, otherwise in kg. */
export function displayWeight(kg: number): { quantity: number; unit: "kg" | "quintal" } {
  return kg >= 100 ? { quantity: Math.round((kg / 100) * 100) / 100, unit: "quintal" } : { quantity: Math.round(kg * 10) / 10, unit: "kg" };
}

/** Days from sowing to the end of the harvest, inclusive of neither end's time of day. */
export function daysInField(sowingDate: string | null, harvestDate: string | null): number | null {
  if (!sowingDate || !harvestDate) return null;
  const ms = Date.parse(`${harvestDate}T00:00:00Z`) - Date.parse(`${sowingDate}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : null;
}
