import "server-only";

import { fetchImdRainfall, fetchImdWarnings } from "@/features/weather/imd-provider";
import { fetchForecast } from "@/features/weather/provider";

import type { FarmContext } from "./context";

const MAX_PLOTS = 2;

/**
 * Adds IMD's warnings and measured rainfall for the farmer's district (when available) and
 * forecasts, with estimated recent rain unless IMD's measured rain is there, for the plots the
 * question is about: plots with a current crop first, at most
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
  const place = { district: context.district, state: context.state };
  const [forecasts, imd, imdRain] = await Promise.all([
    Promise.all([...chosen.values()].map(async (c) => ({ plot: c.plot, forecast: await fetchForecast(c.point) }))),
    fetchImdWarnings(place),
    fetchImdRainfall(place),
  ]);
  return {
    ...context,
    imd,
    imdRain,
    weather: forecasts
      .filter((f) => f.forecast !== null)
      .map((f) => ({ plot: f.plot, days: f.forecast!.days, recent: imdRain ? null : f.forecast!.recent })),
  };
}
