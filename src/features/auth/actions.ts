"use server";

import { redirect } from "next/navigation";

import { getFarmerForUser } from "@/features/farmer/repository";
import type { ErrorKey } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n";
import { setLocaleCookie } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

import { isOtpCode, normalizeIndianMobile } from "./phone";

export type LoginState = {
  step: "phone" | "otp";
  /** E.164 phone number the code was sent to. */
  phone?: string;
  fieldErrors?: Partial<Record<"phone" | "code", ErrorKey>>;
  formError?: ErrorKey;
  values?: { phone?: string };
};

function authErrorKey(status: number | undefined, fallback: ErrorKey): ErrorKey {
  return status === 429 ? "rateLimited" : fallback;
}

async function sendOtp(formData: FormData): Promise<LoginState> {
  const raw = String(formData.get("phone") ?? "");
  const phone = normalizeIndianMobile(raw);
  if (!phone) {
    return { step: "phone", fieldErrors: { phone: "invalidPhone" }, values: { phone: raw } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) {
    console.error("sendOtp failed", { status: error.status, code: error.code });
    return { step: "phone", formError: authErrorKey(error.status, "smsFailed"), values: { phone: raw } };
  }

  return { step: "otp", phone };
}

async function verifyOtp(formData: FormData): Promise<LoginState> {
  const phone = normalizeIndianMobile(String(formData.get("phone") ?? ""));
  if (!phone) {
    return { step: "phone", fieldErrors: { phone: "invalidPhone" } };
  }

  const code = String(formData.get("code") ?? "").trim();
  if (!isOtpCode(code)) {
    return { step: "otp", phone, fieldErrors: { code: "invalidCode" } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
  if (error || !data.user) {
    if (error) console.warn("verifyOtp failed", { status: error.status, code: error.code });
    return { step: "otp", phone, formError: authErrorKey(error?.status, "wrongCode") };
  }

  // Returning farmers get the app in the language they chose before.
  const farmer = await getFarmerForUser(supabase, data.user.id);
  if (farmer && isLocale(farmer.preferred_language)) {
    await setLocaleCookie(farmer.preferred_language);
  }

  redirect(farmer ? "/farms" : "/onboarding");
}

/** Registration and login are one flow: send a code to the phone, then verify it. */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  return formData.get("intent") === "verify" ? verifyOtp(formData) : sendOtp(formData);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
