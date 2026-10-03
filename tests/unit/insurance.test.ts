import { describe, expect, it } from "vitest";

import { enrollmentText } from "@/features/insurance/format";
import { matchInsurance, type InsuranceScope } from "@/features/insurance/rules";
import { areaFor, isStale } from "@/features/shared/official-data";
import { getMessages } from "@/lib/i18n";

const TODAY = "2026-10-03";
const farmer = { state: "Bihar", district: "Vaishali" };
const wheatRabi = { crop_id: "wheat", season: "rabi" };
const t = getMessages("en");

const scope = (fields: Partial<InsuranceScope> = {}): InsuranceScope => ({
  state: "Bihar",
  districts: [],
  seasons: [],
  cropIds: ["wheat"],
  enrollment_deadline: null,
  ...fields,
});

describe("matchInsurance", () => {
  it("applies to a covered crop, in its season, where the farmer is", () => {
    expect(matchInsurance(scope({ seasons: ["rabi"] }), farmer, wheatRabi, TODAY)).toEqual({ area: "state", applies: true, enrollmentClosed: false });
    expect(matchInsurance(scope({ state: null }), farmer, wheatRabi, TODAY).applies).toBe(true);
    expect(matchInsurance(scope({ districts: ["Vaishali"] }), farmer, wheatRabi, TODAY).area).toBe("district");
  });

  it("does not apply to other crops, seasons or places", () => {
    expect(matchInsurance(scope({ cropIds: ["maize"] }), farmer, wheatRabi, TODAY).applies).toBe(false);
    expect(matchInsurance(scope({ seasons: ["kharif"] }), farmer, wheatRabi, TODAY).applies).toBe(false);
    expect(matchInsurance(scope({ state: "Odisha" }), farmer, wheatRabi, TODAY).applies).toBe(false);
    expect(matchInsurance(scope({ districts: ["Patna"] }), farmer, wheatRabi, TODAY).applies).toBe(false);
  });

  it("notes when enrolment has closed, but still shows it", () => {
    const closed = matchInsurance(scope({ enrollment_deadline: "2026-10-02" }), farmer, wheatRabi, TODAY);
    expect(closed).toMatchObject({ applies: true, enrollmentClosed: true });
    expect(matchInsurance(scope({ enrollment_deadline: TODAY }), farmer, wheatRabi, TODAY).enrollmentClosed).toBe(false);
  });
});

describe("shared official-data rules", () => {
  it("match places and flag old information the same way for schemes and insurance", () => {
    expect(areaFor({ state: " BIHAR", districts: [] }, farmer)).toBe("state");
    expect(isStale("2026-04-05", TODAY)).toBe(true);
  });
});

describe("enrollmentText", () => {
  it("describes the enrolment date", () => {
    expect(enrollmentText(null, false, t, "en")).toBe("Enrolment date not announced — check the official source");
    expect(enrollmentText("2026-12-31", false, t, "en")).toMatch(/^Enrol by /);
    expect(enrollmentText("2026-09-30", true, t, "en")).toMatch(/^Enrolment closed/);
  });

  it("never promises a payout: the only mention of payment is the warning that none is promised", () => {
    const { notGuaranteed, ...rest } = t.insurance;
    expect(notGuaranteed).toMatch(/cannot promise that any claim will be paid/);
    expect(Object.values(rest).join(" ")).not.toMatch(/guarantee|will be paid|payout/i);
  });
});
