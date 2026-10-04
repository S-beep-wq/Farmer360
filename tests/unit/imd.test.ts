import { describe, expect, it } from "vitest";

import { districtKey, normalizeImdWarnings } from "@/features/weather/imd";

import { mockImdWarnings } from "../support/mock-anthropic";

const TODAY = "2026-10-04";
const PATNA = { district: "Patna", state: "Bihar" };

describe("normalizeImdWarnings", () => {
  it("reads the district's 5 days: colour level and hazards", () => {
    const w = normalizeImdWarnings(mockImdWarnings(TODAY), PATNA, TODAY)!;
    expect(w).toMatchObject({ source: "IMD", district: "Patna", issuedOn: TODAY });
    expect(w.days).toEqual([
      { date: "2026-10-04", level: "ORANGE", hazards: ["HEAVY_RAIN", "THUNDERSTORM"] },
      { date: "2026-10-05", level: "RED", hazards: ["VERY_HEAVY_RAIN"] },
      { date: "2026-10-06", level: "GREEN", hazards: [] },
      { date: "2026-10-07", level: "YELLOW", hazards: ["HEAT_WAVE"] },
      { date: "2026-10-08", level: "GREEN", hazards: [] },
    ]);
  });

  it("matches district names regardless of case, spaces and hyphens, but not other spellings", () => {
    expect(districtKey(" East-Champaran ")).toBe(districtKey("east champaran"));
    expect(normalizeImdWarnings(mockImdWarnings(TODAY), { district: " patna ", state: "Bihar" }, TODAY)).not.toBeNull();
    expect(normalizeImdWarnings(mockImdWarnings(TODAY), { district: "Patana", state: "Bihar" }, TODAY)).toBeNull();
  });

  it("refuses a district listed more than once, unless the state tells them apart", () => {
    expect(normalizeImdWarnings(mockImdWarnings(TODAY), { district: "Aurangabad", state: "Bihar" }, TODAY)).toBeNull();
    const list = mockImdWarnings(TODAY).map((e, i) => (e.District === "Aurangabad" ? { ...e, State: i === 2 ? "Bihar" : "Maharashtra" } : e));
    expect(normalizeImdWarnings(list, { district: "Aurangabad", state: "Bihar" }, TODAY)?.district).toBe("Aurangabad");
  });

  it("shows only today and later from yesterday's warnings, and nothing older or from the future", () => {
    const yesterday = normalizeImdWarnings(mockImdWarnings("2026-10-03"), PATNA, TODAY)!;
    expect(yesterday.days.map((d) => d.date)).toEqual(["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"]);
    expect(yesterday.days[0].level).toBe("RED");
    expect(normalizeImdWarnings(mockImdWarnings("2026-10-02"), PATNA, TODAY)).toBeNull();
    expect(normalizeImdWarnings(mockImdWarnings("2026-10-05"), PATNA, TODAY)).toBeNull();
  });

  it("rejects anything it does not recognise rather than show a wrong warning", () => {
    const patch = (fields: Record<string, unknown>) => mockImdWarnings(TODAY).map((e) => (e.District === "Patna" ? { ...e, ...fields } : e));
    expect(normalizeImdWarnings({ data: [] }, PATNA, TODAY)).toBeNull();
    expect(normalizeImdWarnings("nope", PATNA, TODAY)).toBeNull();
    expect(normalizeImdWarnings(patch({ Day1_Color: "5" }), PATNA, TODAY)).toBeNull();
    expect(normalizeImdWarnings(patch({ Day_2: "99" }), PATNA, TODAY)).toBeNull();
    expect(normalizeImdWarnings(patch({ Day_5: "" }), PATNA, TODAY)).toBeNull();
    expect(normalizeImdWarnings(patch({ Day_3: undefined }), PATNA, TODAY)).toBeNull();
    expect(normalizeImdWarnings(patch({ Date: "4 Oct" }), PATNA, TODAY)).toBeNull();
    // A colour that does not fit the warning means the codes were misread (e.g. colours reversed).
    expect(normalizeImdWarnings(patch({ Day3_Color: "1" }), PATNA, TODAY)).toBeNull();
    expect(normalizeImdWarnings(patch({ Day1_Color: "4" }), PATNA, TODAY)).toBeNull();
  });

  it("accepts numbers as well as strings for the codes", () => {
    const list = mockImdWarnings(TODAY).map((e) => (e.District === "Patna" ? { ...e, Day_3: 1, Day3_Color: 4 } : e));
    expect(normalizeImdWarnings(list, PATNA, TODAY)?.days[2]).toEqual({ date: "2026-10-06", level: "GREEN", hazards: [] });
  });
});
