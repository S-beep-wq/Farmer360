"use server";

import { redirect } from "next/navigation";

import { todayInIndia } from "@/features/crops/dates";
import { getFarmerForUser } from "@/features/farmer/repository";
import { requireBuyer, requireFarmer, requireUser } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms";
import { setLocaleCookie } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

import type { ClosedDemandStatus } from "./constants";
import { closeDemand, getDemandForFarmer, insertBuyer, insertDemand, insertInterest, updateBuyer } from "./repository";
import { isDemandOpen } from "./rules";
import { buyerProfileSchema, demandSchema, interestSchema } from "./schema";

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

/** Buyer registration (a login is a farmer or a buyer, never both). */
export async function createBuyerProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = formValues(formData);
  const parsed = buyerProfileSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const supabase = await createClient();
  if (await getFarmerForUser(supabase, user.id)) redirect("/farms");
  const { error } = await insertBuyer(supabase, parsed.data);
  if (error && error.code !== UNIQUE_VIOLATION) {
    console.error("createBuyerProfile failed", { userId: user.id, code: error.code });
    return { formError: "generic", values };
  }

  await setLocaleCookie(parsed.data.preferred_language);
  redirect("/buyer");
}

export async function updateBuyerProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireBuyer();
  const user = await requireUser();
  const values = formValues(formData);
  const parsed = buyerProfileSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const { error } = await updateBuyer(await createClient(), user.id, parsed.data);
  if (error) {
    console.error("updateBuyerProfile failed", { userId: user.id, code: error.code });
    return { formError: "generic", values };
  }

  await setLocaleCookie(parsed.data.preferred_language);
  redirect("/buyer/profile");
}

export async function createDemandAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const buyer = await requireBuyer();
  const values = formValues(formData);
  const parsed = demandSchema(todayInIndia()).safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const { id, error } = await insertDemand(await createClient(), parsed.data);
  if (error || !id) {
    console.error("createDemand failed", { buyerId: buyer.id, code: error?.code });
    return { formError: error?.code === CHECK_VIOLATION ? "pastDate" : "generic", values };
  }
  redirect(`/buyer/demands/${id}`);
}

export async function closeDemandAction(demandId: string, status: ClosedDemandStatus): Promise<FormState> {
  const buyer = await requireBuyer();
  const { closed, error } = await closeDemand(await createClient(), buyer.id, demandId, status);
  if (error || !closed) {
    if (error) console.error("closeDemand failed", { buyerId: buyer.id, code: error.code });
    return { formError: error ? "generic" : "demandNotOpen" };
  }
  redirect(`/buyer/demands/${demandId}`);
}

/** A farmer tells the buyer they are interested, sharing their name, village and phone. */
export async function expressInterestAction(demandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const farmer = await requireFarmer();
  const values = formValues(formData);
  const parsed = interestSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const supabase = await createClient();
  const demand = await getDemandForFarmer(supabase, demandId);
  if (!demand || !isDemandOpen(demand, todayInIndia())) {
    return { formError: "demandNotOpen", values };
  }

  const { error } = await insertInterest(supabase, demandId, parsed.data.note);
  if (error && error.code !== UNIQUE_VIOLATION) {
    console.error("expressInterest failed", { farmerId: farmer.id, code: error.code });
    return { formError: error.code === CHECK_VIOLATION ? "demandNotOpen" : "generic", values };
  }
  redirect(`/market/${demandId}`);
}

