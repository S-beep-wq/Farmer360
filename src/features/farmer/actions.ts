"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser, requireUser } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms";
import { isLocale } from "@/lib/i18n";
import { setLocaleCookie } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

import { getFarmerForUser, insertFarmer, updateFarmerLanguage } from "./repository";
import { farmerProfileSchema } from "./schema";

const UNIQUE_VIOLATION = "23505";

export async function createFarmerProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = formValues(formData);

  const parsed = farmerProfileSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await insertFarmer(supabase, parsed.data);
  if (error && error.code !== UNIQUE_VIOLATION) {
    console.error("createFarmerProfile failed", { userId: user.id, code: error.code });
    return { formError: "generic", values };
  }

  await setLocaleCookie(parsed.data.preferred_language);
  redirect("/farms");
}

/** Switches the interface language, and remembers it on the profile when there is one. */
export async function setLanguageAction(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;

  await setLocaleCookie(locale);

  const user = await getCurrentUser();
  if (user) {
    const supabase = await createClient();
    if (await getFarmerForUser(supabase, user.id)) {
      await updateFarmerLanguage(supabase, user.id, locale);
    }
  }

  refresh();
}
