import { redirect } from "next/navigation";

import { getFarmerForUser } from "@/features/farmer/repository";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Sends each visitor to the right first screen. */
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const farmer = await getFarmerForUser(await createClient(), user.id);
  redirect(farmer ? "/farms" : "/onboarding");
}
