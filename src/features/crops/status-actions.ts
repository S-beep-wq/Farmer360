"use server";

import { redirect } from "next/navigation";

import { isId } from "@/features/farms/schema";
import { getPlot } from "@/features/plots/repository";
import { requireFarmer } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import type { CropCycleStatus } from "./constants";
import { todayInIndia } from "./dates";
import { isCropCycleStatus } from "./format";
import { getCropCycle, updateCropCycle } from "./repository";
import { editCropCycleSchema, recordHarvestSchema, recordSowingSchema } from "./schema";
import { canDo, type CropCycleAction } from "./transitions";

// Status changes and edits for a crop cycle. Each action re-reads the cycle under the farmer's
// session (RLS), checks the change is allowed from its current status, and updates it only if the
// status is still the same. The database enforces the same rules.

type Ids = { farmId: string; plotId: string; cycleId: string };

async function loadCycle({ farmId, plotId, cycleId }: Ids, action: CropCycleAction) {
  const farmer = await requireFarmer();
  if (!isId(farmId) || !isId(plotId) || !isId(cycleId)) return null;
  const supabase = await createClient();
  const [plot, cycle] = await Promise.all([getPlot(supabase, farmId, plotId), getCropCycle(supabase, plotId, cycleId)]);
  if (!plot || !cycle || !isCropCycleStatus(cycle.status) || !canDo(cycle.status, action)) return null;
  return { farmer, supabase, cycle: { ...cycle, status: cycle.status as CropCycleStatus } };
}

function cropPage({ farmId, plotId, cycleId }: Ids) {
  return `/farms/${farmId}/plots/${plotId}/crops/${cycleId}`;
}

async function save(
  ids: Ids,
  loaded: NonNullable<Awaited<ReturnType<typeof loadCycle>>>,
  patch: Parameters<typeof updateCropCycle>[4],
  values: Record<string, string>,
): Promise<FormState> {
  const { updated, error } = await updateCropCycle(loaded.supabase, ids.plotId, ids.cycleId, loaded.cycle.status, patch);
  if (error) {
    console.error("updateCropCycle failed", { farmerId: loaded.farmer.id, cycleId: ids.cycleId, code: error.code });
    return { formError: "generic", values };
  }
  if (!updated) {
    return { formError: "statusChanged", values };
  }
  redirect(cropPage(ids));
}

/** PLANNED → ACTIVE. Bound by the page with the farm, plot and cycle ids. */
export async function recordSowingAction(ids: Ids, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const loaded = await loadCycle(ids, "recordSowing");
  if (!loaded) return { formError: "statusChanged", values };

  const parsed = recordSowingSchema(todayInIndia()).safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  return save(ids, loaded, {
    status: "ACTIVE",
    actual_sowing_date: parsed.data.actual_sowing_date,
    expected_harvest_date: parsed.data.expected_harvest_date ?? null,
  }, values);
}

/** ACTIVE → HARVESTED. */
export async function recordHarvestAction(ids: Ids, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const loaded = await loadCycle(ids, "recordHarvest");
  if (!loaded || !loaded.cycle.actual_sowing_date) return { formError: "statusChanged", values };

  const parsed = recordHarvestSchema(todayInIndia(), loaded.cycle.actual_sowing_date).safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  return save(ids, loaded, { status: "HARVESTED", actual_harvest_date: parsed.data.actual_harvest_date }, values);
}

/** PLANNED or ACTIVE → CANCELLED. The cycle is kept as history. */
export async function cancelCropCycleAction(ids: Ids, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const loaded = await loadCycle(ids, "cancel");
  if (!loaded) return { formError: "statusChanged", values };
  return save(ids, loaded, { status: "CANCELLED" }, values);
}

/** Change crop, variety, season and the dates that apply to the current status. */
export async function updateCropCycleAction(ids: Ids, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const loaded = await loadCycle(ids, "edit");
  const status = loaded?.cycle.status;
  if (!loaded || (status !== "PLANNED" && status !== "ACTIVE" && status !== "HARVESTED")) {
    return { formError: "statusChanged", values };
  }

  const parsed = editCropCycleSchema(todayInIndia(), status).safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  const v = parsed.data;

  return save(ids, loaded, {
    crop_id: v.crop_id,
    variety_name: v.variety_name ?? null,
    season: v.season,
    expected_harvest_date: v.expected_harvest_date ?? null,
    // Only the dates that belong to this status are changed.
    ...(status === "PLANNED" ? { planned_sowing_date: v.planned_sowing_date } : { actual_sowing_date: v.actual_sowing_date }),
    ...(status === "HARVESTED" ? { actual_harvest_date: v.actual_harvest_date } : {}),
  }, values);
}
