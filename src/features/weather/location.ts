import type { LngLat } from "@/features/plots/location/geo";

// Which point to ask the weather for. The plot's pin if it has one, else the middle of its
// boundary. Rounded to 0.05° (about 5 km), which is plenty for a forecast, keeps the farmer's exact
// field location away from the weather provider, and lets nearby plots share a cached forecast.

export type WeatherPoint = { lat: number; lon: number };

const GRID = 0.05;
const snap = (n: number) => Math.round(Math.round(n / GRID) * GRID * 100) / 100;

export function weatherPoint(plot: { latitude: number | null; longitude: number | null; boundary: LngLat[] | null }): WeatherPoint | null {
  if (plot.latitude !== null && plot.longitude !== null) return { lat: snap(plot.latitude), lon: snap(plot.longitude) };
  if (plot.boundary && plot.boundary.length > 0) {
    const lon = plot.boundary.reduce((s, p) => s + p[0], 0) / plot.boundary.length;
    const lat = plot.boundary.reduce((s, p) => s + p[1], 0) / plot.boundary.length;
    return { lat: snap(lat), lon: snap(lon) };
  }
  return null;
}
