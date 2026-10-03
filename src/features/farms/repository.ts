import type { Farmer } from "@/features/farmer/repository";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

import type { FarmInput } from "./schema";

// Data access for `farms`. Row Level Security limits every query to the signed-in farmer's farms,
// so a farm id belonging to someone else simply returns nothing.

const FARM_COLUMNS =
  "id, name, state, district, village, total_area, area_unit, irrigation_available, irrigation_type, soil_type, created_at";

export async function listFarms(supabase: ServerSupabaseClient) {
  const { data, error } = await supabase
    .from("farms")
    .select(`${FARM_COLUMNS}, plots(count)`)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(({ plots, ...farm }) => ({ ...farm, plotCount: plots[0]?.count ?? 0 }));
}

export async function getFarm(supabase: ServerSupabaseClient, farmId: string) {
  const { data, error } = await supabase.from("farms").select(FARM_COLUMNS).eq("id", farmId).maybeSingle();
  if (error) throw error;
  return data;
}

export type Farm = NonNullable<Awaited<ReturnType<typeof getFarm>>>;

/** Creates a farm for the signed-in farmer. State and district come from their profile. */
export async function insertFarm(supabase: ServerSupabaseClient, input: FarmInput, farmer: Farmer) {
  const { data, error } = await supabase
    .from("farms")
    .insert({
      // farmer_id defaults to the signed-in farmer in the database.
      name: input.name,
      state: farmer.state,
      district: farmer.district,
      village: input.village ?? farmer.village,
      total_area: input.total_area ?? null,
      area_unit: input.area_unit ?? null,
      irrigation_available: input.irrigation_available ?? null,
      irrigation_type: input.irrigation_type ?? null,
      soil_type: input.soil_type ?? null,
    })
    .select("id")
    .single();
  return { id: data?.id, error };
}
