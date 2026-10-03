import { z } from "zod";

import { isIsoDate } from "@/features/crops/dates";
import { optionalRupees, requiredRupees } from "@/features/shared/money";
import { QUANTITY_UNITS } from "@/features/shared/land";
import { optionalChoice, optionalPositiveNumber, optionalText } from "@/lib/forms";

import { ACTIVITY_TYPES, EXPENSE_CATEGORIES } from "./constants";

/** A date that has already happened (or is today, in India). Work and costs are recorded, not planned. */
function pastOrToday(today: string) {
  return z
    .string({ error: "required" })
    .trim()
    .min(1, "required")
    .refine(isIsoDate, "invalidDate")
    .refine((d) => d <= today, "futureDate");
}

const quantityFields = {
  quantity: optionalPositiveNumber(),
  quantity_unit: optionalChoice(QUANTITY_UNITS),
};

/** A quantity needs a unit; a unit without a quantity is dropped. */
function withQuantityRules<T extends { quantity?: number; quantity_unit?: (typeof QUANTITY_UNITS)[number] }>(
  value: T,
  ctx: z.RefinementCtx,
) {
  if (value.quantity !== undefined && value.quantity_unit === undefined) {
    ctx.addIssue({ code: "custom", path: ["quantity"], message: "chooseUnit" });
  }
}

function dropUnitWithoutQuantity<T extends { quantity?: number; quantity_unit?: string }>(value: T): T {
  return value.quantity === undefined ? { ...value, quantity_unit: undefined } : value;
}

/** Record work done on a crop (USER_WORKFLOWS.md section 7). */
export function activitySchema(today: string) {
  return z
    .object({
      activity_type: z.enum(ACTIVITY_TYPES, { error: "invalidChoice" }),
      activity_date: pastOrToday(today),
      ...quantityFields,
      cost: optionalRupees(),
      notes: optionalText(1000),
    })
    .superRefine(withQuantityRules)
    .transform(dropUnitWithoutQuantity);
}

export type ActivityInput = z.infer<ReturnType<typeof activitySchema>>;

/** Record a cost for a crop (USER_WORKFLOWS.md section 12). */
export function expenseSchema(today: string) {
  return z
    .object({
      category: z.enum(EXPENSE_CATEGORIES, { error: "invalidChoice" }),
      amount: requiredRupees(),
      expense_date: pastOrToday(today),
      ...quantityFields,
      vendor: optionalText(100),
      notes: optionalText(1000),
    })
    .superRefine(withQuantityRules)
    .transform(dropUnitWithoutQuantity);
}

export type ExpenseInput = z.infer<ReturnType<typeof expenseSchema>>;
