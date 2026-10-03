import type { ServerSupabaseClient } from "@/lib/supabase/server";

import { ringFromGeoJson, toEwktPolygon } from "./location/geo";
import type { PlotInput } from "./schema";

// Data access for `plots`. Row Level Security only returns plots on the signed-in farmer's farms.
// The boundary is written as EWKT and read back as GeoJSON through the `boundary_geojson` computed field.

const PLOT_COLUMNS =
  "id, farm_id, name, area, area_unit, latitude, longitude, location_source, location_accuracy_m, " +
  "boundary_area_sq_m, soil_type, irrigation_available, irrigation_type, notes, created_at, boundary_geojson";

type PlotRow = {
  id: string;
  farm_id: string;
  name: string;
  area: number | null;
  area_unit: string | null;
  latitude: number | null;
  longitude: number | null;
  location_source: string | null;
  location_accuracy_m: number | null;
  boundary_area_sq_m: number | null;
  soil_type: string | null;
  irrigation_available: boolean | null;
  irrigation_type: string | null;
  notes: string | null;
  created_at: string;
  boundary_geojson: unknown;
};

function toPlot({ boundary_geojson, ...row }: PlotRow) {
  return { ...row, boundary: ringFromGeoJson(boundary_geojson) };
}

export type Plot = ReturnType<typeof toPlot>;

export async function listPlots(supabase: ServerSupabaseClient, farmId: string): Promise<Plot[]> {
  const { data, error } = await supabase
    .from("plots")
    .select(PLOT_COLUMNS)
    .eq("farm_id", farmId)
    .order("created_at", { ascending: true })
    .overrideTypes<PlotRow[], { merge: false }>();
  if (error) throw error;
  return data.map(toPlot);
}

export async function getPlot(supabase: ServerSupabaseClient, farmId: string, plotId: string): Promise<Plot | null> {
  const { data, error } = await supabase
    .from("plots")
    .select(PLOT_COLUMNS)
    .eq("farm_id", farmId)
    .eq("id", plotId)
    .maybeSingle()
    .overrideTypes<PlotRow, { merge: false }>();
  if (error) throw error;
  return data ? toPlot(data) : null;
}

export async function insertPlot(supabase: ServerSupabaseClient, farmId: string, input: PlotInput) {
  const { data, error } = await supabase
    .from("plots")
    .insert({
      farm_id: farmId,
      name: input.name,
      area: input.area ?? null,
      area_unit: input.area_unit ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      location_source: input.location_source ?? null,
      location_accuracy_m: input.location_accuracy_m ?? null,
      boundary: input.boundary ? toEwktPolygon(input.boundary) : null,
      irrigation_available: input.irrigation_available ?? null,
      irrigation_type: input.irrigation_type ?? null,
      soil_type: input.soil_type ?? null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  return { id: data?.id, error };
}
