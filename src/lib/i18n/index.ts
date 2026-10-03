import { en, type ErrorKey, type Messages } from "./messages/en";
import { hi } from "./messages/hi";

export const LOCALES = ["hi", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Hindi first: the MVP starts in Bihar. */
export const DEFAULT_LOCALE: Locale = "hi";
export const LOCALE_COOKIE = "locale";

const MESSAGES: Record<Locale, Messages> = { hi, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}

/** Fills `{name}` placeholders. Unknown placeholders are left as they are. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export type { ErrorKey, Messages };
