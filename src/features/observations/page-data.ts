import "server-only";

import { notFound, redirect } from "next/navigation";

import { todayInIndia } from "@/features/crops/dates";
import { loadCropPage } from "@/features/crops/page-data";
import { isId } from "@/features/farms/schema";
import { createClient } from "@/lib/supabase/server";

import { getObservation, listObservations, photoLinks } from "./repository";
import { canAddObservation } from "./rules";

type CropParams = { farmId: string; plotId: string; cycleId: string };

/** A crop's observations with signed links to their photos. */
export async function loadObservations(cropCycleId: string) {
  const supabase = await createClient();
  const observations = await listObservations(supabase, cropCycleId);
  const links = await photoLinks(
    supabase,
    observations.flatMap((o) => o.photos.map((p) => p.storage_path)),
  );
  return { observations, links };
}

export async function loadTimelinePage(params: Promise<CropParams>) {
  const page = await loadCropPage(params);
  return { ...page, ...(await loadObservations(page.cycle.id)) };
}

export async function loadNewObservationPage(params: Promise<CropParams>) {
  const page = await loadCropPage(params);
  if (!canAddObservation(page.cycle.status) || !page.cycle.actual_sowing_date) redirect(page.cropHref);
  return { ...page, today: todayInIndia(), sowingDate: page.cycle.actual_sowing_date };
}

export async function loadObservationPage(params: Promise<CropParams & { observationId: string }>) {
  const { observationId } = await params;
  const page = await loadCropPage(params);
  const supabase = await createClient();
  const observation = isId(observationId) ? await getObservation(supabase, page.cycle.id, observationId) : null;
  if (!observation) notFound();
  const links = await photoLinks(supabase, observation.photos.map((p) => p.storage_path));
  return { ...page, observation, links };
}
