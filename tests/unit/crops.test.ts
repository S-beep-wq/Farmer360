import { describe, expect, it } from "vitest";

import { formatDate, isIsoDate, todayInIndia } from "@/features/crops/dates";
import { cropName, sowingSummary } from "@/features/crops/format";
import { cropCycleSchema } from "@/features/crops/schema";
import { fieldErrorsFrom } from "@/lib/forms";
import { en } from "@/lib/i18n/messages/en";
import { hi } from "@/lib/i18n/messages/hi";

const TODAY = "2026-10-03";
const CROP_ID = "33333333-3333-4333-8333-333333333333";
const schema = cropCycleSchema(TODAY);

function errors(input: Record<string, string>) {
  const result = schema.safeParse(input);
  return result.success ? {} : fieldErrorsFrom(result.error);
}

describe("isIsoDate", () => {
  it("accepts real calendar dates only", () => {
    expect(isIsoDate("2026-10-03")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("03-10-2026")).toBe(false);
    expect(isIsoDate("1999-12-31")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("todayInIndia", () => {
  it("uses Indian time, which is ahead of UTC", () => {
    // 20:00 UTC on 2 Oct is 01:30 on 3 Oct in India.
    expect(todayInIndia(new Date("2026-10-02T20:00:00Z"))).toBe("2026-10-03");
    expect(todayInIndia(new Date("2026-10-02T18:00:00Z"))).toBe("2026-10-02");
  });
});

describe("formatDate", () => {
  it("formats a date without shifting it across time zones", () => {
    expect(formatDate("2026-11-12", "en")).toBe("12 Nov 2026");
    expect(formatDate("2026-11-12", "hi")).toContain("2026");
    expect(formatDate("2026-11-12", "hi")).toContain("12");
  });
});

describe("cropCycleSchema", () => {
  const base = { crop_id: CROP_ID, season: "rabi", variety_name: "", expected_harvest_date: "" };

  it("creates a PLANNED cycle when the crop is not sown yet", () => {
    const result = schema.parse({ ...base, already_sown: "no", sowing_date: "2026-11-15" });
    expect(result).toMatchObject({ status: "PLANNED", planned_sowing_date: "2026-11-15", crop_id: CROP_ID, season: "rabi" });
    expect(result.actual_sowing_date).toBeUndefined();
    expect(result.variety_name).toBeUndefined();
  });

  it("creates an ACTIVE cycle when the crop is already in the field", () => {
    const result = schema.parse({ ...base, already_sown: "yes", sowing_date: "2026-09-20", variety_name: " HD 2967 " });
    expect(result).toMatchObject({ status: "ACTIVE", actual_sowing_date: "2026-09-20", variety_name: "HD 2967" });
    expect(result.planned_sowing_date).toBeUndefined();
  });

  it("allows a crop sown today, but not one sown in the future", () => {
    expect(errors({ ...base, already_sown: "yes", sowing_date: TODAY })).toEqual({});
    expect(errors({ ...base, already_sown: "yes", sowing_date: "2026-10-04" })).toEqual({ sowing_date: "futureSowingDate" });
  });

  it("allows a planned date in the past (the plan may simply be late)", () => {
    expect(errors({ ...base, already_sown: "no", sowing_date: "2026-09-01" })).toEqual({});
  });

  it("requires the harvest to be on or after sowing", () => {
    expect(errors({ ...base, already_sown: "no", sowing_date: "2026-11-15", expected_harvest_date: "2026-11-14" })).toEqual({
      expected_harvest_date: "harvestBeforeSowing",
    });
    expect(
      schema.parse({ ...base, already_sown: "no", sowing_date: "2026-11-15", expected_harvest_date: "2027-04-10" }).expected_harvest_date,
    ).toBe("2027-04-10");
  });

  it("explains each missing or wrong answer", () => {
    expect(errors({ crop_id: "", season: "", already_sown: "", sowing_date: "" })).toEqual({
      crop_id: "invalidChoice",
      season: "invalidChoice",
      already_sown: "invalidChoice",
      sowing_date: "required",
    });
    expect(errors({ ...base, season: "monsoon", already_sown: "no", sowing_date: "2026-02-30" })).toEqual({
      season: "invalidChoice",
      sowing_date: "invalidDate",
    });
  });
});

describe("crop display", () => {
  it("names crops in the farmer's language", () => {
    const crop = { name: "Wheat", name_hi: "गेहूँ" };
    expect(cropName(crop, "en")).toBe("Wheat");
    expect(cropName(crop, "hi")).toBe("गेहूँ");
  });

  it("summarises sowing", () => {
    expect(sowingSummary({ actual_sowing_date: "2026-09-20", planned_sowing_date: null }, en, "en")).toBe("Sown on 20 Sept 2026");
    expect(sowingSummary({ actual_sowing_date: null, planned_sowing_date: "2026-11-15" }, en, "en")).toBe(
      "Sowing planned for 15 Nov 2026",
    );
    expect(sowingSummary({ actual_sowing_date: null, planned_sowing_date: null }, hi, "hi")).toBeNull();
  });
});
