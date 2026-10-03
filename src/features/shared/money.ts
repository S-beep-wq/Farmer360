import { z } from "zod";

import type { Locale } from "@/lib/i18n";

// Rupee amounts. In India "2,500" means two thousand five hundred, so commas are thousands
// separators here (unlike area fields, where a comma may be a decimal mark).

export const MAX_RUPEES = 9_999_999_999.99;

/** "₹ 2,500.50" / "2500" → 2500.5, or null if it is not a valid amount. */
export function parseRupees(input: string): number | null {
  const cleaned = input.replace(/[₹\s,]/g, "").replace(/^rs\.?/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** "₹2,500" / "₹2,500.50" in Indian digit grouping. */
export function formatRupees(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Sums rupee amounts exactly (in paise), so 0.1 + 0.2 is 0.3. */
export function sumRupees(amounts: (number | null | undefined)[]): number {
  const paise = amounts.reduce<number>((total, a) => total + (a ? Math.round(a * 100) : 0), 0);
  return paise / 100;
}

function rupees(required: boolean) {
  return z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) {
        if (required) {
          ctx.addIssue({ code: "custom", message: "required" });
          return z.NEVER;
        }
        return undefined;
      }
      const value = parseRupees(v);
      if (value === null) {
        ctx.addIssue({ code: "custom", message: "invalidAmount" });
        return z.NEVER;
      }
      if (value <= 0 || value > MAX_RUPEES) {
        ctx.addIssue({ code: "custom", message: "positiveNumber" });
        return z.NEVER;
      }
      return value;
    });
}

export const requiredRupees = () => rupees(true).transform((v) => v as number);
export const optionalRupees = () => rupees(false);
