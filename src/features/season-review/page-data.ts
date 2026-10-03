import "server-only";

import { redirect } from "next/navigation";

import { listActivities } from "@/features/crop-records/repository";
import { loadCropPage } from "@/features/crops/page-data";
import { formatArea, formatMeasuredArea } from "@/features/plots/format";
import { createClient } from "@/lib/supabase/server";

import { getCropTotals } from "./repository";
import { plotAcres, seasonSummary } from "./summary";

type CropParams = { farmId: string; plotId: string; cycleId: string };

/** The season review page: for a harvested crop (to close it) or a completed one (to look back). */
export async function loadSeasonPage(params: Promise<CropParams>) {
  const page = await loadCropPage(params);
  const { cycle, plot, t, locale } = page;
  if (cycle.status !== "HARVESTED" && cycle.status !== "COMPLETED") redirect(page.cropHref);

  const supabase = await createClient();
  const [totals, activities] = await Promise.all([getCropTotals(supabase, cycle.id), listActivities(supabase, cycle.id)]);
  if (!totals) redirect(page.cropHref);

  const acres = plotAcres(plot);
  const plotAreaText =
    formatArea(plot.area, plot.area_unit, t, locale) ??
    (plot.boundary_area_sq_m !== null ? formatMeasuredArea(plot.boundary_area_sq_m, t, locale) : null);

  return {
    ...page,
    summary: seasonSummary(totals, acres),
    plotAreaText: acres ? plotAreaText : null,
    activityTypes: activities.map((a) => a.activity_type),
  };
}
