"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { todayInIndia } from "@/features/crops/dates";
import { getCropCycle } from "@/features/crops/repository";
import { isId } from "@/features/farms/schema";
import { getPlot } from "@/features/plots/repository";
import { requireFarmer } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import {
  insertActivity,
  insertExpense,
  removeActivity,
  removeExpense,
  updateActivity,
  updateExpense,
} from "./repository";
import { activitySchema, expenseSchema } from "./schema";
import { canRecord } from "./rules";

// Work done and costs for a crop. The ids are bound by the page and come from the browser, so each
// action re-reads the plot and crop under the farmer's session (RLS); the database checks again.

type CropIds = { farmId: string; plotId: string; cycleId: string };
type RecordIds = CropIds & { recordId: string };

async function loadCrop(ids: CropIds) {
  const farmer = await requireFarmer();
  if (!isId(ids.farmId) || !isId(ids.plotId) || !isId(ids.cycleId)) return null;
  const supabase = await createClient();
  const [plot, cycle] = await Promise.all([getPlot(supabase, ids.farmId, ids.plotId), getCropCycle(supabase, ids.plotId, ids.cycleId)]);
  if (!plot || !cycle || !canRecord(cycle.status)) return null;
  return { farmer, supabase };
}

function cropPage(ids: CropIds) {
  return `/farms/${ids.farmId}/plots/${ids.plotId}/crops/${ids.cycleId}`;
}

function failed(what: string, farmerId: string, error: PostgrestError | null, values: Record<string, string>): FormState {
  console.error(`${what} failed`, { farmerId, code: error?.code });
  return { formError: "generic", values };
}

export async function createActivityAction(ids: CropIds, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const crop = await loadCrop(ids);
  if (!crop) return { formError: "generic", values };

  const parsed = activitySchema(todayInIndia()).safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const { error } = await insertActivity(crop.supabase, ids.cycleId, parsed.data);
  if (error) return failed("createActivity", crop.farmer.id, error, values);
  redirect(cropPage(ids));
}

export async function updateActivityAction(ids: RecordIds, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const crop = await loadCrop(ids);
  if (!crop || !isId(ids.recordId)) return { formError: "generic", values };

  const parsed = activitySchema(todayInIndia()).safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const { updated, error } = await updateActivity(crop.supabase, ids.cycleId, ids.recordId, parsed.data);
  if (error || !updated) return failed("updateActivity", crop.farmer.id, error, values);
  redirect(cropPage(ids));
}

export async function removeActivityAction(ids: RecordIds): Promise<FormState> {
  const crop = await loadCrop(ids);
  if (!crop || !isId(ids.recordId)) return { formError: "generic" };
  const { updated, error } = await removeActivity(crop.supabase, ids.cycleId, ids.recordId);
  if (error || !updated) return failed("removeActivity", crop.farmer.id, error, {});
  redirect(cropPage(ids));
}

export async function createExpenseAction(ids: CropIds, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const crop = await loadCrop(ids);
  if (!crop) return { formError: "generic", values };

  const parsed = expenseSchema(todayInIndia()).safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const { error } = await insertExpense(crop.supabase, ids.cycleId, parsed.data);
  if (error) return failed("createExpense", crop.farmer.id, error, values);
  redirect(cropPage(ids));
}

export async function updateExpenseAction(ids: RecordIds, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const crop = await loadCrop(ids);
  if (!crop || !isId(ids.recordId)) return { formError: "generic", values };

  const parsed = expenseSchema(todayInIndia()).safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const { updated, error } = await updateExpense(crop.supabase, ids.cycleId, ids.recordId, parsed.data);
  if (error || !updated) return failed("updateExpense", crop.farmer.id, error, values);
  redirect(cropPage(ids));
}

export async function removeExpenseAction(ids: RecordIds): Promise<FormState> {
  const crop = await loadCrop(ids);
  if (!crop || !isId(ids.recordId)) return { formError: "generic" };
  const { updated, error } = await removeExpense(crop.supabase, ids.cycleId, ids.recordId);
  if (error || !updated) return failed("removeExpense", crop.farmer.id, error, {});
  redirect(cropPage(ids));
}
