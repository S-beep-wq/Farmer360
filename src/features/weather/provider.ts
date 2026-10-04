import "server-only";

import { todayInIndia } from "@/features/crops/dates";

import { normalizeOpenMeteo, type Forecast } from "./forecast";
import type { WeatherPoint } from "./location";

// Open-Meteo forecast API (https://open-meteo.com/en/docs). Free for non-commercial use; a
// commercial deployment sets OPEN_METEO_API_KEY (customer API). WEATHER_API_URL overrides the base
// URL (tests use a local stand-in). Forecasts are cached for an hour per (rounded) point.
// The same request also returns the past 7 days (model estimates, not rain-gauge readings).

const DAILY = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max";
const CURRENT = "temperature_2m,weather_code,wind_speed_10m";

function baseUrl(): string {
  if (process.env.WEATHER_API_URL) return process.env.WEATHER_API_URL;
  return process.env.OPEN_METEO_API_KEY ? "https://customer-api.open-meteo.com" : "https://api.open-meteo.com";
}

export function forecastUrl(point: WeatherPoint): string {
  const params = new URLSearchParams({
    latitude: String(point.lat),
    longitude: String(point.lon),
    daily: DAILY,
    current: CURRENT,
    timezone: "Asia/Kolkata",
    forecast_days: "7",
    past_days: "7",
  });
  if (process.env.OPEN_METEO_API_KEY) params.set("apikey", process.env.OPEN_METEO_API_KEY);
  return `${baseUrl()}/v1/forecast?${params}`;
}

/** The 7-day forecast (and estimated rain in the 7 days before) for a point, or null when the provider cannot be reached or answers oddly. */
export async function fetchForecast(point: WeatherPoint): Promise<Forecast | null> {
  try {
    const response = await fetch(forecastUrl(point), { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      console.error("weather: provider error", { status: response.status });
      return null;
    }
    const forecast = normalizeOpenMeteo(await response.json(), new Date().toISOString(), todayInIndia());
    if (!forecast) console.error("weather: unexpected response shape");
    return forecast;
  } catch (error) {
    console.error("weather: request failed", { message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
