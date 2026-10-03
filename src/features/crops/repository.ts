import type { ServerSupabaseClient } from "@/lib/supabase/server";

import { OPEN_STATUSES } from "./constants";
import type { CropCycleInput } from "./schema";

// Data access for the crop catalog and crop cycles. Row Level Security limits crop cycles to
// plots on the signed-in farmer's farms; the catalog is shared, read-only reference data.

export async function listCrops(supabase: ServerSupabaseClient) {
  const { data, error } = await supabase.from("crop_catalog").select("id, name, name_hi, category").order("name");
  if (error) throw error;
  return data;
}

export type Crop = Awaited<ReturnType<typeof listCrops>>[number];

const CYCLE_COLUMNS =
  "id, plot_id, season, status, variety_name, planned_sowing_date, actual_sowing_date, expected_harvest_date, " +
  "actual_harvest_date, current_growth_stage, created_at, crop:crop_catalog(id, name, name_hi)";

type CropCycleRow = {
  id: string;
  plot_id: string;
  season: string;
  status: string;
  variety_name: string | null;
  planned_sowing_date: string | null;
  actual_sowing_date: string | null;
  expected_harvest_date: string | null;
  actual_harvest_date: string | null;
  current_growth_stage: string | null;
  created_at: string;
  crop: { id: string; name: string; name_hi: string };
};

export type CropCycle = CropCycleRow;

/** A plot's crop cycles, newest sowing first. Old cycles are kept as the plot's history. */
export async function listCropCycles(supabase: ServerSupabaseClient, plotId: string): Promise<CropCycle[]> {
  const { data, error } = await supabase
    .from("crop_cycles")
    .select(CYCLE_COLUMNS)
    .eq("plot_id", plotId)
    .order("created_at", { ascending: false })
    .overrideTypes<CropCycleRow[], { merge: false }>();
  if (error) throw error;
  return data;
}

export async function getCropCycle(supabase: ServerSupabaseClient, plotId: string, cycleId: string): Promise<CropCycle | null> {
  const { data, error } = await supabase
    .from("crop_cycles")
    .select(CYCLE_COLUMNS)
    .eq("plot_id", plotId)
    .eq("id", cycleId)
    .maybeSingle()
    .overrideTypes<CropCycleRow, { merge: false }>();
  if (error) throw error;
  return data;
}

/** Planned and growing crops on a farm, by plot id, for the farm page. */
export async function listOpenCropsByPlot(supabase: ServerSupabaseClient, farmId: string) {
  const { data, error } = await supabase
    .from("crop_cycles")
    .select("plot_id, status, crop:crop_catalog(name, name_hi), plot:plots!inner(farm_id)")
    .eq("plot.farm_id", farmId)
    .in("status", [...OPEN_STATUSES])
    .order("created_at", { ascending: true })
    .overrideTypes<{ plot_id: string; status: string; crop: { name: string; name_hi: string } }[], { merge: false }>();
  if (error) throw error;

  const byPlot = new Map<string, { status: string; crop: { name: string; name_hi: string } }[]>();
  for (const { plot_id, status, crop } of data) {
    byPlot.set(plot_id, [...(byPlot.get(plot_id) ?? []), { status, crop }]);
  }
  return byPlot;
}

export async function insertCropCycle(supabase: ServerSupabaseClient, plotId: string, input: CropCycleInput) {
  const { data, error } = await supabase
    .from("crop_cycles")
    .insert({
      plot_id: plotId,
      crop_id: input.crop_id,
      variety_name: input.variety_name ?? null,
      season: input.season,
      status: input.status,
      planned_sowing_date: input.planned_sowing_date ?? null,
      actual_sowing_date: input.actual_sowing_date ?? null,
      expected_harvest_date: input.expected_harvest_date ?? null,
    })
    .select("id")
    .single();
  return { id: data?.id, error };
}

type CropCyclePatch = {
  status?: "ACTIVE" | "HARVESTED" | "CANCELLED";
  crop_id?: string;
  variety_name?: string | null;
  season?: string;
  planned_sowing_date?: string | null;
  actual_sowing_date?: string | null;
  expected_harvest_date?: string | null;
  actual_harvest_date?: string | null;
};

/**
 * Updates a crop cycle only if it still has `fromStatus`, so two changes made at the same time
 * (for example in two browser tabs) cannot both apply. `updated` is false when nothing matched.
 */
export async function updateCropCycle(
  supabase: ServerSupabaseClient,
  plotId: string,
  cycleId: string,
  fromStatus: string,
  patch: CropCyclePatch,
) {
  const { data, error } = await supabase
    .from("crop_cycles")
    .update(patch)
    .eq("plot_id", plotId)
    .eq("id", cycleId)
    .eq("status", fromStatus)
    .select("id");
  return { updated: Boolean(data?.length), error };
}
