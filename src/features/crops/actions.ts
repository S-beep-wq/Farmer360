"use server";

import { redirect } from "next/navigation";

import { isId } from "@/features/farms/schema";
import { getPlot } from "@/features/plots/repository";
import { requireFarmer } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { todayInIndia } from "./dates";
import { insertCropCycle } from "./repository";
import { cropCycleSchema } from "./schema";

const FOREIGN_KEY_VIOLATION = "23503";

/** Bound by the page: `createCropCycleAction.bind(null, farmId, plotId)`. */
export async function createCropCycleAction(
  farmId: string,
  plotId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const farmer = await requireFarmer();
  const values = formValues(formData);

  const supabase = await createClient();
  // The ids come from the browser: confirm the plot is on one of this farmer's farms (RLS also enforces this).
  if (!isId(farmId) || !isId(plotId) || !(await getPlot(supabase, farmId, plotId))) {
    return { formError: "generic", values };
  }

  const parsed = cropCycleSchema(todayInIndia()).safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const { id, error } = await insertCropCycle(supabase, plotId, parsed.data);
  if (error || !id) {
    console.error("createCropCycle failed", { farmerId: farmer.id, plotId, code: error?.code });
    if (error?.code === FOREIGN_KEY_VIOLATION) {
      return { fieldErrors: { crop_id: "invalidChoice" }, values };
    }
    return { formError: "generic", values };
  }

  redirect(`/farms/${farmId}/plots/${plotId}/crops/${id}`);
}
