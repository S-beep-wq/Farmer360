import { cropName, isCropCycleStatus, isSeason } from "@/features/crops/format";
import { formatArea } from "@/features/plots/format";
import { daysInField } from "@/features/season-review/summary";
import { listCropTotals } from "@/features/season-review/repository";
import { sumRupees } from "@/features/shared/money";
import { getMessages, type Locale } from "@/lib/i18n";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

import type { ContextCrop, FarmContext } from "./context";

// Reads the farmer's own records for the assistant (RLS: only their own), and stores metadata
// about each question (no question or answer text, DATABASE.md section 20).

const OPEN = ["PLANNED", "ACTIVE", "HARVESTED"];

type CycleRow = {
  id: string;
  season: string;
  status: string;
  planned_sowing_date: string | null;
  actual_sowing_date: string | null;
  expected_harvest_date: string | null;
  actual_harvest_date: string | null;
  crop: { name: string; name_hi: string };
  plot: { name: string };
};

export type AssistantCrop = { id: string; label: string };

/** The farmer's current crops, to choose which one a question is about. */
export async function listAssistantCrops(supabase: ServerSupabaseClient, locale: Locale): Promise<AssistantCrop[]> {
  const { data, error } = await supabase
    .from("crop_cycles")
    .select("id, season, crop:crop_catalog(name, name_hi), plot:plots(name)")
    .in("status", OPEN)
    .order("created_at")
    .overrideTypes<Pick<CycleRow, "id" | "season" | "crop" | "plot">[], { merge: false }>();
  if (error) throw error;
  const t = getMessages(locale);
  return data.map((c) => ({
    id: c.id,
    label: `${cropName(c.crop, locale)} · ${isSeason(c.season) ? t.seasons[c.season] : c.season} · ${c.plot.name}`,
  }));
}

/** Everything the assistant may use, in English (the answer language is set separately). */
export async function loadFarmContext(
  supabase: ServerSupabaseClient,
  opts: { locale: Locale; today: string; district: string; state: string; cropCycleId?: string },
): Promise<FarmContext | null> {
  const en = getMessages("en");
  let cycleQuery = supabase
    .from("crop_cycles")
    .select(
      "id, season, status, planned_sowing_date, actual_sowing_date, expected_harvest_date, actual_harvest_date, plot_id, " +
        "crop:crop_catalog(name, name_hi), plot:plots(name)",
    )
    .in("status", OPEN);
  if (opts.cropCycleId) cycleQuery = cycleQuery.eq("id", opts.cropCycleId);
  const { data: cycles, error } = await cycleQuery.order("created_at").overrideTypes<(CycleRow & { plot_id: string })[], { merge: false }>();
  if (error) throw error;
  // A crop that is not the farmer's (or not current) is simply not found.
  if (opts.cropCycleId && cycles.length === 0) return null;

  const ids = cycles.map((c) => c.id);
  const since = new Date(Date.parse(`${opts.today}T00:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
  let plotQuery = supabase.from("plots").select("id, name, area, area_unit, soil_type, irrigation_available, irrigation_type, farm:farms(name)").order("created_at");
  if (opts.cropCycleId) plotQuery = plotQuery.eq("id", cycles[0].plot_id);

  const [totals, plots, activities, observations] = await Promise.all([
    listCropTotals(supabase, ids),
    plotQuery.overrideTypes<
      { id: string; name: string; area: number | null; area_unit: string | null; soil_type: string | null; irrigation_available: boolean | null; irrigation_type: string | null; farm: { name: string } }[],
      { merge: false }
    >(),
    ids.length
      ? supabase
          .from("crop_activities")
          .select("activity_date, activity_type, crop_cycle_id")
          .in("crop_cycle_id", ids)
          .is("deleted_at", null)
          .gte("activity_date", since)
          .order("activity_date", { ascending: false })
          .limit(15)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase
          .from("crop_observations")
          .select("observation_date, health_status, farmer_notes, crop_cycle_id")
          .in("crop_cycle_id", ids)
          .is("deleted_at", null)
          .gte("observation_date", since)
          .order("observation_date", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [plots, activities, observations]) if (r.error) throw r.error;

  const cropOf = new Map(cycles.map((c) => [c.id, cropName(c.crop, "en")]));
  const crops: ContextCrop[] = cycles.map((c) => {
    const tot = totals.get(c.id);
    return {
      crop: cropName(c.crop, "en"),
      season: isSeason(c.season) ? en.seasons[c.season] : c.season,
      status: isCropCycleStatus(c.status) ? en.cropStatuses[c.status] : c.status,
      plot: c.plot.name,
      plannedSowing: c.status === "PLANNED" ? c.planned_sowing_date : null,
      sowing: c.actual_sowing_date,
      expectedHarvest: c.actual_harvest_date ? null : c.expected_harvest_date,
      harvest: c.actual_harvest_date,
      daysSinceSowing: c.actual_harvest_date ? null : daysInField(c.actual_sowing_date, opts.today),
      spentRupees: tot ? sumRupees([tot.work_costs, tot.expense_total]) : 0,
      harvestedKg: tot?.harvested_kg ?? 0,
      soldKg: tot?.sold_kg ?? 0,
      salesRupees: tot?.revenue ?? 0,
    };
  });

  const label = <K extends string>(value: string | null, labels: Record<K, string>) => (value && value in labels ? labels[value as K] : value);

  return {
    locale: opts.locale,
    today: opts.today,
    district: opts.district,
    state: opts.state,
    oneCrop: Boolean(opts.cropCycleId),
    crops,
    plots: (plots.data ?? []).map((p) => ({
      name: p.name,
      farm: p.farm.name,
      area: formatArea(p.area, p.area_unit, en, "en"),
      soil: label(p.soil_type, en.soilTypes),
      irrigation: p.irrigation_available === null ? null : p.irrigation_available ? (label(p.irrigation_type, en.irrigationTypes) ?? "yes") : "none",
    })),
    activities: (activities.data ?? []).map((a) => ({
      date: a.activity_date,
      crop: cropOf.get(a.crop_cycle_id) ?? "",
      type: label(a.activity_type, en.activityTypes) ?? a.activity_type,
    })),
    observations: (observations.data ?? []).map((o) => ({
      date: o.observation_date,
      crop: cropOf.get(o.crop_cycle_id) ?? "",
      status: label(o.health_status, en.healthStatuses) ?? o.health_status,
      note: o.farmer_notes,
    })),
  };
}

export async function countQuestionsToday(supabase: ServerSupabaseClient, startOfTodayIso: string): Promise<number> {
  const { count, error } = await supabase.from("ai_interactions").select("id", { count: "exact", head: true }).gte("created_at", startOfTodayIso);
  if (error) throw error;
  return count ?? 0;
}

export async function recordQuestion(
  supabase: ServerSupabaseClient,
  meta: { model: string; confidence: string; asked_for_information: boolean; see_expert: boolean; about_one_crop: boolean },
) {
  const { data, error } = await supabase
    .from("ai_interactions")
    .insert({ interaction_type: "FARM_QUESTION", ...meta })
    .select("id")
    .single();
  return { id: data?.id, error };
}

export async function setQuestionFeedback(supabase: ServerSupabaseClient, interactionId: string, feedback: string) {
  const { data, error } = await supabase.from("ai_interactions").update({ farmer_feedback: feedback }).eq("id", interactionId).select("id");
  return { updated: (data ?? []).length === 1, error };
}
