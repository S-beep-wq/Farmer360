// Crop cycle vocabulary. Values must match the CHECK constraints in
// supabase/migrations/20261003052122_slice3_crop_catalog_and_cycles.sql (DATABASE.md section 8).

export const SEASONS = ["kharif", "rabi", "zaid"] as const;
export type Season = (typeof SEASONS)[number];

export const CROP_CYCLE_STATUSES = ["PLANNED", "ACTIVE", "HARVESTED", "COMPLETED", "CANCELLED"] as const;
export type CropCycleStatus = (typeof CROP_CYCLE_STATUSES)[number];

/** Statuses of a crop that is still planned or in the field. */
export const OPEN_STATUSES: readonly CropCycleStatus[] = ["PLANNED", "ACTIVE"];
