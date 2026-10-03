import { z } from "zod";

import { AREA_UNITS, IRRIGATION_TYPES, SOIL_TYPES } from "@/features/shared/land";
import { optionalChoice, optionalPositiveNumber, optionalText, optionalYesNo, requiredText } from "@/lib/forms";

/** Add-farm form (USER_WORKFLOWS.md section 3). Only the name is required. */
export const farmSchema = z
  .object({
    name: requiredText(100),
    village: optionalText(100),
    total_area: optionalPositiveNumber(),
    area_unit: optionalChoice(AREA_UNITS),
    irrigation_available: optionalYesNo(),
    irrigation_type: optionalChoice(IRRIGATION_TYPES),
    soil_type: optionalChoice(SOIL_TYPES),
  })
  .transform((farm) => ({
    ...farm,
    // A unit only means something together with an area.
    area_unit: farm.total_area === undefined ? undefined : (farm.area_unit ?? "acre"),
    // A water source only means something when there is irrigation.
    irrigation_type: farm.irrigation_available ? farm.irrigation_type : undefined,
  }));

export type FarmInput = z.infer<typeof farmSchema>;

export const idSchema = z.uuid();

export function isId(value: string): boolean {
  return idSchema.safeParse(value).success;
}
