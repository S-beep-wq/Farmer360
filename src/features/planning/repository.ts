import { plotAcres } from "@/features/season-review/summary";
import { listCropTotals } from "@/features/season-review/repository";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

import type { PastSeason } from "./engine";

// Data for crop planning, all under the farmer's session (RLS): their closed seasons with totals,
// and how many buyers are looking for each crop right now.

type ClosedCycle = {
  id: string;
  crop_id: string;
  season: string;
  plot_id: string;
  actual_sowing_date: string | null;
  actual_harvest_date: string | null;
  plot: { area: number | null; area_unit: string | null; boundary_area_sq_m: number | null };
};

/** The farmer's closed (COMPLETED) seasons on all their plots, with their totals. */
export async function listPastSeasons(supabase: ServerSupabaseClient): Promise<PastSeason[]> {
  const { data, error } = await supabase
    .from("crop_cycles")
    .select("id, crop_id, season, plot_id, actual_sowing_date, actual_harvest_date, plot:plots(area, area_unit, boundary_area_sq_m)")
    .eq("status", "COMPLETED")
    .overrideTypes<ClosedCycle[], { merge: false }>();
  if (error) throw error;
  const totals = await listCropTotals(supabase, data.map((c) => c.id));
  return data
    .filter((c) => totals.has(c.id))
    .map((c) => ({
      crop_id: c.crop_id,
      season: c.season,
      plot_id: c.plot_id,
      acres: plotAcres(c.plot),
      sowingDate: c.actual_sowing_date,
      harvestDate: c.actual_harvest_date,
      totals: totals.get(c.id)!,
    }));
}

/** Open buyer demand (published, date not passed) per crop. */
export async function countOpenDemand(supabase: ServerSupabaseClient, today: string): Promise<Map<string, number>> {
  const { data, error } = await supabase.from("buyer_demands").select("crop_id").eq("demand_status", "ACTIVE").gte("required_date", today);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const { crop_id } of data) counts.set(crop_id, (counts.get(crop_id) ?? 0) + 1);
  return counts;
}

/** The crop last sown on this plot (most recent sowing or plan), or null. */
export async function lastCropOnPlot(supabase: ServerSupabaseClient, plotId: string): Promise<{ crop_id: string; season: string } | null> {
  const { data, error } = await supabase
    .from("crop_cycles")
    .select("crop_id, season, actual_sowing_date, created_at")
    .eq("plot_id", plotId)
    .in("status", ["ACTIVE", "HARVESTED", "COMPLETED"])
    .order("actual_sowing_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data[0] ? { crop_id: data[0].crop_id, season: data[0].season } : null;
}
