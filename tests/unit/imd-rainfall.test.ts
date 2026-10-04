import { describe, expect, it } from "vitest";

import { contextText, type FarmContext } from "@/features/farm-assistant/context";
import { displayName } from "@/features/weather/imd";
import { imdDate, normalizeImdRainfall } from "@/features/weather/imd-rainfall";

import { mockImdRainfall } from "../support/mock-anthropic";

const TODAY = "2026-10-04";
const PATNA = { district: "Patna", state: "Bihar" };

type Entry = ReturnType<typeof mockImdRainfall>[number];
const patch = (fields: Partial<Record<keyof Entry, unknown>>, date = TODAY) =>
  mockImdRainfall(date).map((e) => (e.District === "PATNA" ? { ...e, ...fields } : e));

describe("imdDate", () => {
  it("reads both IMD date styles and refuses impossible dates", () => {
    expect(imdDate("2026-10-04")).toBe("2026-10-04");
    expect(imdDate("04-10-2026")).toBe("2026-10-04");
    expect(imdDate("31-02-2026")).toBeNull();
    expect(imdDate("4 Oct")).toBeNull();
  });
});

describe("displayName", () => {
  it("title-cases names IMD writes in capitals, and leaves others alone", () => {
    expect(displayName("EAST CHAMPARAN")).toBe("East Champaran");
    expect(displayName(" WEST-SINGHBHUM ")).toBe("West-Singhbhum");
    expect(displayName("Kaimur (Bhabua)")).toBe("Kaimur (Bhabua)");
  });
});

describe("normalizeImdRainfall", () => {
  it("reads the day, the week and the season, each against normal", () => {
    expect(normalizeImdRainfall(mockImdRainfall(TODAY), PATNA, TODAY)).toEqual({
      source: "IMD",
      district: "Patna",
      date: TODAY,
      day: { from: TODAY, to: TODAY, actualMm: 12.4, normalMm: 3.1, departurePct: 300, category: "LE" },
      week: { from: "2026-09-27", to: "2026-10-03", actualMm: 18.2, normalMm: 22.8, departurePct: -20, category: "D" },
      season: { from: "2026-06-01", to: TODAY, actualMm: 845.3, normalMm: 960.5, departurePct: -12, category: "N" },
    });
  });

  it("reads no rain as no rain", () => {
    const v = normalizeImdRainfall(mockImdRainfall(TODAY), { district: "Vaishali", state: "Bihar" }, TODAY)!;
    expect(v.day).toMatchObject({ actualMm: 0, departurePct: -100, category: "NR" });
  });

  it("refuses an unknown or ambiguous district, and a report that is too old or from the future", () => {
    expect(normalizeImdRainfall(mockImdRainfall(TODAY), { district: "Aurangabad", state: "Bihar" }, TODAY)).toBeNull();
    expect(normalizeImdRainfall(mockImdRainfall(TODAY), { district: "Nowhere", state: "Bihar" }, TODAY)).toBeNull();
    expect(normalizeImdRainfall(mockImdRainfall("2026-10-02"), PATNA, TODAY)).not.toBeNull();
    expect(normalizeImdRainfall(mockImdRainfall("2026-10-01"), PATNA, TODAY)).toBeNull();
    expect(normalizeImdRainfall(mockImdRainfall("2026-10-05"), PATNA, TODAY)).toBeNull();
  });

  it("leaves out a period IMD has no figure for, but not the others", () => {
    const v = normalizeImdRainfall(patch({ "Weekly Actual": "NA", "Daily Normal": "" }), PATNA, TODAY)!;
    expect(v.week).toBeNull();
    expect(v.day).toMatchObject({ actualMm: 12.4, normalMm: null });
    expect(v.season).not.toBeNull();
    const nothing = patch({ "Daily Actual": "NA", "Weekly Actual": "NA", "Cumulative Actual": "NA" });
    expect(normalizeImdRainfall(nothing, PATNA, TODAY)).toBeNull();
  });

  it("rejects values it does not understand rather than show wrong rain", () => {
    expect(normalizeImdRainfall({ data: [] }, PATNA, TODAY)).toBeNull();
    expect(normalizeImdRainfall(patch({ "Daily Actual": "12,4" }), PATNA, TODAY)).toBeNull();
    expect(normalizeImdRainfall(patch({ "Daily Actual": "-1" }), PATNA, TODAY)).toBeNull();
    expect(normalizeImdRainfall(patch({ "Daily Category": "XX" }), PATNA, TODAY)).toBeNull();
    expect(normalizeImdRainfall(patch({ "Daily Departure Per": "lots" }), PATNA, TODAY)).toBeNull();
    expect(normalizeImdRainfall(patch({ "Daily Departure Per": "-150%" }), PATNA, TODAY)).toBeNull();
    expect(normalizeImdRainfall(patch({ "Week Date": "last week" }), PATNA, TODAY)).toBeNull();
    expect(normalizeImdRainfall(patch({ "Cumulative Date": "June" }), PATNA, TODAY)).toBeNull();
    expect(normalizeImdRainfall(patch({ Date: "yesterday" }), PATNA, TODAY)).toBeNull();
    // "No rain" with rain means the fields were misread.
    expect(normalizeImdRainfall(patch({ "Daily Category": "NR" }), PATNA, TODAY)).toBeNull();
    expect(normalizeImdRainfall(patch({ "Daily Actual": undefined }), PATNA, TODAY)).toBeNull();
  });

  it("accepts numbers as well as strings", () => {
    expect(normalizeImdRainfall(patch({ "Daily Actual": 12.4, "Daily Departure Per": 300 }), PATNA, TODAY)?.day).toMatchObject({ actualMm: 12.4, departurePct: 300 });
  });
});

describe("the farm assistant's IMD rainfall", () => {
  const base: FarmContext = {
    locale: "en",
    today: TODAY,
    district: "Patna",
    state: "Bihar",
    oneCrop: false,
    plots: [],
    crops: [],
    activities: [],
    observations: [],
    weather: [],
  };

  it("is labelled as measured, district-wide, with the periods and categories", () => {
    const text = contextText({ ...base, imdRain: normalizeImdRainfall(mockImdRainfall(TODAY), PATNA, TODAY) }, "q");
    expect(text).toContain("Rain measured by IMD rain gauges, averaged over Patna district (the farmer's field may differ)");
    expect(text).toContain(`- 24 hours to 08:30 on ${TODAY}: 12.4 mm, normal 3.1 mm, +300% compared with normal, IMD category LE`);
    expect(text).toContain("- Week 2026-09-27 to 2026-10-03: 18.2 mm, normal 22.8 mm, -20% compared with normal, IMD category D");
    expect(text).toContain("- Since 2026-06-01: 845.3 mm");
    expect(text).toContain("Model forecast: not available to you");
  });
});
