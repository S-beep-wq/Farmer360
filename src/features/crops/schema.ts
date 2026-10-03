import { z } from "zod";

import { optionalText } from "@/lib/forms";

import { SEASONS } from "./constants";
import { isIsoDate } from "./dates";

const date = z.string({ error: "required" }).trim().min(1, "required").refine(isIsoDate, "invalidDate");

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    if (!isIsoDate(v)) {
      ctx.addIssue({ code: "custom", message: "invalidDate" });
      return z.NEVER;
    }
    return v;
  });

/**
 * Add-crop form (USER_WORKFLOWS.md section 6). The farmer says whether the crop is already sown:
 * - not yet → the date is the planned sowing date and the cycle is PLANNED;
 * - already sown → the date is the actual sowing date and the cycle is ACTIVE.
 * `today` is the farmer's date in India, passed in so the rule can be tested.
 */
export function cropCycleSchema(today: string) {
  return z
    .object({
      crop_id: z.uuid({ error: "invalidChoice" }),
      variety_name: optionalText(100),
      season: z.enum(SEASONS, { error: "invalidChoice" }),
      already_sown: z.enum(["yes", "no"], { error: "invalidChoice" }),
      sowing_date: date,
      expected_harvest_date: optionalDate,
    })
    .superRefine((cycle, ctx) => {
      if (cycle.already_sown === "yes" && cycle.sowing_date > today) {
        ctx.addIssue({ code: "custom", path: ["sowing_date"], message: "futureSowingDate" });
      }
      if (cycle.expected_harvest_date && cycle.expected_harvest_date < cycle.sowing_date) {
        ctx.addIssue({ code: "custom", path: ["expected_harvest_date"], message: "harvestBeforeSowing" });
      }
    })
    .transform(({ already_sown, sowing_date, ...cycle }) => ({
      ...cycle,
      status: already_sown === "yes" ? ("ACTIVE" as const) : ("PLANNED" as const),
      planned_sowing_date: already_sown === "yes" ? undefined : sowing_date,
      actual_sowing_date: already_sown === "yes" ? sowing_date : undefined,
    }));
}

export type CropCycleInput = z.infer<ReturnType<typeof cropCycleSchema>>;
