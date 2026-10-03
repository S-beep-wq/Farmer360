import { describe, expect, it } from "vitest";

import { farmerProfileSchema } from "@/features/farmer/schema";
import { farmSchema } from "@/features/farms/schema";
import { plotSchema } from "@/features/plots/schema";
import { fieldErrorsFrom } from "@/lib/forms";

const SQUARE = JSON.stringify([
  [85.0, 25.5],
  [85.001, 25.5],
  [85.001, 25.501],
  [85.0, 25.501],
]);

function errors(result: { success: boolean; error?: Parameters<typeof fieldErrorsFrom>[0] }) {
  return result.success || !result.error ? {} : fieldErrorsFrom(result.error);
}

describe("farmerProfileSchema", () => {
  const valid = { full_name: " Ramesh Kumar ", preferred_language: "hi", state: "Bihar", district: "Patna", village: "Bihta" };

  it("accepts and trims a complete profile", () => {
    const result = farmerProfileSchema.safeParse(valid);
    expect(result.success && result.data.full_name).toBe("Ramesh Kumar");
  });

  it("reports missing fields by name", () => {
    const result = farmerProfileSchema.safeParse({ ...valid, full_name: "  ", village: "" });
    expect(errors(result)).toEqual({ full_name: "required", village: "required" });
  });

  it("rejects an unsupported language", () => {
    expect(errors(farmerProfileSchema.safeParse({ ...valid, preferred_language: "fr" }))).toEqual({
      preferred_language: "invalidChoice",
    });
  });
});

describe("farmSchema", () => {
  it("only needs a name", () => {
    const result = farmSchema.safeParse({ name: "Ghar wala khet", village: "", total_area: "", area_unit: "acre", irrigation_available: "", soil_type: "" });
    expect(result.success && result.data).toMatchObject({
      name: "Ghar wala khet",
      village: undefined,
      total_area: undefined,
      area_unit: undefined,
      irrigation_available: undefined,
    });
  });

  it("parses area, accepting a comma decimal", () => {
    const result = farmSchema.safeParse({ name: "A", total_area: "2,5", area_unit: "hectare" });
    expect(result.success && [result.data.total_area, result.data.area_unit]).toEqual([2.5, "hectare"]);
  });

  it("rejects zero, negative and non-numeric area", () => {
    expect(errors(farmSchema.safeParse({ name: "A", total_area: "0" }))).toEqual({ total_area: "positiveNumber" });
    expect(errors(farmSchema.safeParse({ name: "A", total_area: "-1" }))).toEqual({ total_area: "positiveNumber" });
    expect(errors(farmSchema.safeParse({ name: "A", total_area: "two" }))).toEqual({ total_area: "invalidNumber" });
  });

  it("drops the water source when there is no irrigation", () => {
    const result = farmSchema.safeParse({ name: "A", irrigation_available: "no", irrigation_type: "canal" });
    expect(result.success && [result.data.irrigation_available, result.data.irrigation_type]).toEqual([false, undefined]);
  });

  it("rejects unknown option values", () => {
    expect(errors(farmSchema.safeParse({ name: "A", soil_type: "moon_dust" }))).toEqual({ soil_type: "invalidChoice" });
  });
});

describe("plotSchema", () => {
  it("needs an area or a boundary", () => {
    expect(errors(plotSchema.safeParse({ name: "Plot 1" }))).toEqual({ area: "areaOrBoundaryRequired" });
  });

  it("accepts a plot with only an area", () => {
    const result = plotSchema.safeParse({ name: "Plot 1", area: "1.2", area_unit: "acre" });
    expect(result.success && result.data).toMatchObject({ area: 1.2, area_unit: "acre" });
    expect(result.success && [result.data.boundary, result.data.latitude]).toEqual([undefined, undefined]);
  });

  it("accepts a plot with only a boundary", () => {
    const result = plotSchema.safeParse({ name: "Plot 1", boundary: SQUARE, area: "", area_unit: "acre" });
    expect(result.success && result.data.boundary).toHaveLength(4);
    expect(result.success && result.data.area_unit).toBeUndefined();
  });

  it("keeps GPS accuracy only for a phone location", () => {
    const gps = plotSchema.safeParse({
      name: "P",
      area: "1",
      latitude: "25.5",
      longitude: "85.1",
      location_source: "device_gps",
      location_accuracy_m: "8",
    });
    expect(gps.success && gps.data.location_accuracy_m).toBe(8);

    const pin = plotSchema.safeParse({
      name: "P",
      area: "1",
      latitude: "25.5",
      longitude: "85.1",
      location_source: "map_pin",
      location_accuracy_m: "8",
    });
    expect(pin.success && pin.data.location_accuracy_m).toBeUndefined();
  });

  it("rejects half a location or a location without a source", () => {
    expect(errors(plotSchema.safeParse({ name: "P", area: "1", latitude: "25.5" }))).toEqual({ location: "invalidLocation" });
    expect(errors(plotSchema.safeParse({ name: "P", area: "1", latitude: "25.5", longitude: "85.1" }))).toEqual({
      location: "invalidLocation",
    });
  });

  it("rejects out-of-range coordinates", () => {
    expect(
      errors(plotSchema.safeParse({ name: "P", area: "1", latitude: "95", longitude: "85.1", location_source: "map_pin" })),
    ).toMatchObject({ latitude: "invalidLocation" });
  });

  it("does not let the browser claim the location came from the boundary", () => {
    expect(
      errors(
        plotSchema.safeParse({ name: "P", area: "1", latitude: "25.5", longitude: "85.1", location_source: "boundary_centroid" }),
      ),
    ).toMatchObject({ location_source: "invalidChoice" });
  });

  it("rejects broken or impossible boundaries", () => {
    expect(errors(plotSchema.safeParse({ name: "P", boundary: "not json" }))).toEqual({ boundary: "invalidBoundary" });
    expect(errors(plotSchema.safeParse({ name: "P", boundary: "[[85,25.5],[85.001,25.5]]" }))).toEqual({
      boundary: "boundaryTooFewPoints",
    });
    expect(
      errors(plotSchema.safeParse({ name: "P", boundary: "[[85,25.5],[85.001,25.501],[85.001,25.5],[85,25.501]]" })),
    ).toEqual({ boundary: "invalidBoundary" });
    expect(errors(plotSchema.safeParse({ name: "P", boundary: '{"type":"Polygon"}' }))).toEqual({ boundary: "invalidBoundary" });
  });
});
