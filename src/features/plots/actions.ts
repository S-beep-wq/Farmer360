"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { getFarm } from "@/features/farms/repository";
import { isId } from "@/features/farms/schema";
import { requireFarmer } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { insertPlot, updatePlot } from "./repository";
import { plotSchema, type PlotInput } from "./schema";

const CHECK_VIOLATION = "23514";

function saveFailed(error: PostgrestError | null, input: PlotInput, values: Record<string, string>): FormState {
  // The database rejects boundaries it cannot accept (invalid shape, too large).
  if (error?.code === CHECK_VIOLATION && input.boundary) {
    return { fieldErrors: { boundary: "invalidBoundary" }, values };
  }
  return { formError: "generic", values };
}

/** Bound to a farm id by the page: `createPlotAction.bind(null, farmId)`. */
export async function createPlotAction(farmId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const farmer = await requireFarmer();
  const values = formValues(formData);

  const supabase = await createClient();
  // The farm id comes from the browser: confirm it is one of this farmer's farms (RLS also enforces this).
  if (!isId(farmId) || !(await getFarm(supabase, farmId))) {
    return { formError: "generic", values };
  }

  const parsed = plotSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const { id, error } = await insertPlot(supabase, farmId, parsed.data);
  if (error || !id) {
    console.error("createPlot failed", { farmerId: farmer.id, farmId, code: error?.code });
    return saveFailed(error, parsed.data, values);
  }

  redirect(`/farms/${farmId}/plots/${id}`);
}

/** Bound by the page: `updatePlotAction.bind(null, farmId, plotId)`. */
export async function updatePlotAction(
  farmId: string,
  plotId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const farmer = await requireFarmer();
  const values = formValues(formData);
  if (!isId(farmId) || !isId(plotId)) {
    return { formError: "generic", values };
  }

  const parsed = plotSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  // The ids come from the browser; RLS only lets the farmer update plots on their own farms.
  const { updated, error } = await updatePlot(await createClient(), farmId, plotId, parsed.data);
  if (error || !updated) {
    console.error("updatePlot failed", { farmerId: farmer.id, farmId, plotId, code: error?.code });
    return saveFailed(error, parsed.data, values);
  }

  redirect(`/farms/${farmId}/plots/${plotId}`);
}
