"use server";

import { redirect } from "next/navigation";

import { requireFarmer } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { insertFarm, updateFarm } from "./repository";
import { farmSchema, isId } from "./schema";

export async function createFarmAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const farmer = await requireFarmer();
  const values = formValues(formData);

  const parsed = farmSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const supabase = await createClient();
  const { id, error } = await insertFarm(supabase, parsed.data, farmer);
  if (error || !id) {
    console.error("createFarm failed", { farmerId: farmer.id, code: error?.code });
    return { formError: "generic", values };
  }

  redirect(`/farms/${id}`);
}

/** Bound to a farm id by the page: `updateFarmAction.bind(null, farmId)`. */
export async function updateFarmAction(farmId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const farmer = await requireFarmer();
  const values = formValues(formData);
  if (!isId(farmId)) {
    return { formError: "generic", values };
  }

  const parsed = farmSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  // The farm id comes from the browser; RLS only lets the farmer update their own farms.
  const { updated, error } = await updateFarm(await createClient(), farmId, parsed.data);
  if (error || !updated) {
    console.error("updateFarm failed", { farmerId: farmer.id, farmId, code: error?.code });
    return { formError: "generic", values };
  }

  redirect(`/farms/${farmId}`);
}
