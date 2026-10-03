import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n";

import type { FarmerProfileInput } from "./schema";

// Data access for `farmers`. Row Level Security limits every query to the signed-in user's own row.

const FARMER_COLUMNS = "id, full_name, phone, preferred_language, state, district, village, deletion_requested_at";

export async function getFarmerForUser(supabase: ServerSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("farmers")
    .select(FARMER_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type Farmer = NonNullable<Awaited<ReturnType<typeof getFarmerForUser>>>;

export async function insertFarmer(supabase: ServerSupabaseClient, input: FarmerProfileInput) {
  // user_id defaults to auth.uid() and phone is set from the verified login by a database trigger.
  const { error } = await supabase.from("farmers").insert(input);
  return { error };
}

export async function updateFarmerLanguage(supabase: ServerSupabaseClient, userId: string, locale: Locale) {
  const { error } = await supabase.from("farmers").update({ preferred_language: locale }).eq("user_id", userId);
  if (error) throw error;
}
