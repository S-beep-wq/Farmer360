import { z } from "zod";

import { AREA_UNITS, IRRIGATION_TYPES, SOIL_TYPES } from "@/features/shared/land";
import { optionalChoice, optionalPositiveNumber, optionalText, optionalYesNo, requiredText } from "@/lib/forms";

import { checkBoundary, isValidLngLat, openRing, type LngLat } from "./location/geo";

/** Optional number in a range: "" becomes undefined. */
function optionalNumberInRange(min: number, max: number) {
  return z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const n = Number(v);
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: "invalidLocation" });
        return z.NEVER;
      }
      return n;
    });
}

/** The boundary arrives as JSON: an array of [longitude, latitude] corners. */
const boundaryField = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx): LngLat[] | undefined => {
    if (!v) return undefined;
    let parsed: unknown;
    try {
      parsed = JSON.parse(v);
    } catch {
      ctx.addIssue({ code: "custom", message: "invalidBoundary" });
      return z.NEVER;
    }
    if (!Array.isArray(parsed) || !parsed.every(isValidLngLat)) {
      ctx.addIssue({ code: "custom", message: "invalidBoundary" });
      return z.NEVER;
    }
    const points = openRing(parsed);
    const problem = checkBoundary(points);
    if (problem) {
      ctx.addIssue({ code: "custom", message: problem === "tooFewPoints" ? "boundaryTooFewPoints" : "invalidBoundary" });
      return z.NEVER;
    }
    return points;
  });

/**
 * Add-plot form (USER_WORKFLOWS.md section 4). Required: a name, and either an area or a boundary.
 * The location can come from the phone (device_gps) or a pin on the map (map_pin); when only a
 * boundary is given, the database uses its centre (boundary_centroid).
 */
export const plotSchema = z
  .object({
    name: requiredText(100),
    area: optionalPositiveNumber(),
    area_unit: optionalChoice(AREA_UNITS),
    latitude: optionalNumberInRange(-90, 90),
    longitude: optionalNumberInRange(-180, 180),
    location_source: optionalChoice(["device_gps", "map_pin"]),
    location_accuracy_m: optionalNumberInRange(0, 100000),
    boundary: boundaryField,
    irrigation_available: optionalYesNo(),
    irrigation_type: optionalChoice(IRRIGATION_TYPES),
    soil_type: optionalChoice(SOIL_TYPES),
    notes: optionalText(1000),
  })
  .superRefine((plot, ctx) => {
    if (plot.area === undefined && plot.boundary === undefined) {
      ctx.addIssue({ code: "custom", path: ["area"], message: "areaOrBoundaryRequired" });
    }
    const hasLat = plot.latitude !== undefined;
    const hasLng = plot.longitude !== undefined;
    if (hasLat !== hasLng || (hasLat && plot.location_source === undefined)) {
      ctx.addIssue({ code: "custom", path: ["location"], message: "invalidLocation" });
    }
  })
  .transform((plot) => {
    const hasPoint = plot.latitude !== undefined;
    return {
      ...plot,
      area_unit: plot.area === undefined ? undefined : (plot.area_unit ?? "acre"),
      location_source: hasPoint ? plot.location_source : undefined,
      // Accuracy is only meaningful for a phone (GPS) location.
      location_accuracy_m: hasPoint && plot.location_source === "device_gps" ? plot.location_accuracy_m : undefined,
      irrigation_type: plot.irrigation_available ? plot.irrigation_type : undefined,
    };
  });

export type PlotInput = z.infer<typeof plotSchema>;
