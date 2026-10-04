import type { Server } from "node:http";

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { todayInIndia } from "@/features/crops/dates";
import { loadFarmContext } from "@/features/farm-assistant/repository";
import { withWeather } from "@/features/farm-assistant/weather";
import { fetchImdRainfall, fetchImdWarnings, isImdEnabled } from "@/features/weather/imd-provider";
import { fetchForecast } from "@/features/weather/provider";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { startMockAnthropic, type MockRequest } from "../support/mock-anthropic";
import { deleteTestUsers, signInWithTestPhone, TEST_PHONES } from "../support/supabase";

// Weather forecasts from the provider (a local stand-in shaped like Open-Meteo), and the forecast
// added to the farm assistant's context for the plots a question is about.

type Client = SupabaseClient<Database>;

const PHONES = [TEST_PHONES.integrationA];
const TODAY = todayInIndia();

let mock: { server: Server; url: string; requests: MockRequest[] };
let a: Client;
let pinnedCycle: string;
let unlocatedCycle: string;

const server = (c: Client) => c as unknown as ServerSupabaseClient;
const opts = { locale: "en" as const, today: TODAY, district: "Vaishali", state: "Bihar" };

beforeAll(async () => {
  mock = await startMockAnthropic();
  process.env.WEATHER_API_URL = mock.url;
  await deleteTestUsers(PHONES);
  ({ client: a } = await signInWithTestPhone(TEST_PHONES.integrationA));
  await a.from("farmers").insert({ full_name: "T", preferred_language: "en", state: "Bihar", district: "Vaishali", village: "V" }).throwOnError();
  const { data: farm } = await a.from("farms").insert({ name: "Farm" }).select("id").single().throwOnError();
  const plot = async (name: string, pin: boolean) =>
    (
      await a
        .from("plots")
        .insert({ farm_id: farm.id, name, area: 1, area_unit: "acre", ...(pin ? { latitude: 25.6123, longitude: 85.1389, location_source: "map_pin" } : {}) })
        .select("id")
        .single()
        .throwOnError()
    ).data.id;
  const { data: maize } = await a.from("crop_catalog").select("id").eq("name", "Maize").single().throwOnError();
  const cycle = async (plotId: string) =>
    (await a.from("crop_cycles").insert({ plot_id: plotId, crop_id: maize.id, season: "kharif", status: "ACTIVE", actual_sowing_date: TODAY }).select("id").single().throwOnError()).data.id;
  pinnedCycle = await cycle(await plot("Pinned plot", true));
  unlocatedCycle = await cycle(await plot("Unmapped plot", false));
});

afterAll(async () => {
  delete process.env.WEATHER_API_URL;
  delete process.env.IMD_API_URL;
  delete process.env.IMD_RAINFALL_URL;
  mock.server.close();
  await deleteTestUsers(PHONES);
});

describe("fetchForecast", () => {
  it("gets 7 days for a rounded point", async () => {
    const f = await fetchForecast({ lat: 25.6, lon: 85.15 });
    expect(f?.days).toHaveLength(7);
    expect(f?.days[0].date).toBe(TODAY);
    const sent = mock.requests.at(-1)!;
    expect(sent.path).toMatch(/^\/v1\/forecast\?/);
    expect(sent.body).toMatchObject({ latitude: "25.6", longitude: "85.15", timezone: "Asia/Kolkata", forecast_days: "7", past_days: "7" });
  });

  it("also gives the estimated rain of the 7 days before today", async () => {
    const f = await fetchForecast({ lat: 25.6, lon: 85.15 });
    expect(f?.recent?.days).toHaveLength(7);
    expect(f!.recent!.days.at(-1)!.date < TODAY).toBe(true);
    expect(f?.recent).toMatchObject({ totalMm: 16.7, rainyDays: 2 });
  });

  it("returns nothing (no crash) when the provider fails or answers oddly", async () => {
    expect(await fetchForecast({ lat: -1, lon: 0 })).toBeNull();
    expect(await fetchForecast({ lat: -2, lon: 0 })).toBeNull();
    process.env.WEATHER_API_URL = "http://127.0.0.1:1";
    expect(await fetchForecast({ lat: 25.6, lon: 85.15 })).toBeNull();
    process.env.WEATHER_API_URL = mock.url;
  });
});

describe("fetchImdWarnings", () => {
  it("is off, without any request, unless IMD_API_URL is set", async () => {
    delete process.env.IMD_API_URL;
    const before = mock.requests.length;
    expect(isImdEnabled()).toBe(false);
    expect(await fetchImdWarnings({ district: "Patna", state: "Bihar" })).toBeNull();
    expect(mock.requests.length).toBe(before);
  });

  it("gets the district's warnings when IMD is set up, and nothing for an unknown or ambiguous district", async () => {
    process.env.IMD_API_URL = `${mock.url}/imd/warnings`;
    const patna = await fetchImdWarnings({ district: "Patna", state: "Bihar" });
    expect(patna).toMatchObject({ source: "IMD", district: "Patna", issuedOn: TODAY });
    expect(patna?.days[0]).toEqual({ date: TODAY, level: "ORANGE", hazards: ["HEAVY_RAIN", "THUNDERSTORM"] });
    expect(mock.requests.at(-1)!.path).toBe("/imd/warnings");
    expect(await fetchImdWarnings({ district: "Nowhere", state: "Bihar" })).toBeNull();
    expect(await fetchImdWarnings({ district: "Aurangabad", state: "Bihar" })).toBeNull();
  });

  it("returns nothing (no crash) when IMD cannot be reached", async () => {
    process.env.IMD_API_URL = "http://127.0.0.1:1/imd";
    expect(await fetchImdWarnings({ district: "Patna", state: "Bihar" })).toBeNull();
    process.env.IMD_API_URL = `${mock.url}/imd/warnings`;
  });
});

describe("the farm assistant's weather", () => {
  it("adds the forecast for a plot with a location, asking for its rounded point only", async () => {
    const context = await withWeather((await loadFarmContext(server(a), { ...opts, cropCycleId: pinnedCycle }))!);
    expect(context.weather).toHaveLength(1);
    expect(context.weather[0].plot).toBe("Pinned plot");
    expect(context.weather[0].days[1]).toMatchObject({ rainMm: 80.4, kind: "RAIN" });
    expect(context.weather[0].recent).toMatchObject({ totalMm: 16.7, rainyDays: 2 });
    expect(context.imd).toMatchObject({ district: "Vaishali" });
    expect(mock.requests.findLast((r) => r.path.startsWith("/v1/forecast"))!.body).toMatchObject({ latitude: "25.6", longitude: "85.15" });
  });

  it("has no forecast for a plot without a location", async () => {
    const context = await withWeather((await loadFarmContext(server(a), { ...opts, cropCycleId: unlocatedCycle }))!);
    expect(context.weather).toEqual([]);
  });

  it("for the whole farm, uses the plots that have a location", async () => {
    const context = await withWeather((await loadFarmContext(server(a), opts))!);
    expect(context.weather.map((w) => w.plot)).toEqual(["Pinned plot"]);
  });
});

describe("IMD measured rainfall", () => {
  it("is off, without any request, unless IMD_RAINFALL_URL is set", async () => {
    delete process.env.IMD_RAINFALL_URL;
    const before = mock.requests.length;
    expect(await fetchImdRainfall({ district: "Patna", state: "Bihar" })).toBeNull();
    expect(mock.requests.length).toBe(before);
  });

  it("gets the district's measured rain when set up, and nothing for an unknown district or when IMD is down", async () => {
    process.env.IMD_RAINFALL_URL = `${mock.url}/imd/rainfall`;
    const patna = await fetchImdRainfall({ district: "Patna", state: "Bihar" });
    expect(patna).toMatchObject({ source: "IMD", district: "Patna", date: TODAY, day: { actualMm: 12.4, category: "LE" } });
    expect(mock.requests.at(-1)!.path).toBe("/imd/rainfall");
    expect(await fetchImdRainfall({ district: "Nowhere", state: "Bihar" })).toBeNull();
    process.env.IMD_RAINFALL_URL = "http://127.0.0.1:1/imd";
    expect(await fetchImdRainfall({ district: "Patna", state: "Bihar" })).toBeNull();
    process.env.IMD_RAINFALL_URL = `${mock.url}/imd/rainfall`;
  });

  it("replaces the model's estimate of recent rain in the farm assistant's context", async () => {
    process.env.IMD_RAINFALL_URL = `${mock.url}/imd/rainfall`;
    const context = await withWeather((await loadFarmContext(server(a), { ...opts, cropCycleId: pinnedCycle }))!);
    expect(context.imdRain).toMatchObject({ district: "Vaishali", day: { actualMm: 0, category: "NR" } });
    expect(context.weather[0].recent).toBeNull();
    expect(context.weather[0].days).toHaveLength(7);
  });
});
