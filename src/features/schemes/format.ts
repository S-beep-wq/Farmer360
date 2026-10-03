import { formatDate } from "@/features/crops/dates";
import { cropName, isSeason } from "@/features/crops/format";
import { format, type Locale, type Messages } from "@/lib/i18n";

import type { FarmerCrop } from "./repository";
import type { FarmerPlace, SchemeMatch } from "./rules";

/** Plain reasons a scheme is shown, e.g. ["For farmers in Patna district", "Your crops: Wheat · Rabi (winter)"]. */
export function matchReasons(match: SchemeMatch, farmer: FarmerPlace, crops: FarmerCrop[], t: Messages, locale: Locale): string[] {
  const reasons: string[] = [];
  if (match.area === "india") reasons.push(t.schemes.whyIndia);
  if (match.area === "state") reasons.push(format(t.schemes.whyState, { state: farmer.state }));
  if (match.area === "district") reasons.push(format(t.schemes.whyDistrict, { district: farmer.district }));
  if (match.crops.length > 0) {
    const names = new Set(
      match.crops.map((m) => {
        const crop = crops.find((c) => c.crop_id === m.crop_id && c.season === m.season);
        const name = crop ? cropName(crop.crop, locale) : "";
        return isSeason(m.season) ? `${name} · ${t.seasons[m.season]}` : name;
      }),
    );
    reasons.push(format(t.schemes.whyCrops, { crops: [...names].join(", ") }));
  } else if (!match.cropMismatch) {
    reasons.push(t.schemes.anyCrop);
  }
  return reasons;
}

export function deadlineText(deadline: string | null, passed: boolean, t: Messages, locale: Locale): string {
  if (!deadline) return t.schemes.noDeadline;
  const date = formatDate(deadline, locale);
  return format(passed ? t.schemes.deadlinePassed : t.schemes.deadline, { date });
}
