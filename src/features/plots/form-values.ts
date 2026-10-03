import { yesNoValue } from "@/features/farms/form-values";

import type { LngLat, PlotPoint } from "./location/geo";
import type { Plot } from "./repository";

/** A saved plot as form values, to prefill the edit form. */
export function plotFormValues(plot: Plot): Record<string, string> {
  return {
    name: plot.name,
    area: plot.area === null ? "" : String(plot.area),
    area_unit: plot.area_unit ?? "",
    irrigation_available: yesNoValue(plot.irrigation_available),
    irrigation_type: plot.irrigation_type ?? "",
    soil_type: plot.soil_type ?? "",
  };
}

/**
 * The saved location to start the map with when editing. A point that was only the centre of
 * the boundary is not shown as a pin: the database recalculates it from the boundary on save.
 */
export function plotInitialLocation(plot: Plot): { point: PlotPoint | null; boundary: LngLat[] } {
  const source = plot.location_source;
  let point: PlotPoint | null = null;
  if (plot.latitude !== null && plot.longitude !== null && (source === "device_gps" || source === "map_pin")) {
    point = { lat: plot.latitude, lng: plot.longitude, source };
    if (source === "device_gps" && plot.location_accuracy_m !== null) {
      point.accuracyM = plot.location_accuracy_m;
    }
  }
  return { point, boundary: plot.boundary ?? [] };
}
