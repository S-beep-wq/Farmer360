import { format, type Locale, type Messages } from "@/lib/i18n";

import { CROP_CYCLE_STATUSES, SEASONS, type CropCycleStatus, type Season } from "./constants";
import { formatDate } from "./dates";

/** Crop name in the farmer's language. Crop names come from the catalog, not from message files. */
export function cropName(crop: { name: string; name_hi: string }, locale: Locale): string {
  return locale === "hi" ? crop.name_hi : crop.name;
}

export function isSeason(value: string): value is Season {
  return (SEASONS as readonly string[]).includes(value);
}

export function isCropCycleStatus(value: string): value is CropCycleStatus {
  return (CROP_CYCLE_STATUSES as readonly string[]).includes(value);
}

/** "Sown on 12 Nov 2026" or "Sowing planned for 1 Dec 2026". */
export function sowingSummary(
  cycle: { actual_sowing_date: string | null; planned_sowing_date: string | null },
  t: Messages,
  locale: Locale,
): string | null {
  if (cycle.actual_sowing_date) {
    return format(t.crops.sownOn, { date: formatDate(cycle.actual_sowing_date, locale) });
  }
  if (cycle.planned_sowing_date) {
    return format(t.crops.plannedFor, { date: formatDate(cycle.planned_sowing_date, locale) });
  }
  return null;
}
