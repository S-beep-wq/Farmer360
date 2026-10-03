// Values must match supabase/migrations/20261003073427_slice8_crop_observations.sql (DATABASE.md 10–11).

export const HEALTH_STATUSES = ["HEALTHY", "PROBLEM", "SERIOUS", "NOT_SURE"] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export const PHOTO_BUCKET = "crop-photos";

/** Same limit as the storage bucket. Photos are made smaller in the browser before upload. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
