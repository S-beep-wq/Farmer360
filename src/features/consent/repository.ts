import type { Locale } from "@/lib/i18n";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

// Data-use consent (DATABASE.md section 21a). Row Level Security limits every query to the
// signed-in user's own rows; who accepted and when are set by the database, not by the app.

/** Whether the user has accepted this version of the notice. */
export async function hasAcceptedNotice(supabase: ServerSupabaseClient, userId: string, version: string) {
  const { data, error } = await supabase
    .from("user_consents")
    .select("id")
    .eq("user_id", userId)
    .eq("notice_version", version)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Records that the signed-in user accepted this version, as shown in this language. */
export async function recordConsent(supabase: ServerSupabaseClient, version: string, locale: Locale) {
  const { error } = await supabase.from("user_consents").insert({ notice_version: version, locale });
  return { error };
}

/** Whether the user has accepted any version, i.e. this is a changed notice rather than a first visit. */
export async function hasAcceptedAnyNotice(supabase: ServerSupabaseClient, userId: string) {
  const { count, error } = await supabase
    .from("user_consents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return (count ?? 0) > 0;
}
