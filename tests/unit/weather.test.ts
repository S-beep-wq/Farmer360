import { afterEach, describe, expect, it } from "vitest";

import { contextText, type FarmContext } from "@/features/farm-assistant/context";
import { dayWarnings, normalizeOpenMeteo, rainCategory, weatherKind } from "@/features/weather/forecast";
import { weatherPoint } from "@/features/weather/location";
import { forecastUrl } from "@/features/weather/provider";

import { mockForecast } from "../support/mock-anthropic";

const FETCHED = "2026-10-03T05:00:00.000Z";

describe("weatherKind", () => {
  it("groups WMO weather codes", () => {
    expect([0, 2, 3, 45, 53, 63, 75, 81, 95, 999, null].map(weatherKind)).toEqual([
      "CLEAR",
      "PARTLY_CLOUDY",
      "CLOUDY",
      "FOG",
      "DRIZZLE",
      "RAIN",
      "SNOW",
      "SHOWERS",
      "THUNDERSTORM",
      "UNKNOWN",
      "UNKNOWN",
    ]);
  });
});

describe("normalizeOpenMeteo", () => {
  it("turns a provider response into 7 forecast days and a 'now' estimate", () => {
    const f = normalizeOpenMeteo(mockForecast("2026-10-03"), FETCHED)!;
    expect(f.source).toBe("Open-Meteo");
    expect(f.fetchedAt).toBe(FETCHED);
    expect(f.now).toEqual({ time: "2026-10-03T10:00", kind: "PARTLY_CLOUDY", temperatureC: 31.2, windKmh: 9.4 });
    expect(f.days).toHaveLength(7);
    expect(f.days[1]).toEqual({ date: "2026-10-04", kind: "RAIN", tMaxC: 29.4, tMinC: 23.8, rainMm: 80.4, rainChance: 90, windMaxKmh: 30.1 });
  });

  it("copes with missing values and refuses an unexpected shape", () => {
    const json = mockForecast("2026-10-03");
    json.daily.precipitation_probability_max[0] = null as unknown as number;
    delete (json as { current?: unknown }).current;
    const f = normalizeOpenMeteo(json, FETCHED)!;
    expect(f.now).toBeNull();
    expect(f.days[0].rainChance).toBeNull();
    expect(normalizeOpenMeteo({ daily: "nope" }, FETCHED)).toBeNull();
    expect(normalizeOpenMeteo({ daily: { ...json.daily, time: [] } }, FETCHED)).toBeNull();
  });
});

describe("rainCategory (IMD 24-hour categories) and warnings", () => {
  it("uses the IMD boundaries", () => {
    expect([0, 0.05, 1, 2.5, 15.5, 15.6, 64.4, 64.5, 115.5, 115.6, 204.4, 204.5, null].map(rainCategory)).toEqual([
      "NONE",
      "NONE",
      "VERY_LIGHT",
      "LIGHT",
      "LIGHT",
      "MODERATE",
      "MODERATE",
      "HEAVY",
      "HEAVY",
      "VERY_HEAVY",
      "VERY_HEAVY",
      "EXTREMELY_HEAVY",
      "NONE",
    ]);
  });

  it("points out heavy rain and very hot days", () => {
    const day = { date: "2026-10-03", kind: "RAIN" as const, tMinC: 25, rainChance: 90, windMaxKmh: 10 };
    expect(dayWarnings({ ...day, tMaxC: 30, rainMm: 70 })).toEqual(["HEAVY_RAIN"]);
    expect(dayWarnings({ ...day, tMaxC: 40, rainMm: 20 })).toEqual(["VERY_HOT"]);
    expect(dayWarnings({ ...day, tMaxC: 39.9, rainMm: 64.4 })).toEqual([]);
  });
});

describe("weatherPoint", () => {
  it("uses the pin, else the middle of the boundary, rounded to about 5 km", () => {
    expect(weatherPoint({ latitude: 25.6123, longitude: 85.1389, boundary: null })).toEqual({ lat: 25.6, lon: 85.15 });
    const boundary: [number, number][] = [
      [85.0, 25.5],
      [85.002, 25.5],
      [85.002, 25.502],
      [85.0, 25.502],
    ];
    expect(weatherPoint({ latitude: null, longitude: null, boundary })).toEqual({ lat: 25.5, lon: 85 });
    expect(weatherPoint({ latitude: null, longitude: null, boundary: null })).toBeNull();
  });
});

describe("forecastUrl", () => {
  afterEach(() => {
    delete process.env.WEATHER_API_URL;
    delete process.env.OPEN_METEO_API_KEY;
  });

  it("asks Open-Meteo for 7 days in India time, using the customer API when a key is set", () => {
    const free = new URL(forecastUrl({ lat: 25.6, lon: 85.15 }));
    expect(free.origin).toBe("https://api.open-meteo.com");
    expect(free.searchParams.get("latitude")).toBe("25.6");
    expect(free.searchParams.get("timezone")).toBe("Asia/Kolkata");
    expect(free.searchParams.get("forecast_days")).toBe("7");
    expect(free.searchParams.has("apikey")).toBe(false);

    process.env.OPEN_METEO_API_KEY = "key";
    const paid = new URL(forecastUrl({ lat: 25.6, lon: 85.15 }));
    expect(paid.origin).toBe("https://customer-api.open-meteo.com");
    expect(paid.searchParams.get("apikey")).toBe("key");

    process.env.WEATHER_API_URL = "http://127.0.0.1:4010";
    expect(new URL(forecastUrl({ lat: 1, lon: 2 })).origin).toBe("http://127.0.0.1:4010");
  });
});

describe("weather in the farm assistant's context", () => {
  const base: FarmContext = {
    locale: "en",
    today: "2026-10-03",
    district: "Vaishali",
    state: "Bihar",
    oneCrop: false,
    plots: [{ name: "Back plot", farm: "Home farm", area: null, soil: null, irrigation: null, point: { lat: 25.6, lon: 85.15 } }],
    crops: [],
    activities: [],
    observations: [],
    weather: [],
  };

  it("labels a forecast as a forecast and never sends the plot's location", () => {
    const days = normalizeOpenMeteo(mockForecast("2026-10-03"), FETCHED)!.days;
    const text = contextText({ ...base, weather: [{ plot: "Back plot", days }] }, "Should I irrigate?");
    expect(text).toContain("Weather forecast from weather models (Open-Meteo). It is a forecast for the area, not a measurement, and can be wrong");
    expect(text).toContain('- Plot "Back plot":');
    expect(text).toContain("2026-10-04: rain, rain 80.4 mm (90% chance of rain), 23.8–29.4°C, wind up to 30.1 km/h");
    expect(text).not.toContain("25.6");
    expect(text).not.toContain("85.15");
  });

  it("says there is no weather when there is no forecast", () => {
    expect(contextText(base, "q")).toContain("Weather: not available to you");
  });
});
