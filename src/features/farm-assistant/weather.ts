import "server-only";

import { fetchForecast } from "@/features/weather/provider";

import type { FarmContext } from "./context";

const MAX_PLOTS = 2;

/**
 * Adds forecasts for the plots the question is about: plots with a current crop first, at most
 * two distinct (rounded) locations. Plots without a location, or a provider failure, simply leave
 * the forecast out; the assistant is then told it has no weather data.
 */
export async function withWeather(context: FarmContext): Promise<FarmContext> {
  const cropPlots = new Set(context.crops.map((c) => c.plot));
  const ordered = [...context.plots].sort((a, b) => Number(cropPlots.has(b.name)) - Number(cropPlots.has(a.name)));
  const chosen = new Map<string, { plot: string; point: NonNullable<FarmContext["plots"][number]["point"]> }>();
  for (const p of ordered) {
    if (!p.point) continue;
    const key = `${p.point.lat},${p.point.lon}`;
    if (!chosen.has(key)) chosen.set(key, { plot: p.name, point: p.point });
    if (chosen.size === MAX_PLOTS) break;
  }
  const forecasts = await Promise.all([...chosen.values()].map(async (c) => ({ plot: c.plot, forecast: await fetchForecast(c.point) })));
  return {
    ...context,
    weather: forecasts.filter((f) => f.forecast !== null).map((f) => ({ plot: f.plot, days: f.forecast!.days })),
  };
}
