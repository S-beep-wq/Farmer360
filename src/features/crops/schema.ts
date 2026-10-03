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

// ---------------------------------------------------------------------------
// Status changes and edits. `today` is the farmer's date in India.
// ---------------------------------------------------------------------------

/** Record sowing for a planned crop (PLANNED → ACTIVE). The expected harvest can be adjusted at the same time. */
export function recordSowingSchema(today: string) {
  return z
    .object({ actual_sowing_date: date, expected_harvest_date: optionalDate })
    .superRefine((v, ctx) => {
      if (v.actual_sowing_date > today) {
        ctx.addIssue({ code: "custom", path: ["actual_sowing_date"], message: "futureSowingDate" });
      }
      if (v.expected_harvest_date && v.expected_harvest_date < v.actual_sowing_date) {
        ctx.addIssue({ code: "custom", path: ["expected_harvest_date"], message: "harvestBeforeSowing" });
      }
    });
}

/** Record that the harvest is finished (ACTIVE → HARVESTED). */
export function recordHarvestSchema(today: string, actualSowingDate: string) {
  return z.object({ actual_harvest_date: date }).superRefine((v, ctx) => {
    if (v.actual_harvest_date > today) {
      ctx.addIssue({ code: "custom", path: ["actual_harvest_date"], message: "futureHarvestDate" });
    } else if (v.actual_harvest_date < actualSowingDate) {
      ctx.addIssue({ code: "custom", path: ["actual_harvest_date"], message: "harvestBeforeSowing" });
    }
  });
}

/**
 * Change a crop's details. Which dates can be changed depends on the status: a planned crop has a
 * planned sowing date; a crop in the field has its sowing date; a harvested crop also its harvest date.
 */
export function editCropCycleSchema(today: string, status: "PLANNED" | "ACTIVE" | "HARVESTED") {
  // Dates that do not apply to this status are ignored, whatever the browser sends.
  const ignored = z.unknown().optional().transform((): undefined => undefined);
  return z
    .object({
      crop_id: z.uuid({ error: "invalidChoice" }),
      variety_name: optionalText(100),
      season: z.enum(SEASONS, { error: "invalidChoice" }),
      planned_sowing_date: status === "PLANNED" ? date : ignored,
      actual_sowing_date: status === "PLANNED" ? ignored : date,
      actual_harvest_date: status === "HARVESTED" ? date : ignored,
      expected_harvest_date: optionalDate,
    })
    .superRefine((v, ctx) => {
      const sowing = v.actual_sowing_date ?? v.planned_sowing_date;
      if (v.actual_sowing_date && v.actual_sowing_date > today) {
        ctx.addIssue({ code: "custom", path: ["actual_sowing_date"], message: "futureSowingDate" });
      }
      if (v.actual_harvest_date) {
        if (v.actual_harvest_date > today) {
          ctx.addIssue({ code: "custom", path: ["actual_harvest_date"], message: "futureHarvestDate" });
        } else if (sowing && v.actual_harvest_date < sowing) {
          ctx.addIssue({ code: "custom", path: ["actual_harvest_date"], message: "harvestBeforeSowing" });
        }
      }
      if (v.expected_harvest_date && sowing && v.expected_harvest_date < sowing) {
        ctx.addIssue({ code: "custom", path: ["expected_harvest_date"], message: "harvestBeforeSowing" });
      }
    });
}

export type CropCycleEditInput = z.infer<ReturnType<typeof editCropCycleSchema>>;
