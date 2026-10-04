"use server";

import { redirect } from "next/navigation";

import { getFarmerForUser } from "@/features/farmer/repository";
import { requireUser } from "@/lib/auth";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { deleteAccount, removeAllPhotos, requestAccountDeletion } from "./repository";
import { isDeletionConfirmed } from "./rules";

/**
 * Deletes the farmer's account: request deletion → remove their photos from storage → delete the
 * user (and, by cascade, all farmer data) → sign out. Safe to run again if a step fails.
 */
export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ skipConsent: true });
  if (!isDeletionConfirmed(formData)) {
    return { fieldErrors: { confirm: "confirmDeletion" } };
  }

  const supabase = await createClient();
  const farmer = await getFarmerForUser(supabase, user.id);
  if (farmer) {
    const requested = await requestAccountDeletion(supabase, user.id);
    const photos = requested.error ? requested : await removeAllPhotos(supabase);
    if (photos.error) {
      console.error("deleteAccount: photo cleanup failed", { userId: user.id, message: photos.error.message });
      return { formError: "accountDeletionFailed" };
    }
  }

  const { error } = await deleteAccount(supabase);
  if (error) {
    console.error("deleteAccount failed", { userId: user.id, code: error.code });
    return { formError: "accountDeletionFailed" };
  }

  // The user no longer exists; only the session cookies are left to clear.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?deleted=1");
}
