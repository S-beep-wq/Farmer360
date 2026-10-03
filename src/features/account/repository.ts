import { PHOTO_BUCKET } from "@/features/observations/constants";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

import { inChunks } from "./rules";

// Account deletion, under the farmer's own session (DATABASE.md section 3, "Account deletion").
// The database allows removing photo files only after deletion has been requested, and deletes
// the account only once no photo files are left.

const REMOVE_BATCH = 100;

/** Marks the farmer's account for deletion. Cannot be undone. */
export async function requestAccountDeletion(supabase: ServerSupabaseClient, userId: string) {
  const { error } = await supabase.from("farmers").update({ deletion_requested_at: new Date().toISOString() }).eq("user_id", userId);
  return { error };
}

/** Removes every file in the farmer's photo folder from storage. */
export async function removeAllPhotos(supabase: ServerSupabaseClient) {
  const { data: paths, error } = await supabase.rpc("account_photo_paths");
  if (error) return { error };
  for (const batch of inChunks(paths, REMOVE_BATCH)) {
    const { data: removed, error: removeError } = await supabase.storage.from(PHOTO_BUCKET).remove(batch);
    if (removeError) return { error: removeError };
    if (removed.length !== batch.length) return { error: new Error("Some photos were not removed") };
  }
  return { error: null };
}

/** Deletes the signed-in user; their farmer data goes with it (ON DELETE CASCADE). */
export async function deleteAccount(supabase: ServerSupabaseClient) {
  const { error } = await supabase.rpc("delete_my_account");
  return { error };
}
