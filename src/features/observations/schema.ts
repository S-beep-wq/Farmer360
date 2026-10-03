import { z } from "zod";

import { isIsoDate } from "@/features/crops/dates";
import { optionalText } from "@/lib/forms";

import { HEALTH_STATUSES } from "./constants";

/**
 * The text part of a crop observation (USER_WORKFLOWS.md section 8). The photo is checked
 * separately (see photo.ts); an observation needs a photo or a note, or both.
 */
export function observationSchema(today: string, sowingDate: string) {
  return z.object({
    observation_date: z
      .string({ error: "required" })
      .trim()
      .min(1, "required")
      .refine(isIsoDate, "invalidDate")
      .refine((d) => d <= today, "futureDate")
      .refine((d) => d >= sowingDate, "observationBeforeSowing"),
    health_status: z.enum(HEALTH_STATUSES, { error: "invalidChoice" }),
    farmer_notes: optionalText(1000),
  });
}

export type ObservationInput = z.infer<ReturnType<typeof observationSchema>>;
