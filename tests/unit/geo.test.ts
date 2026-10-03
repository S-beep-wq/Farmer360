import { describe, expect, it } from "vitest";

import {
  checkBoundary,
  closeRing,
  isSimpleRing,
  isValidLngLat,
  openRing,
  ringAreaSqM,
  ringFromGeoJson,
  toEwktPolygon,
  type LngLat,
} from "@/features/plots/location/geo";

// A ~111 m x ~100 m field near Patna. PostGIS (spheroid) gives 11,137.56 m² for this polygon.
const SQUARE: LngLat[] = [
  [85.0, 25.5],
  [85.001, 25.5],
  [85.001, 25.501],
  [85.0, 25.501],
];

const BOWTIE: LngLat[] = [
  [85.0, 25.5],
  [85.001, 25.501],
  [85.001, 25.5],
  [85.0, 25.501],
];

describe("ringAreaSqM", () => {
  it("is within 1% of the database's spheroidal area", () => {
    expect(ringAreaSqM(SQUARE)).toBeGreaterThan(11137.56 * 0.99);
    expect(ringAreaSqM(SQUARE)).toBeLessThan(11137.56 * 1.01);
  });

  it("gives the same result for a closed ring", () => {
    expect(ringAreaSqM(closeRing(SQUARE))).toBeCloseTo(ringAreaSqM(SQUARE), 6);
  });

  it("is 0 for fewer than 3 corners", () => {
    expect(ringAreaSqM(SQUARE.slice(0, 2))).toBe(0);
  });
});

describe("rings", () => {
  it("closes and re-opens a ring", () => {
    const closed = closeRing(SQUARE);
    expect(closed).toHaveLength(5);
    expect(closed[4]).toEqual(closed[0]);
    expect(openRing(closed)).toEqual(SQUARE);
    expect(closeRing(closed)).toEqual(closed);
  });
});

describe("isSimpleRing", () => {
  it("accepts a normal field", () => {
    expect(isSimpleRing(SQUARE)).toBe(true);
  });

  it("rejects a boundary that crosses itself", () => {
    expect(isSimpleRing(BOWTIE)).toBe(false);
  });

  it("rejects repeated corners", () => {
    expect(isSimpleRing([...SQUARE, SQUARE[1]])).toBe(false);
  });
});

describe("checkBoundary", () => {
  it("accepts a valid boundary", () => {
    expect(checkBoundary(SQUARE)).toBeNull();
  });

  it("names the problem", () => {
    expect(checkBoundary(SQUARE.slice(0, 2))).toBe("tooFewPoints");
    expect(checkBoundary(BOWTIE)).toBe("selfIntersecting");
    expect(checkBoundary([[85, 25.5], [200, 25.5], [85, 26]])).toBe("invalidPoint");
    expect(
      checkBoundary([
        [85.0, 25.5],
        [85.001, 25.5],
        [85.002, 25.5],
      ]),
    ).toBe("zeroArea");
  });

  it("rejects too many corners", () => {
    const many: LngLat[] = Array.from({ length: 501 }, (_, i) => {
      const a = (2 * Math.PI * i) / 501;
      return [85 + 0.001 * Math.cos(a), 25.5 + 0.001 * Math.sin(a)];
    });
    expect(checkBoundary(many)).toBe("tooManyPoints");
  });
});

describe("isValidLngLat", () => {
  it("checks shape and range", () => {
    expect(isValidLngLat([85, 25])).toBe(true);
    expect(isValidLngLat([181, 25])).toBe(false);
    expect(isValidLngLat([85, -91])).toBe(false);
    expect(isValidLngLat([85])).toBe(false);
    expect(isValidLngLat(["85", 25])).toBe(false);
    expect(isValidLngLat([Number.NaN, 25])).toBe(false);
  });
});

describe("toEwktPolygon", () => {
  it("writes a closed WGS 84 polygon in lon/lat order", () => {
    expect(toEwktPolygon(SQUARE)).toBe(
      "SRID=4326;POLYGON((85.0000000 25.5000000,85.0010000 25.5000000,85.0010000 25.5010000,85.0000000 25.5010000,85.0000000 25.5000000))",
    );
  });
});

describe("ringFromGeoJson", () => {
  it("reads the outer ring as an open ring", () => {
    expect(ringFromGeoJson({ type: "Polygon", coordinates: [closeRing(SQUARE)] })).toEqual(SQUARE);
  });

  it("returns null for anything else", () => {
    expect(ringFromGeoJson(null)).toBeNull();
    expect(ringFromGeoJson({ type: "Point", coordinates: [85, 25] })).toBeNull();
    expect(ringFromGeoJson({ type: "Polygon", coordinates: [[[999, 0]]] })).toBeNull();
  });
});
