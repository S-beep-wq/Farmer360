import { z } from "zod";

import { isIsoDate } from "@/features/crops/dates";
import { PRODUCE_UNITS } from "@/features/harvest-sales/constants";
import { optionalPositiveNumber, optionalText, optionalYesNo, requiredText } from "@/lib/forms";
import { LOCALES } from "@/lib/i18n";

import { DEMAND_TYPES, MARKET_AREAS, MARKET_BUYER_TYPES } from "./constants";

/** Buyer registration and profile (USER_WORKFLOWS.md section 14, buyer side). */
export const buyerProfileSchema = z.object({
  name: requiredText(100),
  organization_name: optionalText(100),
  buyer_type: z.enum(MARKET_BUYER_TYPES, { error: "invalidChoice" }),
  preferred_language: z.enum(LOCALES, { error: "invalidChoice" }),
  state: requiredText(100),
  district: requiredText(100),
  location: requiredText(100),
});

export type BuyerProfileInput = z.infer<typeof buyerProfileSchema>;

/** A buyer's demand: crop, quantity, quality, date, place and payment terms. */
export function demandSchema(today: string) {
  return z
    .object({
      crop_id: z.uuid({ error: "invalidChoice" }),
      quantity: optionalPositiveNumber().refine((v) => v !== undefined, "required"),
      quantity_unit: z.enum(PRODUCE_UNITS, { error: "chooseUnit" }),
      demand_type: z.enum(DEMAND_TYPES, { error: "invalidChoice" }),
      quality_requirements: optionalText(500),
      required_date: z
        .string({ error: "required" })
        .trim()
        .min(1, "required")
        .refine(isIsoDate, "invalidDate")
        .refine((d) => d >= today, "pastDate"),
      state: requiredText(100),
      district: requiredText(100),
      location: requiredText(100),
      pickup_available: optionalYesNo().refine((v) => v !== null && v !== undefined, "invalidChoice"),
      payment_terms: optionalText(300),
    })
    .transform((d) => ({ ...d, quantity: d.quantity as number, pickup_available: d.pickup_available as boolean }));
}

export type DemandInput = z.infer<ReturnType<typeof demandSchema>>;

/** A farmer saying they are interested; they must agree to share their contact details. */
export const interestSchema = z.object({
  share_contact: z.literal("yes", { error: "confirmShareContact" }),
  note: optionalText(500),
});

/** The market's search filters, from the URL. Anything invalid is simply ignored. */
export const marketFilterSchema = z.object({
  crop: z.uuid().optional().catch(undefined),
  area: z.enum(MARKET_AREAS).optional().catch(undefined),
  have: optionalPositiveNumber().optional().catch(undefined),
  have_unit: z.enum(PRODUCE_UNITS).optional().catch(undefined),
});

export type MarketFilters = z.infer<typeof marketFilterSchema>;
