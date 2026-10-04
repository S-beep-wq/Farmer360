"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import type { FormState } from "@/lib/forms";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

import { NOTICE_VERSION } from "./constants";
import { recordConsent } from "./repository";
import { isAlreadyAccepted, isNoticeAgreed } from "./rules";

/** Records agreement to the current notice, in the language it was shown in, then opens the app. */
export async function acceptNoticeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ skipConsent: true });
  if (!isNoticeAgreed(formData)) {
    return { fieldErrors: { agree: "confirmNotice" } };
  }

  const [supabase, { locale }] = await Promise.all([createClient(), getServerMessages()]);
  const { error } = await recordConsent(supabase, NOTICE_VERSION, locale);
  if (error && !isAlreadyAccepted(error)) {
    console.error("recordConsent failed", { userId: user.id, code: error.code });
    return { formError: "generic" };
  }

  redirect("/");
}
