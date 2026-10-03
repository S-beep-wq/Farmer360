import { describe, expect, it } from "vitest";

import { formatArea, formatMeasuredArea } from "@/features/plots/format";
import { fromSquareMetres, roundArea, toSquareMetres } from "@/features/shared/land";
import { format, getMessages, isLocale } from "@/lib/i18n";
import { en } from "@/lib/i18n/messages/en";
import { hi } from "@/lib/i18n/messages/hi";

function leafPaths(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : leafPaths(value as object, `${prefix}${key}.`),
  );
}

function placeholders(text: string) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("messages", () => {
  it("Hindi has exactly the same keys as English", () => {
    expect(leafPaths(hi).sort()).toEqual(leafPaths(en).sort());
  });

  it("no text is empty", () => {
    for (const messages of [en, hi]) {
      for (const path of leafPaths(messages)) {
        const value = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], messages);
        expect(value, path).not.toBe("");
      }
    }
  });

  it("Hindi uses the same placeholders as English", () => {
    for (const path of leafPaths(en)) {
      const get = (m: object) => path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], m) as string;
      expect(placeholders(get(hi)), path).toEqual(placeholders(get(en)));
    }
  });

  it("format fills placeholders and leaves unknown ones", () => {
    expect(format("Plots: {count}", { count: 3 })).toBe("Plots: 3");
    expect(format("{a} and {b}", { a: "x" })).toBe("x and {b}");
  });

  it("recognises supported locales only", () => {
    expect(isLocale("hi")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(getMessages("hi").app.name).toBe("किसान 360");
  });
});

describe("area units", () => {
  it("converts between units", () => {
    expect(toSquareMetres(1, "acre")).toBeCloseTo(4046.856, 3);
    expect(toSquareMetres(100, "decimal")).toBeCloseTo(toSquareMetres(1, "acre"), 6);
    expect(fromSquareMetres(10000, "hectare")).toBe(1);
  });

  it("rounds decimals to whole numbers and acres to 2 places", () => {
    expect(roundArea(27.52, "decimal")).toBe(28);
    expect(roundArea(0.2752, "acre")).toBe(0.28);
  });

  it("formats areas in the chosen language", () => {
    expect(formatArea(1.25, "acre", en, "en")).toBe("1.25 Acre");
    expect(formatArea(1.25, "acre", hi, "hi")).toBe("1.25 एकड़");
    expect(formatArea(null, "acre", en, "en")).toBeNull();
    expect(formatArea(1, "bigha", en, "en")).toBeNull();
  });

  it("shows map area in acres and decimals", () => {
    expect(formatMeasuredArea(11137.56, en, "en")).toBe("2.75 Acre (275 Decimal (dismil))");
  });
});
