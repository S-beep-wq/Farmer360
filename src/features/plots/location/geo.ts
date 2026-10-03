import turfArea from "@turf/area";

// Plot geometry helpers. Coordinates are [longitude, latitude] (GeoJSON order, WGS 84).
// The database recalculates area and validates the polygon (DATABASE.md section 5);
// these functions give the farmer immediate feedback and validate input on the server.

export type LngLat = [number, number];

export const MAX_BOUNDARY_POINTS = 500;
export const MIN_BOUNDARY_POINTS = 3;

export function isValidLngLat(p: unknown): p is LngLat {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    typeof p[0] === "number" &&
    typeof p[1] === "number" &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) &&
    p[0] >= -180 &&
    p[0] <= 180 &&
    p[1] >= -90 &&
    p[1] <= 90
  );
}

function samePoint(a: LngLat, b: LngLat) {
  return a[0] === b[0] && a[1] === b[1];
}

/** Drops a repeated closing point, so a ring is always handled "open". */
export function openRing(points: LngLat[]): LngLat[] {
  if (points.length > 1 && samePoint(points[0], points[points.length - 1])) {
    return points.slice(0, -1);
  }
  return points;
}

export function closeRing(points: LngLat[]): LngLat[] {
  const open = openRing(points);
  return open.length ? [...open, open[0]] : open;
}

/** Geodesic area in square metres of the polygon through these corners. */
export function ringAreaSqM(points: LngLat[]): number {
  const open = openRing(points);
  if (open.length < MIN_BOUNDARY_POINTS) return 0;
  return turfArea({ type: "Polygon", coordinates: [closeRing(open)] });
}

function orientation(a: LngLat, b: LngLat, c: LngLat): number {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  return value === 0 ? 0 : value > 0 ? 1 : 2;
}

function onSegment(a: LngLat, b: LngLat, c: LngLat): boolean {
  return (
    b[0] <= Math.max(a[0], c[0]) &&
    b[0] >= Math.min(a[0], c[0]) &&
    b[1] <= Math.max(a[1], c[1]) &&
    b[1] >= Math.min(a[1], c[1])
  );
}

function segmentsIntersect(p1: LngLat, q1: LngLat, p2: LngLat, q2: LngLat): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

/**
 * True when the boundary does not cross itself and has no repeated corners.
 * (Planar check on lon/lat, which is accurate at field scale.)
 */
export function isSimpleRing(points: LngLat[]): boolean {
  const open = openRing(points);
  const n = open.length;
  if (n < MIN_BOUNDARY_POINTS) return false;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (samePoint(open[i], open[j])) return false;
    }
  }

  for (let i = 0; i < n; i++) {
    const a1 = open[i];
    const a2 = open[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // Neighbouring edges share a corner; that is not a crossing.
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      const b1 = open[j];
      const b2 = open[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

export type BoundaryProblem = "tooFewPoints" | "tooManyPoints" | "invalidPoint" | "selfIntersecting" | "zeroArea";

export function checkBoundary(points: LngLat[]): BoundaryProblem | null {
  const open = openRing(points);
  if (!open.every(isValidLngLat)) return "invalidPoint";
  if (open.length < MIN_BOUNDARY_POINTS) return "tooFewPoints";
  if (open.length > MAX_BOUNDARY_POINTS) return "tooManyPoints";
  if (!isSimpleRing(open)) return "selfIntersecting";
  if (ringAreaSqM(open) <= 0) return "zeroArea";
  return null;
}

/** EWKT for a PostGIS geography(Polygon, 4326) column. Input must already be validated. */
export function toEwktPolygon(points: LngLat[]): string {
  const ring = closeRing(points)
    .map(([lng, lat]) => `${lng.toFixed(7)} ${lat.toFixed(7)}`)
    .join(",");
  return `SRID=4326;POLYGON((${ring}))`;
}

/** Reads the outer ring of a GeoJSON Polygon (as returned by the `boundary_geojson` field). */
export function ringFromGeoJson(geojson: unknown): LngLat[] | null {
  if (!geojson || typeof geojson !== "object") return null;
  const { type, coordinates } = geojson as { type?: unknown; coordinates?: unknown };
  if (type !== "Polygon" || !Array.isArray(coordinates) || !Array.isArray(coordinates[0])) return null;
  const ring = coordinates[0] as unknown[];
  return ring.every(isValidLngLat) ? openRing(ring as LngLat[]) : null;
}
