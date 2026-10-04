import { redirect } from "next/navigation";

import { getRoleHome, requireUser } from "@/lib/auth";

/** Sends each visitor to the right first screen. */
export default async function Home() {
  const user = await requireUser();
  redirect(await getRoleHome(user.id));
}
