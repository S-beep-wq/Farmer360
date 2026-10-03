"use server";

import { refresh } from "next/cache";

import { todayInIndia } from "@/features/crops/dates";
import { cropName, isSeason } from "@/features/crops/format";
import { getCropCycle } from "@/features/crops/repository";
import { isId } from "@/features/farms/schema";
import { PHOTO_BUCKET } from "@/features/observations/constants";
import { detectImageType } from "@/features/observations/photo";
import { getObservation } from "@/features/observations/repository";
import { getPlot } from "@/features/plots/repository";
import { daysInField } from "@/features/season-review/summary";
import { requireFarmer } from "@/lib/auth";
import type { ErrorKey } from "@/lib/i18n";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { countAnalysesToday, insertAnalysis, listAnalyses, setFeedback } from "./repository";
import { canRequestAnalysis } from "./rules";
import { analyzeCropPhotos, isCropHealthAiEnabled, type AnalysisPhoto } from "./service";

// The farmer asks for AI help on one of their observations (USER_WORKFLOWS.md section 8:
// "AI analysis (if enabled) → store result"). Pressing the button is their consent to send the
// photo to the AI service, which the page explains next to it.

type ObservationIds = { farmId: string; plotId: string; cycleId: string; observationId: string };

const DAILY_LIMIT = 20;
const FEEDBACK = ["HELPFUL", "NOT_HELPFUL", "NOT_SURE"] as const;

const FAILURE: Record<"refused" | "unavailable" | "invalid", ErrorKey> = {
  refused: "aiRefused",
  unavailable: "aiUnavailable",
  invalid: "aiUnavailable",
};

export async function requestAnalysisAction(ids: ObservationIds): Promise<FormState> {
  const farmer = await requireFarmer();
  if (!isCropHealthAiEnabled()) return { formError: "aiUnavailable" };
  if (![ids.farmId, ids.plotId, ids.cycleId, ids.observationId].every(isId)) return { formError: "generic" };

  const supabase = await createClient();
  const [plot, cycle, observation] = await Promise.all([
    getPlot(supabase, ids.farmId, ids.plotId),
    getCropCycle(supabase, ids.plotId, ids.cycleId),
    getObservation(supabase, ids.cycleId, ids.observationId),
  ]);
  if (!plot || !cycle || !observation) return { formError: "generic" };

  // Check the limits before paying for a request the database would refuse to store.
  const [earlier, today] = await Promise.all([
    listAnalyses(supabase, observation.id),
    countAnalysesToday(supabase, `${todayInIndia()}T00:00:00+05:30`),
  ]);
  if (!canRequestAnalysis({ enabled: true, hasPhoto: observation.photos.length > 0, analyses: earlier.length })) {
    return { formError: observation.photos.length === 0 ? "generic" : "aiLimitObservation" };
  }
  if (today >= DAILY_LIMIT) return { formError: "aiLimitDay" };

  const photos: AnalysisPhoto[] = [];
  for (const photo of observation.photos) {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(photo.storage_path);
    if (error || !data) {
      console.error("crop health AI: photo download failed", { farmerId: farmer.id });
      return { formError: "aiUnavailable" };
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    const type = detectImageType(bytes);
    if (type) photos.push({ data: bytes, type });
  }
  if (photos.length === 0) return { formError: "generic" };

  const locale = await getLocale();
  const outcome = await analyzeCropPhotos(photos, {
    locale,
    cropName: cropName(cycle.crop, "en"),
    season: isSeason(cycle.season) ? getMessages("en").seasons[cycle.season] : cycle.season,
    daysSinceSowing: daysInField(cycle.actual_sowing_date, observation.observation_date),
    observationDate: observation.observation_date,
    district: farmer.district,
    state: farmer.state,
    farmerStatus: observation.health_status,
    farmerNote: observation.farmer_notes,
  });
  if (!outcome.ok) return { formError: FAILURE[outcome.reason] };

  const { error } = await insertAnalysis(supabase, observation.id, { locale, model: outcome.model, result: outcome.result });
  if (error) {
    console.error("crop health AI: saving the analysis failed", { farmerId: farmer.id, code: error.code });
    if (error.message.includes("analysis_limit_day")) return { formError: "aiLimitDay" };
    if (error.message.includes("analysis_limit_observation")) return { formError: "aiLimitObservation" };
    return { formError: "generic" };
  }
  refresh();
  return {};
}

/** "Did this help?" — the farmer's verdict, used to check the AI in the field. */
export async function analysisFeedbackAction(analysisId: string, feedback: string): Promise<FormState> {
  await requireFarmer();
  if (!isId(analysisId) || !(FEEDBACK as readonly string[]).includes(feedback)) return { formError: "generic" };
  const { updated, error } = await setFeedback(await createClient(), analysisId, feedback);
  if (error || !updated) return { formError: "generic" };
  refresh();
  return {};
}
