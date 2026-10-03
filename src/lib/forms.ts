import { z } from "zod";

import type { ErrorKey } from "@/lib/i18n";
import { en } from "@/lib/i18n/messages/en";

/**
 * Result of a form Server Action. Errors are message keys, so the page can
 * show them in the farmer's language. `values` echoes what was typed so the
 * form keeps it after a failed submit.
 */
export type FormState = {
  fieldErrors?: Record<string, ErrorKey>;
  formError?: ErrorKey;
  values?: Record<string, string>;
};

export const initialFormState: FormState = {};

export function isErrorKey(value: unknown): value is ErrorKey {
  return typeof value === "string" && value in en.errors;
}

/** First error per top-level field. Schemas use ErrorKeys as their messages. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, ErrorKey> {
  const result: Record<string, ErrorKey> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!(field in result)) {
      result[field] = isErrorKey(issue.message) ? issue.message : "generic";
    }
  }
  return result;
}

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) {
      values[key] = value;
    }
  }
  return values;
}

// ---------------------------------------------------------------------------
// Reusable field schemas for FormData input (every value arrives as a string).
// ---------------------------------------------------------------------------

/** Required text, trimmed. */
export function requiredText(max = 100) {
  return z.string({ error: "required" }).trim().min(1, "required").max(max, "tooLong");
}

/** Optional text: "" becomes undefined. */
export function optionalText(max = 1000) {
  return z
    .string()
    .trim()
    .max(max, "tooLong")
    .optional()
    .transform((v) => (v ? v : undefined));
}

/** Optional choice from a fixed list: "" becomes undefined. */
export function optionalChoice<const T extends readonly [string, ...string[]]>(options: T) {
  return z
    .union([z.literal(""), z.enum(options, { error: "invalidChoice" })], { error: "invalidChoice" })
    .optional()
    .transform((v) => (v ? v : undefined) as T[number] | undefined);
}

/** Optional number greater than 0: "" becomes undefined. Accepts "1,5" as 1.5. */
export function optionalPositiveNumber() {
  return z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const n = Number(v.replace(",", "."));
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: "custom", message: "invalidNumber" });
        return z.NEVER;
      }
      if (n <= 0) {
        ctx.addIssue({ code: "custom", message: "positiveNumber" });
        return z.NEVER;
      }
      return n;
    });
}

/** "yes" | "no" | "" (don't know) → boolean | undefined. */
export function optionalYesNo() {
  return z
    .enum(["yes", "no", ""], { error: "invalidChoice" })
    .optional()
    .transform((v) => (v === "yes" ? true : v === "no" ? false : undefined));
}
