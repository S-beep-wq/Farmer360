import { z } from "zod";

import { requiredText } from "@/lib/forms";
import { LOCALES } from "@/lib/i18n";

/** Onboarding form (USER_WORKFLOWS.md section 2). Phone comes from the verified login, not the form. */
export const farmerProfileSchema = z.object({
  full_name: requiredText(100),
  preferred_language: z.enum(LOCALES, { error: "invalidChoice" }),
  state: requiredText(100),
  district: requiredText(100),
  village: requiredText(100),
});

export type FarmerProfileInput = z.infer<typeof farmerProfileSchema>;
