// Values must match supabase/migrations/20261003062409_slice6_harvests_and_sales.sql (DATABASE.md 13, 16).

export const PRODUCE_UNITS = ["kg", "quintal", "tonne"] as const;
export type ProduceUnit = (typeof PRODUCE_UNITS)[number];

/** Kilograms in one unit; the same factors as public.produce_unit_kg() in the database. */
export const KG_PER_UNIT: Record<ProduceUnit, number> = { kg: 1, quintal: 100, tonne: 1000 };

export const QUALITY_GRADES = ["GOOD", "AVERAGE", "POOR"] as const;
export type QualityGrade = (typeof QUALITY_GRADES)[number];

export const BUYER_TYPES = [
  "LOCAL_TRADER",
  "MANDI",
  "GOVERNMENT_PROCUREMENT",
  "FPO",
  "COMPANY",
  "CONSUMER",
  "OTHER",
] as const;
export type BuyerType = (typeof BUYER_TYPES)[number];

export const PAYMENT_STATUSES = ["PAID", "PARTIAL", "PENDING"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
