import { redirect } from "next/navigation";

import { getCurrentUser, getRoleHome } from "@/lib/auth";

/** Sends each visitor to the right first screen. */
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(await getRoleHome(user.id));
}
