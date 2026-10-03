import type { CropCycleStatus } from "./constants";

// What a farmer can do with a crop in each status. The database enforces the same status
// changes (see supabase/migrations/20261003053318_slice4_crop_status_changes.sql).

export type CropCycleAction = "recordSowing" | "recordHarvest" | "cancel" | "edit";

const ACTIONS: Record<CropCycleStatus, readonly CropCycleAction[]> = {
  PLANNED: ["recordSowing", "edit", "cancel"],
  ACTIVE: ["recordHarvest", "edit", "cancel"],
  HARVESTED: ["edit"],
  // Final: kept as history, no longer changed. COMPLETED is set by the season review (not built yet).
  COMPLETED: [],
  CANCELLED: [],
};

export function availableActions(status: CropCycleStatus): readonly CropCycleAction[] {
  return ACTIONS[status];
}

export function canDo(status: CropCycleStatus, action: CropCycleAction): boolean {
  return ACTIONS[status].includes(action);
}
