import type { ServerSupabaseClient } from "@/lib/supabase/server";

// Totals per crop cycle from the crop_cycle_totals view (security_invoker: RLS applies, so a
// farmer only gets totals for their own crops). Removed entries are excluded by the view.

export type CropTotals = {
  crop_cycle_id: string;
  work_costs: number;
  expense_total: number;
  harvested_kg: number;
  sold_kg: number;
  revenue: number;
  selling_costs: number;
  unpaid_sales: number;
};

const TOTALS_COLUMNS = "crop_cycle_id, work_costs, expense_total, harvested_kg, sold_kg, revenue, selling_costs, unpaid_sales";

export async function getCropTotals(supabase: ServerSupabaseClient, cropCycleId: string): Promise<CropTotals | null> {
  const { data, error } = await supabase
    .from("crop_cycle_totals")
    .select(TOTALS_COLUMNS)
    .eq("crop_cycle_id", cropCycleId)
    .maybeSingle()
    .overrideTypes<CropTotals, { merge: false }>();
  if (error) throw error;
  return data;
}

/** Totals for several crop cycles in one query, by crop cycle id. */
export async function listCropTotals(supabase: ServerSupabaseClient, cropCycleIds: string[]): Promise<Map<string, CropTotals>> {
  if (cropCycleIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("crop_cycle_totals")
    .select(TOTALS_COLUMNS)
    .in("crop_cycle_id", cropCycleIds)
    .overrideTypes<CropTotals[], { merge: false }>();
  if (error) throw error;
  return new Map(data.map((t) => [t.crop_cycle_id, t]));
}
