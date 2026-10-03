import type { Farm } from "./repository";

/** "yes" / "no" / "" (don't know), as used by the yes/no form fields. */
export function yesNoValue(value: boolean | null): string {
  return value === null ? "" : value ? "yes" : "no";
}

/** A saved farm as form values, to prefill the edit form. */
export function farmFormValues(farm: Farm): Record<string, string> {
  return {
    name: farm.name,
    village: farm.village ?? "",
    total_area: farm.total_area === null ? "" : String(farm.total_area),
    area_unit: farm.area_unit ?? "",
    irrigation_available: yesNoValue(farm.irrigation_available),
    irrigation_type: farm.irrigation_type ?? "",
    soil_type: farm.soil_type ?? "",
  };
}
