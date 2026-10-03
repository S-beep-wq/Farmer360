// Shared land vocabulary for farms and plots. Values must match the CHECK
// constraints in supabase/migrations (see DATABASE.md sections 4 and 5).

export const AREA_UNITS = ["acre", "decimal", "hectare"] as const;
export type AreaUnit = (typeof AREA_UNITS)[number];

/** Square metres in one unit. 1 decimal (dismil) = 1/100 acre. */
export const SQ_M_PER_UNIT: Record<AreaUnit, number> = {
  acre: 4046.8564224,
  decimal: 40.468564224,
  hectare: 10000,
};

export function toSquareMetres(value: number, unit: AreaUnit): number {
  return value * SQ_M_PER_UNIT[unit];
}

export function fromSquareMetres(sqM: number, unit: AreaUnit): number {
  return sqM / SQ_M_PER_UNIT[unit];
}

/** Rounds an area for display: 2 decimals for acre/hectare, whole numbers for decimal. */
export function roundArea(value: number, unit: AreaUnit): number {
  const factor = unit === "decimal" ? 1 : 100;
  return Math.round(value * factor) / factor;
}

export const IRRIGATION_TYPES = ["tubewell", "canal", "well", "pond_or_river", "other"] as const;
export type IrrigationType = (typeof IRRIGATION_TYPES)[number];

export const SOIL_TYPES = [
  "loam",
  "clay",
  "sandy",
  "sandy_loam",
  "clay_loam",
  "other",
  "unknown",
] as const;
export type SoilType = (typeof SOIL_TYPES)[number];

export const LOCATION_SOURCES = ["device_gps", "map_pin", "boundary_centroid"] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];
