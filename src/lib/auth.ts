import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { getFarmerForUser } from "@/features/farmer/repository";
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

/** The signed-in farmer's profile. Sends the user to onboarding if they have none yet. */
export const requireFarmer = cache(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const farmer = await getFarmerForUser(supabase, user.id);
  if (!farmer) {
    redirect("/onboarding");
  }
  return farmer;
});
