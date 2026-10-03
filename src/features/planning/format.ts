import { formatProduce } from "@/features/harvest-sales/format";
import { displayWeight } from "@/features/season-review/summary";
import { formatRupees } from "@/features/shared/money";
import { format, type Locale, type Messages } from "@/lib/i18n";

import type { Range } from "./engine";

/** "₹12,000" or "₹9,000 to ₹15,000 (average ₹12,000)". */
export function formatRange(r: Range, value: (n: number) => string, t: Messages): string {
  if (r.count === 1 || r.min === r.max) return value(r.min);
  return format(t.planning.rangeAverage, { min: value(r.min), max: value(r.max), average: value(r.average) });
}

export const rupees = (locale: Locale) => (n: number) => formatRupees(Math.round(n), locale);

export const weight = (t: Messages, locale: Locale) => (kg: number) => {
  const { quantity, unit } = displayWeight(kg);
  return formatProduce(quantity, unit, t, locale);
};

export const days = (t: Messages) => (n: number) => format(t.planning.days, { count: Math.round(n) });
