import { describe, expect, it } from "vitest";

import { farmFormValues, yesNoValue } from "@/features/farms/form-values";
import type { Farm } from "@/features/farms/repository";
import { farmSchema } from "@/features/farms/schema";
import { plotFormValues, plotInitialLocation } from "@/features/plots/form-values";
import type { Plot } from "@/features/plots/repository";
import { plotSchema } from "@/features/plots/schema";

const FARM: Farm = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Near the house",
  state: "Bihar",
  district: "Patna",
  village: "Bihta",
  total_area: 2.5,
  area_unit: "acre",
  irrigation_available: true,
  irrigation_type: "tubewell",
  soil_type: "loam",
  created_at: "2026-10-03T00:00:00Z",
};

const PLOT: Plot = {
  id: "22222222-2222-4222-8222-222222222222",
  farm_id: FARM.id,
  name: "Plot 1",
  area: null,
  area_unit: null,
  latitude: 25.61,
  longitude: 85.14,
  location_source: "device_gps",
  location_accuracy_m: 9,
  boundary_area_sq_m: 11137.56,
  soil_type: null,
  irrigation_available: false,
  irrigation_type: null,
  notes: null,
  created_at: "2026-10-03T00:00:00Z",
  boundary: [
    [85.0, 25.5],
    [85.001, 25.5],
    [85.001, 25.501],
    [85.0, 25.501],
  ],
};

describe("yesNoValue", () => {
  it("maps booleans to the yes/no/don't-know choices", () => {
    expect([yesNoValue(true), yesNoValue(false), yesNoValue(null)]).toEqual(["yes", "no", ""]);
  });
});

describe("farmFormValues", () => {
  it("prefills the edit form, and saving it unchanged gives the same farm", () => {
    const values = farmFormValues(FARM);
    expect(values).toEqual({
      name: "Near the house",
      village: "Bihta",
      total_area: "2.5",
      area_unit: "acre",
      irrigation_available: "yes",
      irrigation_type: "tubewell",
      soil_type: "loam",
    });
    expect(farmSchema.parse(values)).toMatchObject({
      name: FARM.name,
      village: FARM.village,
      total_area: FARM.total_area,
      area_unit: FARM.area_unit,
      irrigation_available: true,
      irrigation_type: "tubewell",
      soil_type: "loam",
    });
  });

  it("leaves unknown values empty", () => {
    const values = farmFormValues({ ...FARM, village: null, total_area: null, area_unit: null, irrigation_available: null, irrigation_type: null, soil_type: null });
    expect(values).toMatchObject({ village: "", total_area: "", area_unit: "", irrigation_available: "", soil_type: "" });
  });
});

describe("plotFormValues", () => {
  it("prefills the edit form", () => {
    expect(plotFormValues(PLOT)).toEqual({
      name: "Plot 1",
      area: "",
      area_unit: "",
      irrigation_available: "no",
      irrigation_type: "",
      soil_type: "",
    });
  });
});

describe("plotInitialLocation", () => {
  it("keeps a phone location with its accuracy, and the boundary", () => {
    expect(plotInitialLocation(PLOT)).toEqual({
      point: { lat: 25.61, lng: 85.14, source: "device_gps", accuracyM: 9 },
      boundary: PLOT.boundary,
    });
  });

  it("keeps a map pin without accuracy", () => {
    expect(plotInitialLocation({ ...PLOT, location_source: "map_pin", location_accuracy_m: null }).point).toEqual({
      lat: 25.61,
      lng: 85.14,
      source: "map_pin",
    });
  });

  it("does not turn the boundary's centre into a pin, so it is recalculated when the boundary changes", () => {
    expect(plotInitialLocation({ ...PLOT, location_source: "boundary_centroid", location_accuracy_m: null }).point).toBeNull();
  });

  it("handles a plot with no location", () => {
    expect(plotInitialLocation({ ...PLOT, latitude: null, longitude: null, location_source: null, boundary: null })).toEqual({
      point: null,
      boundary: [],
    });
  });

  it("round-trips through the form: an unchanged edit saves the same location", () => {
    const { point, boundary } = plotInitialLocation(PLOT);
    const parsed = plotSchema.parse({
      ...plotFormValues(PLOT),
      latitude: point!.lat.toFixed(6),
      longitude: point!.lng.toFixed(6),
      location_source: point!.source,
      location_accuracy_m: String(point!.accuracyM),
      boundary: JSON.stringify(boundary),
    });
    expect(parsed).toMatchObject({ latitude: 25.61, longitude: 85.14, location_source: "device_gps", location_accuracy_m: 9 });
    expect(parsed.boundary).toEqual(PLOT.boundary);
  });
});
