import { z } from "zod";

// Weather forecasts, normalised from the provider (SYSTEM_ARCHITECTURE.md section 13). Everything
// here comes from weather models: the days ahead are a FORECAST, and "now" and the past days are
// model ESTIMATES for the area, not measurements from a thermometer or rain gauge.

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

/** Estimated rain on the days before today (from weather models, not rain gauges). */
export type RecentRain = {
  days: { date: string; rainMm: number | null }[];
  /** Total over the days, or null if any day is missing (a partial total would mislead). */
  totalMm: number | null;
  /** Days with 2.5 mm or more: IMD's definition of a rainy day. */
  rainyDays: number;
};

export type Forecast = {
  source: "Open-Meteo";
  /** When we fetched it (ISO). */
  fetchedAt: string;
  now: { time: string; kind: WeatherKind; temperatureC: number; windKmh: number } | null;
  /** Today and the days ahead. */
  days: ForecastDay[];
  /** The days before today, if the provider sent them. */
  recent: RecentRain | null;
};

/** IMD: a day with 2.5 mm of rain or more is a rainy day. */
export const RAINY_DAY_MM = 2.5;

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

export function recentRain(days: { date: string; rainMm: number | null }[]): RecentRain | null {
  if (days.length === 0) return null;
  const known = days.every((d) => d.rainMm !== null);
  return {
    days,
    totalMm: known ? round1(days.reduce((sum, d) => sum + (d.rainMm ?? 0), 0)) : null,
    rainyDays: days.filter((d) => d.rainMm !== null && d.rainMm >= RAINY_DAY_MM).length,
  };
}

/**
 * Validates and normalises a provider response; null if it is not in the expected shape. Days
 * before `today` (India) are the recent past; today and later are the forecast.
 */
export function normalizeOpenMeteo(json: unknown, fetchedAt: string, today: string, maxDays = 7): Forecast | null {
  const parsed = openMeteoSchema.safeParse(json);
  if (!parsed.success) return null;
  const { current, daily } = parsed.data;
  const all = daily.time.map((date, i) => ({ date, i }));
  const past = all.filter((d) => d.date < today);
  const days: ForecastDay[] = all.filter((d) => d.date >= today).slice(0, maxDays).map(({ date, i }) => ({
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
    recent: recentRain(past.map(({ date, i }) => ({ date, rainMm: round1(daily.precipitation_sum[i]) }))),
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
