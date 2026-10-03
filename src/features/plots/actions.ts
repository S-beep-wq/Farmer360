"use server";

import { redirect } from "next/navigation";

import { getFarm } from "@/features/farms/repository";
import { isId } from "@/features/farms/schema";
import { requireFarmer } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { insertPlot } from "./repository";
import { plotSchema } from "./schema";

const CHECK_VIOLATION = "23514";

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
    // The database rejects boundaries it cannot accept (invalid shape, too large).
    if (error?.code === CHECK_VIOLATION && parsed.data.boundary) {
      return { fieldErrors: { boundary: "invalidBoundary" }, values };
    }
    return { formError: "generic", values };
  }

  redirect(`/farms/${farmId}/plots/${id}`);
}
