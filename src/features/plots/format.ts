import { AREA_UNITS, fromSquareMetres, roundArea, type AreaUnit } from "@/features/shared/land";
import type { Locale, Messages } from "@/lib/i18n";

function isAreaUnit(value: string | null): value is AreaUnit {
  return value !== null && (AREA_UNITS as readonly string[]).includes(value);
}

function numberFormat(locale: Locale) {
  return new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", { maximumFractionDigits: 2 });
}

/** "1.25 Acre" / "1.25 एकड़", or null when there is no area. */
export function formatArea(value: number | null, unit: string | null, t: Messages, locale: Locale): string | null {
  if (value === null || !isAreaUnit(unit)) return null;
  return `${numberFormat(locale).format(roundArea(value, unit))} ${t.units[unit]}`;
}

/**
 * Map-measured area in the units farmers in Bihar use most: acres and decimals.
 * e.g. "0.28 Acre (28 Decimal (dismil))".
 */
export function formatMeasuredArea(sqM: number, t: Messages, locale: Locale): string {
  const nf = numberFormat(locale);
  const acres = roundArea(fromSquareMetres(sqM, "acre"), "acre");
  const decimals = roundArea(fromSquareMetres(sqM, "decimal"), "decimal");
  return `${nf.format(acres)} ${t.units.acre} (${nf.format(decimals)} ${t.units.decimal})`;
}
