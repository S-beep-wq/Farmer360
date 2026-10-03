import type { ServerSupabaseClient } from "@/lib/supabase/server";

import type { CropHealthResult } from "./schema";

// AI analyses of an observation, kept separately from the farmer's own observation. RLS limits
// them to the farmer's own observations; the database limits how many can be made.

export type CropHealthAnalysis = {
  id: string;
  observation_id: string;
  locale: string;
  model: string;
  result: CropHealthResult;
  confidence: string;
  image_usable: boolean;
  see_expert: boolean;
  farmer_feedback: string | null;
  created_at: string;
};

const COLUMNS = "id, observation_id, locale, model, result, confidence, image_usable, see_expert, farmer_feedback, created_at";

/** Newest first. */
export async function listAnalyses(supabase: ServerSupabaseClient, observationId: string): Promise<CropHealthAnalysis[]> {
  const { data, error } = await supabase
    .from("crop_health_analyses")
    .select(COLUMNS)
    .eq("observation_id", observationId)
    .order("created_at", { ascending: false })
    .overrideTypes<CropHealthAnalysis[], { merge: false }>();
  if (error) throw error;
  return data;
}

export async function insertAnalysis(
  supabase: ServerSupabaseClient,
  observationId: string,
  analysis: { locale: string; model: string; result: CropHealthResult },
) {
  const { error } = await supabase.from("crop_health_analyses").insert({
    observation_id: observationId,
    locale: analysis.locale,
    model: analysis.model,
    result: analysis.result,
    confidence: analysis.result.confidence,
    image_usable: analysis.result.image_usable,
    see_expert: analysis.result.see_expert,
  });
  return { error };
}

/** How many analyses the farmer has asked for today (India time), across all their crops. */
export async function countAnalysesToday(supabase: ServerSupabaseClient, startOfTodayIso: string): Promise<number> {
  const { count, error } = await supabase.from("crop_health_analyses").select("id", { count: "exact", head: true }).gte("created_at", startOfTodayIso);
  if (error) throw error;
  return count ?? 0;
}

export async function setFeedback(supabase: ServerSupabaseClient, analysisId: string, feedback: string) {
  const { data, error } = await supabase.from("crop_health_analyses").update({ farmer_feedback: feedback }).eq("id", analysisId).select("id");
  return { updated: (data ?? []).length === 1, error };
}
