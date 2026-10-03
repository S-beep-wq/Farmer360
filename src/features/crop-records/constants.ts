// Values must match the CHECK constraints in
// supabase/migrations/20261003054621_slice5_crop_activities_and_expenses.sql (DATABASE.md sections 9, 12).

export const ACTIVITY_TYPES = [
  "LAND_PREPARATION",
  "SOWING",
  "IRRIGATION",
  "FERTILIZATION",
  "WEEDING",
  "CROP_PROTECTION",
  "LABOUR",
  "MACHINERY",
  "HARVEST_PREPARATION",
  "OTHER",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  "SEED",
  "FERTILIZER",
  "CROP_PROTECTION",
  "LABOUR",
  "MACHINERY",
  "IRRIGATION",
  "TRANSPORT",
  "OTHER",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
