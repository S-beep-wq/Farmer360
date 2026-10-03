import { describe, expect, it } from "vitest";

import { CROP_CYCLE_STATUSES } from "@/features/crops/constants";
import { cropCycleFormValues } from "@/features/crops/form-values";
import type { CropCycle } from "@/features/crops/repository";
import { editCropCycleSchema, recordHarvestSchema, recordSowingSchema } from "@/features/crops/schema";
import { availableActions, canDo } from "@/features/crops/transitions";
import { fieldErrorsFrom } from "@/lib/forms";

const TODAY = "2026-10-03";
const CROP_ID = "33333333-3333-4333-8333-333333333333";

function errors(result: { success: boolean; error?: Parameters<typeof fieldErrorsFrom>[0] }) {
  return result.success || !result.error ? {} : fieldErrorsFrom(result.error);
}

describe("availableActions", () => {
  it("offers the next step for each status", () => {
    expect(availableActions("PLANNED")).toEqual(["recordSowing", "edit", "cancel"]);
    expect(availableActions("ACTIVE")).toEqual(["recordHarvest", "edit", "cancel"]);
    expect(availableActions("HARVESTED")).toEqual(["review", "edit"]);
  });

  it("treats cancelled and completed crops as final", () => {
    expect(availableActions("CANCELLED")).toEqual([]);
    expect(availableActions("COMPLETED")).toEqual([]);
  });

  it("never offers to record sowing twice or to harvest a crop that is not in the field", () => {
    for (const status of CROP_CYCLE_STATUSES) {
      expect(canDo(status, "recordSowing")).toBe(status === "PLANNED");
      expect(canDo(status, "recordHarvest")).toBe(status === "ACTIVE");
    }
  });
});

describe("recordSowingSchema", () => {
  const schema = recordSowingSchema(TODAY);

  it("accepts today or an earlier date", () => {
    expect(schema.parse({ actual_sowing_date: TODAY, expected_harvest_date: "" })).toEqual({
      actual_sowing_date: TODAY,
      expected_harvest_date: undefined,
    });
    expect(errors(schema.safeParse({ actual_sowing_date: "2026-09-01" }))).toEqual({});
  });

  it("rejects a future date and an expected harvest before sowing", () => {
    expect(errors(schema.safeParse({ actual_sowing_date: "2026-10-04" }))).toEqual({ actual_sowing_date: "futureSowingDate" });
    expect(errors(schema.safeParse({ actual_sowing_date: "2026-10-01", expected_harvest_date: "2026-09-30" }))).toEqual({
      expected_harvest_date: "harvestBeforeSowing",
    });
    expect(errors(schema.safeParse({ actual_sowing_date: "" }))).toEqual({ actual_sowing_date: "required" });
  });
});

describe("recordHarvestSchema", () => {
  const schema = recordHarvestSchema(TODAY, "2026-07-01");

  it("accepts a date between sowing and today", () => {
    expect(errors(schema.safeParse({ actual_harvest_date: "2026-07-01" }))).toEqual({});
    expect(errors(schema.safeParse({ actual_harvest_date: TODAY }))).toEqual({});
  });

  it("rejects a future date and a date before sowing", () => {
    expect(errors(schema.safeParse({ actual_harvest_date: "2026-10-04" }))).toEqual({ actual_harvest_date: "futureHarvestDate" });
    expect(errors(schema.safeParse({ actual_harvest_date: "2026-06-30" }))).toEqual({ actual_harvest_date: "harvestBeforeSowing" });
  });
});

describe("editCropCycleSchema", () => {
  const base = { crop_id: CROP_ID, variety_name: "", season: "kharif", expected_harvest_date: "" };

  it("edits the planned date of a planned crop and ignores other dates", () => {
    const result = editCropCycleSchema(TODAY, "PLANNED").parse({
      ...base,
      planned_sowing_date: "2026-11-01",
      actual_sowing_date: "2026-09-01",
      actual_harvest_date: "2026-09-30",
    });
    expect(result).toMatchObject({ planned_sowing_date: "2026-11-01" });
    expect(result.actual_sowing_date).toBeUndefined();
    expect(result.actual_harvest_date).toBeUndefined();
  });

  it("allows a future planned date but not a future actual sowing date", () => {
    expect(errors(editCropCycleSchema(TODAY, "PLANNED").safeParse({ ...base, planned_sowing_date: "2027-01-01" }))).toEqual({});
    expect(errors(editCropCycleSchema(TODAY, "ACTIVE").safeParse({ ...base, actual_sowing_date: "2027-01-01" }))).toEqual({
      actual_sowing_date: "futureSowingDate",
    });
  });

  it("needs both dates for a harvested crop, in order and not in the future", () => {
    const schema = editCropCycleSchema(TODAY, "HARVESTED");
    expect(errors(schema.safeParse({ ...base, actual_sowing_date: "2026-07-01" }))).toEqual({ actual_harvest_date: "required" });
    expect(errors(schema.safeParse({ ...base, actual_sowing_date: "2026-07-01", actual_harvest_date: "2026-06-01" }))).toEqual({
      actual_harvest_date: "harvestBeforeSowing",
    });
    expect(errors(schema.safeParse({ ...base, actual_sowing_date: "2026-07-01", actual_harvest_date: "2026-10-04" }))).toEqual({
      actual_harvest_date: "futureHarvestDate",
    });
    expect(errors(schema.safeParse({ ...base, actual_sowing_date: "2026-07-01", actual_harvest_date: "2026-10-01" }))).toEqual({});
  });

  it("keeps the expected harvest on or after sowing", () => {
    expect(
      errors(editCropCycleSchema(TODAY, "ACTIVE").safeParse({ ...base, actual_sowing_date: "2026-07-01", expected_harvest_date: "2026-06-01" })),
    ).toEqual({ expected_harvest_date: "harvestBeforeSowing" });
  });
});

describe("cropCycleFormValues", () => {
  it("prefills the edit form from a saved crop", () => {
    const cycle: CropCycle = {
      id: "44444444-4444-4444-8444-444444444444",
      plot_id: "22222222-2222-4222-8222-222222222222",
      season: "kharif",
      status: "ACTIVE",
      variety_name: null,
      planned_sowing_date: null,
      actual_sowing_date: "2026-07-01",
      expected_harvest_date: "2026-11-01",
      actual_harvest_date: null,
      current_growth_stage: null,
      notes: null,
      completed_at: null,
      created_at: "2026-07-01T00:00:00Z",
      crop: { id: CROP_ID, name: "Rice (paddy)", name_hi: "धान" },
    };
    expect(cropCycleFormValues(cycle)).toEqual({
      crop_id: CROP_ID,
      variety_name: "",
      season: "kharif",
      planned_sowing_date: "",
      actual_sowing_date: "2026-07-01",
      actual_harvest_date: "",
      expected_harvest_date: "2026-11-01",
    });
  });
});
