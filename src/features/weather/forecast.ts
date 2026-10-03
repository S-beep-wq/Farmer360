import { z } from "zod";

// Weather forecasts, normalised from the provider (SYSTEM_ARCHITECTURE.md section 13). Everything
// here is a FORECAST from weather models; the "now" values are model estimates, not measurements.

/** The parts of an Open-Meteo /v1/forecast response we use (https://open-meteo.com/en/docs). */
export const openMeteoSchema = z.object({
  current: z
    .object({
      time: z.string(),
      temperature_2m: z.number(),
      weather_code: z.number(),
      wind_speed_10m: z.number(),
    })
    .optional(),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: z.array(z.number().nullable()),
    temperature_2m_max: z.array(z.number().nullable()),
    temperature_2m_min: z.array(z.number().nullable()),
    precipitation_sum: z.array(z.number().nullable()),
    precipitation_probability_max: z.array(z.number().nullable()),
    wind_speed_10m_max: z.array(z.number().nullable()),
  }),
});

export type ForecastDay = {
  date: string;
  kind: WeatherKind;
  tMaxC: number | null;
  tMinC: number | null;
  rainMm: number | null;
  rainChance: number | null;
  windMaxKmh: number | null;
};

export type Forecast = {
  source: "Open-Meteo";
  /** When we fetched it (ISO). */
  fetchedAt: string;
  now: { time: string; kind: WeatherKind; temperatureC: number; windKmh: number } | null;
  days: ForecastDay[];
};

export const WEATHER_KINDS = ["CLEAR", "PARTLY_CLOUDY", "CLOUDY", "FOG", "DRIZZLE", "RAIN", "SHOWERS", "THUNDERSTORM", "SNOW", "UNKNOWN"] as const;
export type WeatherKind = (typeof WEATHER_KINDS)[number];

/** WMO weather interpretation codes (as used by Open-Meteo) grouped into simple kinds. */
export function weatherKind(code: number | null | undefined): WeatherKind {
  if (code === null || code === undefined) return "UNKNOWN";
  if (code === 0) return "CLEAR";
  if (code === 1 || code === 2) return "PARTLY_CLOUDY";
  if (code === 3) return "CLOUDY";
  if (code === 45 || code === 48) return "FOG";
  if (code >= 51 && code <= 57) return "DRIZZLE";
  if ((code >= 61 && code <= 67)) return "RAIN";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "SNOW";
  if (code >= 80 && code <= 82) return "SHOWERS";
  if (code >= 95 && code <= 99) return "THUNDERSTORM";
  return "UNKNOWN";
}

const round1 = (n: number | null | undefined) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);

/** Validates and normalises a provider response; null if it is not in the expected shape. */
export function normalizeOpenMeteo(json: unknown, fetchedAt: string, maxDays = 7): Forecast | null {
  const parsed = openMeteoSchema.safeParse(json);
  if (!parsed.success) return null;
  const { current, daily } = parsed.data;
  const days: ForecastDay[] = daily.time.slice(0, maxDays).map((date, i) => ({
    date,
    kind: weatherKind(daily.weather_code[i]),
    tMaxC: round1(daily.temperature_2m_max[i]),
    tMinC: round1(daily.temperature_2m_min[i]),
    rainMm: round1(daily.precipitation_sum[i]),
    rainChance: daily.precipitation_probability_max[i] ?? null,
    windMaxKmh: round1(daily.wind_speed_10m_max[i]),
  }));
  if (days.length === 0) return null;
  return {
    source: "Open-Meteo",
    fetchedAt,
    now: current
      ? { time: current.time, kind: weatherKind(current.weather_code), temperatureC: round1(current.temperature_2m)!, windKmh: round1(current.wind_speed_10m)! }
      : null,
    days,
  };
}

/**
 * Rainfall in a day, in the India Meteorological Department's categories (24-hour totals):
 * very light < 2.5 mm, light 2.5–15.5, moderate 15.6–64.4, heavy 64.5–115.5,
 * very heavy 115.6–204.4, extremely heavy ≥ 204.5.
 */
export const RAIN_CATEGORIES = ["NONE", "VERY_LIGHT", "LIGHT", "MODERATE", "HEAVY", "VERY_HEAVY", "EXTREMELY_HEAVY"] as const;
export type RainCategory = (typeof RAIN_CATEGORIES)[number];

export function rainCategory(mm: number | null): RainCategory {
  if (mm === null || mm < 0.1) return "NONE";
  if (mm < 2.5) return "VERY_LIGHT";
  if (mm < 15.6) return "LIGHT";
  if (mm < 64.5) return "MODERATE";
  if (mm < 115.6) return "HEAVY";
  if (mm < 204.5) return "VERY_HEAVY";
  return "EXTREMELY_HEAVY";
}

/** A day to point out: heavy rain or worse, or a very hot day (40 °C or more, IMD's heat-wave base for the plains). */
export function dayWarnings(day: ForecastDay): ("HEAVY_RAIN" | "VERY_HOT")[] {
  const warnings: ("HEAVY_RAIN" | "VERY_HOT")[] = [];
  if (["HEAVY", "VERY_HEAVY", "EXTREMELY_HEAVY"].includes(rainCategory(day.rainMm))) warnings.push("HEAVY_RAIN");
  if (day.tMaxC !== null && day.tMaxC >= 40) warnings.push("VERY_HOT");
  return warnings;
}
