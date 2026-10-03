import { z } from "zod";

import { isIsoDate } from "@/features/crops/dates";
import { optionalRupees, requiredRupees } from "@/features/shared/money";
import { optionalChoice, optionalText, optionalPositiveNumber } from "@/lib/forms";

import { BUYER_TYPES, PAYMENT_STATUSES, PRODUCE_UNITS, QUALITY_GRADES } from "./constants";
import { toKg } from "./quantities";

function dateBetween(earliest: string, today: string, beforeEarliest: "harvestBeforeSowing" | "saleBeforeHarvest") {
  return z
    .string({ error: "required" })
    .trim()
    .min(1, "required")
    .refine(isIsoDate, "invalidDate")
    .refine((d) => d <= today, "futureDate")
    .refine((d) => d >= earliest, beforeEarliest);
}

const requiredQuantity = optionalPositiveNumber().refine((v) => v !== undefined, "required");

/**
 * Record a harvest (USER_WORKFLOWS.md section 13). `sowingDate` is the crop's actual sowing date;
 * `soldKg` is what has already been sold from this harvest (0 for a new one), so an edit cannot
 * make the harvest smaller than its sales.
 */
export function harvestSchema(today: string, sowingDate: string, soldKg = 0) {
  return z
    .object({
      harvest_date: dateBetween(sowingDate, today, "harvestBeforeSowing"),
      quantity: requiredQuantity,
      quantity_unit: z.enum(PRODUCE_UNITS, { error: "chooseUnit" }),
      quality_grade: optionalChoice(QUALITY_GRADES),
      notes: optionalText(1000),
    })
    .superRefine((h, ctx) => {
      if (h.quantity !== undefined && toKg(h.quantity, h.quantity_unit) < soldKg) {
        ctx.addIssue({ code: "custom", path: ["quantity"], message: "harvestLessThanSold" });
      }
    })
    .transform((h) => ({ ...h, quantity: h.quantity as number }));
}

export type HarvestInput = z.infer<ReturnType<typeof harvestSchema>>;

/**
 * Record a sale from a harvest (USER_WORKFLOWS.md section 15). `availableKg` is how much of the
 * harvest is still unsold (for an edit, including this sale's own quantity).
 */
export function saleSchema(today: string, harvestDate: string, availableKg: number) {
  return z
    .object({
      buyer_type: z.enum(BUYER_TYPES, { error: "invalidChoice" }),
      buyer_name: optionalText(100),
      sale_date: dateBetween(harvestDate, today, "saleBeforeHarvest"),
      quantity: requiredQuantity,
      quantity_unit: z.enum(PRODUCE_UNITS, { error: "chooseUnit" }),
      price_per_unit: requiredRupees(),
      transport_cost: optionalRupees(),
      other_cost: optionalRupees(),
      payment_status: z.enum(PAYMENT_STATUSES, { error: "invalidChoice" }),
      notes: optionalText(1000),
    })
    .superRefine((s, ctx) => {
      if (s.quantity !== undefined && toKg(s.quantity, s.quantity_unit) > availableKg) {
        ctx.addIssue({ code: "custom", path: ["quantity"], message: "moreThanHarvested" });
      }
    })
    .transform((s) => ({ ...s, quantity: s.quantity as number }));
}

export type SaleInput = z.infer<ReturnType<typeof saleSchema>>;
