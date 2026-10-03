import type { Locale, Messages } from "@/lib/i18n";

import { isProduceUnit } from "./quantities";

/** "12.5 quintal" / "12.5 क्विंटल". */
export function formatProduce(quantity: number, unit: string, t: Messages, locale: Locale): string {
  const n = new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", { maximumFractionDigits: 3 }).format(quantity);
  return isProduceUnit(unit) ? `${n} ${t.produceUnits[unit]}` : `${n} ${unit}`;
}
