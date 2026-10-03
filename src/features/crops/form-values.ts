import type { CropCycle } from "./repository";

/** A saved crop cycle as edit-form values. */
export function cropCycleFormValues(cycle: CropCycle): Record<string, string> {
  return {
    crop_id: cycle.crop.id,
    variety_name: cycle.variety_name ?? "",
    season: cycle.season,
    planned_sowing_date: cycle.planned_sowing_date ?? "",
    actual_sowing_date: cycle.actual_sowing_date ?? "",
    actual_harvest_date: cycle.actual_harvest_date ?? "",
    expected_harvest_date: cycle.expected_harvest_date ?? "",
  };
}
