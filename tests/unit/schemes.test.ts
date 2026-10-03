import { describe, expect, it } from "vitest";

import { deadlineText, matchReasons } from "@/features/schemes/format";
import { byDeadline, isStale, matchScheme, mayBeRelevant, schemeArea, type SchemeScope } from "@/features/schemes/rules";
import { getMessages } from "@/lib/i18n";

const TODAY = "2026-10-03";
const WHEAT = "wheat-id";
const MAIZE = "maize-id";
const farmer = { state: "Bihar", district: "Vaishali" };
const t = getMessages("en");

const scope = (fields: Partial<SchemeScope> = {}): SchemeScope => ({
  state: null,
  districts: [],
  seasons: [],
  cropIds: [],
  application_deadline: null,
  ...fields,
});

describe("schemeArea", () => {
  it("matches across India, the farmer's state or their district (ignoring case and spaces)", () => {
    expect(schemeArea(scope(), farmer)).toBe("india");
    expect(schemeArea(scope({ state: "bihar " }), farmer)).toBe("state");
    expect(schemeArea(scope({ state: "Bihar", districts: ["Patna", "vaishali"] }), farmer)).toBe("district");
  });

  it("does not match other states or other districts", () => {
    expect(schemeArea(scope({ state: "Uttar Pradesh" }), farmer)).toBeNull();
    expect(schemeArea(scope({ state: "Bihar", districts: ["Patna"] }), farmer)).toBeNull();
  });
});

describe("matchScheme", () => {
  const crops = [
    { crop_id: WHEAT, season: "rabi" },
    { crop_id: MAIZE, season: "kharif" },
  ];

  it("is relevant for any crop when the scheme names no crop or season", () => {
    const m = matchScheme(scope({ state: "Bihar" }), farmer, crops, TODAY);
    expect(m).toEqual({ area: "state", crops: [], cropMismatch: false, deadlinePassed: false });
    expect(mayBeRelevant(m)).toBe(true);
  });

  it("matches a crop in the scheme's season only", () => {
    expect(matchScheme(scope({ cropIds: [WHEAT], seasons: ["rabi"] }), farmer, crops, TODAY).crops).toEqual([{ crop_id: WHEAT, season: "rabi" }]);
    const offSeason = matchScheme(scope({ cropIds: [WHEAT], seasons: ["kharif"] }), farmer, crops, TODAY);
    expect(offSeason.cropMismatch).toBe(true);
    expect(mayBeRelevant(offSeason)).toBe(false);
    expect(matchScheme(scope({ seasons: ["kharif"] }), farmer, crops, TODAY).crops).toEqual([{ crop_id: MAIZE, season: "kharif" }]);
  });

  it("is not relevant for a farmer without matching crops, after the deadline, or outside the area", () => {
    expect(mayBeRelevant(matchScheme(scope({ cropIds: [WHEAT] }), farmer, [], TODAY))).toBe(false);
    const late = matchScheme(scope({ application_deadline: "2026-10-02" }), farmer, crops, TODAY);
    expect(late.deadlinePassed).toBe(true);
    expect(mayBeRelevant(late)).toBe(false);
    expect(matchScheme(scope({ application_deadline: TODAY }), farmer, crops, TODAY).deadlinePassed).toBe(false);
    expect(mayBeRelevant(matchScheme(scope({ state: "Odisha" }), farmer, crops, TODAY))).toBe(false);
  });
});

describe("isStale and byDeadline", () => {
  it("flags information checked more than 180 days ago", () => {
    expect(isStale("2026-04-06", TODAY)).toBe(false); // 180 days
    expect(isStale("2026-04-05", TODAY)).toBe(true);
  });

  it("puts the soonest deadline first and schemes without one last", () => {
    const list = [{ application_deadline: null }, { application_deadline: "2026-12-01" }, { application_deadline: "2026-11-01" }];
    expect(list.sort(byDeadline).map((s) => s.application_deadline)).toEqual(["2026-11-01", "2026-12-01", null]);
  });
});

describe("reasons and deadlines in words", () => {
  const crops = [{ crop_id: WHEAT, season: "rabi", crop: { name: "Wheat", name_hi: "गेहूँ" } }];

  it("explains why a scheme is shown, without claiming eligibility", () => {
    const m = matchScheme(scope({ state: "Bihar", districts: ["Vaishali"], cropIds: [WHEAT] }), farmer, crops, TODAY);
    expect(matchReasons(m, farmer, crops, t, "en")).toEqual(["For farmers in Vaishali district", "Your crops: Wheat · Rabi (winter)"]);
    expect(matchReasons(matchScheme(scope(), farmer, crops, TODAY), farmer, crops, t, "en")).toEqual(["Applies across India", "For any crop"]);
    expect(matchReasons(m, farmer, crops, t, "en").join(" ")).not.toMatch(/eligible/i);
  });

  it("describes the deadline", () => {
    expect(deadlineText(null, false, t, "en")).toBe("No deadline announced — check the official source");
    expect(deadlineText("2026-12-15", false, t, "en")).toMatch(/^Apply by /);
    expect(deadlineText("2026-09-01", true, t, "en")).toMatch(/^Deadline passed/);
  });
});
