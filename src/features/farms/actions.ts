"use server";

import { redirect } from "next/navigation";

import { requireFarmer } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { insertFarm } from "./repository";
import { farmSchema } from "./schema";

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
