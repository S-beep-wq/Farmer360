import type { ServerSupabaseClient } from "@/lib/supabase/server";

import { PHOTO_BUCKET, type HealthStatus } from "./constants";
import type { PhotoType } from "./photo";
import type { ObservationInput } from "./schema";

// Data access for crop observations and their photos. RLS and the storage policies limit
// everything to the signed-in farmer's own crops. Photos are in a private bucket and are shown
// through short-lived signed links.

export type Observation = {
  id: string;
  crop_cycle_id: string;
  observation_date: string;
  health_status: HealthStatus;
  farmer_notes: string | null;
  created_at: string;
  photos: { id: string; storage_path: string; file_name: string }[];
};

const OBSERVATION_COLUMNS =
  "id, crop_cycle_id, observation_date, health_status, farmer_notes, created_at, photos:crop_photos(id, storage_path, file_name)";

/** A crop's observations in time order (oldest first), as a timeline. */
export async function listObservations(supabase: ServerSupabaseClient, cropCycleId: string): Promise<Observation[]> {
  const { data, error } = await supabase
    .from("crop_observations")
    .select(OBSERVATION_COLUMNS)
    .eq("crop_cycle_id", cropCycleId)
    .is("deleted_at", null)
    .order("observation_date", { ascending: true })
    .order("created_at", { ascending: true })
    .overrideTypes<Observation[], { merge: false }>();
  if (error) throw error;
  return data;
}

export async function getObservation(supabase: ServerSupabaseClient, cropCycleId: string, id: string): Promise<Observation | null> {
  const { data, error } = await supabase
    .from("crop_observations")
    .select(OBSERVATION_COLUMNS)
    .eq("crop_cycle_id", cropCycleId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
    .overrideTypes<Observation, { merge: false }>();
  if (error) throw error;
  return data;
}

export async function insertObservation(supabase: ServerSupabaseClient, cropCycleId: string, input: ObservationInput) {
  const { data, error } = await supabase
    .from("crop_observations")
    .insert({
      crop_cycle_id: cropCycleId,
      observation_date: input.observation_date,
      health_status: input.health_status,
      farmer_notes: input.farmer_notes ?? null,
    })
    .select("id")
    .single();
  return { id: data?.id, error };
}

/** Hides an observation made by mistake. It and its photo stay stored (DATABASE.md section 24). */
export async function removeObservation(supabase: ServerSupabaseClient, cropCycleId: string, id: string) {
  const { data, error } = await supabase
    .from("crop_observations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("crop_cycle_id", cropCycleId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  return { updated: Boolean(data?.length), error };
}

/** Uploads a photo into its observation's folder, then records it. Never overwrites a file. */
export async function savePhoto(
  supabase: ServerSupabaseClient,
  observationId: string,
  path: string,
  bytes: Uint8Array,
  type: PhotoType,
  fileName: string,
) {
  const upload = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: type.mime, upsert: false });
  if (upload.error) return { error: upload.error };
  const { error } = await supabase.from("crop_photos").insert({
    observation_id: observationId,
    storage_path: path,
    file_name: fileName,
    mime_type: type.mime,
    file_size: bytes.byteLength,
  });
  return { error };
}

/** Signed links (valid for one hour) to show photos, by storage path. */
export async function photoLinks(supabase: ServerSupabaseClient, paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  const links = new Map<string, string>();
  for (const d of data) {
    if (d.path && d.signedUrl) links.set(d.path, d.signedUrl);
  }
  return links;
}
