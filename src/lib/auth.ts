import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { getFarmerForUser } from "@/features/farmer/repository";
import { getBuyerForUser } from "@/features/market/repository";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; phone: string | null };

/**
 * The signed-in user, verified from the session JWT (signature checked by
 * Supabase Auth), or null. Cached for the duration of one request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    return null;
  }
  const phone = typeof data.claims.phone === "string" ? data.claims.phone : null;
  return { id: data.claims.sub, phone };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/** Where a signed-in user belongs: a login is a farmer or a buyer (never both), or neither yet. */
export const getRoleHome = cache(async (userId: string): Promise<"/farms" | "/buyer" | "/onboarding"> => {
  const supabase = await createClient();
  if (await getFarmerForUser(supabase, userId)) return "/farms";
  if (await getBuyerForUser(supabase, userId)) return "/buyer";
  return "/onboarding";
});

/**
 * The signed-in farmer's profile. Sends a buyer to their own pages, someone without a profile to
 * onboarding, and a farmer whose account deletion did not complete to finish it.
 */
export const requireFarmer = cache(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const farmer = await getFarmerForUser(supabase, user.id);
  if (!farmer) {
    redirect(await getRoleHome(user.id));
  }
  if (farmer.deletion_requested_at) {
    redirect("/profile/delete");
  }
  return farmer;
});

/** The signed-in buyer's profile. Sends farmers to their farms and others to buyer registration. */
export const requireBuyer = cache(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const buyer = await getBuyerForUser(supabase, user.id);
  if (!buyer) {
    const home = await getRoleHome(user.id);
    redirect(home === "/onboarding" ? "/onboarding/buyer" : home);
  }
  return buyer;
});
