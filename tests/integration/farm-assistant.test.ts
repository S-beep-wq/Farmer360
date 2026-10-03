import type { Server } from "node:http";

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { todayInIndia } from "@/features/crops/dates";
import { countQuestionsToday, listAssistantCrops, loadFarmContext, recordQuestion, setQuestionFeedback } from "@/features/farm-assistant/repository";
import { askFarmAssistant } from "@/features/farm-assistant/service";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { MOCK_ASSISTANT_ANSWER, startMockAnthropic, type MockRequest } from "../support/mock-anthropic";
import { deleteTestUsers, signInWithTestPhone, TEST_PHONES } from "../support/supabase";

// The AI farm assistant: the farm context built from the farmer's own records, the AI call
// against a local stand-in for the Anthropic API, and the metadata kept about each question.

type Client = SupabaseClient<Database>;

const PHONES = [TEST_PHONES.integrationA, TEST_PHONES.integrationB];
const PROFILE = { full_name: "Ramesh Kumar", preferred_language: "en", state: "Bihar", district: "Vaishali", village: "Hajipur" };
const TODAY = todayInIndia();
const daysAgo = (n: number) => new Date(Date.parse(`${TODAY}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
const META = { model: "claude-opus-5-5", confidence: "MEDIUM", asked_for_information: false, see_expert: false, about_one_crop: false };

let mock: { server: Server; url: string; requests: MockRequest[] };
let a: Client;
let b: Client;
let maizeCycle: string;
let wheatCycle: string;

const server = (c: Client) => c as unknown as ServerSupabaseClient;
const opts = { locale: "en" as const, today: TODAY, district: "Vaishali", state: "Bihar" };

beforeAll(async () => {
  mock = await startMockAnthropic();
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_BASE_URL = mock.url;
  await deleteTestUsers(PHONES);
  ({ client: a } = await signInWithTestPhone(TEST_PHONES.integrationA));
  ({ client: b } = await signInWithTestPhone(TEST_PHONES.integrationB));
  await a.from("farmers").insert(PROFILE).throwOnError();
  await b.from("farmers").insert(PROFILE).throwOnError();

  const { data: farm } = await a.from("farms").insert({ name: "Home farm" }).select("id").single().throwOnError();
  const plot = async (name: string) =>
    (await a.from("plots").insert({ farm_id: farm.id, name, area: 1, area_unit: "acre", soil_type: "loam" }).select("id").single().throwOnError()).data.id;
  const backPlot = await plot("Back plot");
  const frontPlot = await plot("Front plot");
  const crop = async (name: string) => (await a.from("crop_catalog").select("id").eq("name", name).single().throwOnError()).data.id;
  maizeCycle = (
    await a
      .from("crop_cycles")
      .insert({ plot_id: backPlot, crop_id: await crop("Maize"), season: "kharif", status: "ACTIVE", actual_sowing_date: daysAgo(30) })
      .select("id")
      .single()
      .throwOnError()
  ).data.id;
  wheatCycle = (
    await a
      .from("crop_cycles")
      .insert({ plot_id: frontPlot, crop_id: await crop("Wheat"), season: "rabi", planned_sowing_date: daysAgo(-20) })
      .select("id")
      .single()
      .throwOnError()
  ).data.id;
  await a.from("crop_activities").insert([
    { crop_cycle_id: maizeCycle, activity_type: "WEEDING", activity_date: daysAgo(10), cost: 600 },
    { crop_cycle_id: maizeCycle, activity_type: "SOWING", activity_date: daysAgo(40) },
    { crop_cycle_id: maizeCycle, activity_type: "IRRIGATION", activity_date: daysAgo(5), deleted_at: new Date().toISOString() },
  ]).throwOnError();
  await a.from("crop_observations").insert({ crop_cycle_id: maizeCycle, observation_date: daysAgo(2), health_status: "PROBLEM", farmer_notes: "Yellow leaves" }).throwOnError();
});

afterAll(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_BASE_URL;
  mock.server.close();
  await deleteTestUsers(PHONES);
});

describe("farm context", () => {
  it("lists the farmer's current crops to choose from", async () => {
    const crops = await listAssistantCrops(server(a), "en");
    expect(crops.map((c) => c.label)).toEqual(["Maize · Kharif (monsoon) · Back plot", "Wheat · Rabi (winter) · Front plot"]);
    expect(await listAssistantCrops(server(b), "en")).toEqual([]);
  });

  it("has the whole farm: crops with dates and costs, recent work and observations (not removed or older ones)", async () => {
    const c = (await loadFarmContext(server(a), opts))!;
    expect(c.oneCrop).toBe(false);
    expect(c.crops.map((x) => x.crop)).toEqual(["Maize", "Wheat"]);
    expect(c.crops[0]).toMatchObject({ status: "In the field", daysSinceSowing: 30, spentRupees: 600, plot: "Back plot" });
    expect(c.crops[1]).toMatchObject({ status: "Planned", plannedSowing: daysAgo(-20), sowing: null });
    expect(c.plots.map((p) => p.name)).toEqual(["Back plot", "Front plot"]);
    expect(c.activities).toEqual([{ date: daysAgo(10), crop: "Maize", type: "Weeding" }]);
    expect(c.observations).toEqual([{ date: daysAgo(2), crop: "Maize", status: "Some problem", note: "Yellow leaves" }]);
  });

  it("can be about one crop only, and never another farmer's crop", async () => {
    const one = (await loadFarmContext(server(a), { ...opts, cropCycleId: wheatCycle }))!;
    expect(one.oneCrop).toBe(true);
    expect(one.crops.map((x) => x.crop)).toEqual(["Wheat"]);
    expect(one.plots.map((p) => p.name)).toEqual(["Front plot"]);
    expect(one.activities).toEqual([]);
    expect(await loadFarmContext(server(b), { ...opts, cropCycleId: maizeCycle })).toBeNull();
  });
});

describe("asking the assistant", () => {
  it("sends the question with the farm records, but no name, village or phone, and returns a checked answer", async () => {
    const context = (await loadFarmContext(server(a), opts))!;
    const outcome = await askFarmAssistant("What should I do today?", context);
    expect(outcome).toEqual({ ok: true, answer: MOCK_ASSISTANT_ANSWER, model: "claude-opus-5-5" });

    const sent = mock.requests.at(-1)!.body;
    expect(sent).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default" });
    const text = JSON.stringify(sent.messages);
    expect(text).toContain("<farmer_question>What should I do today?</farmer_question>");
    expect(text).toContain("Maize (Kharif (monsoon))");
    expect(text).toContain("Yellow leaves");
    for (const personal of ["Ramesh", "Hajipur", "+91", TEST_PHONES.integrationA]) expect(text).not.toContain(personal);
  });

  it("makes unsure answers cautious, and reports failures without throwing", async () => {
    const context = (await loadFarmContext(server(a), opts))!;
    const unsure = await askFarmAssistant("Is it ok? [unsure]", context);
    expect(unsure.ok && unsure.answer).toMatchObject({ confidence: "LOW", see_expert: true });
    const missing = await askFarmAssistant("When to harvest? [missing]", context);
    expect(missing.ok && missing.answer).toMatchObject({ missing_information: ["Which maize variety did you sow?"], see_expert: false });
    expect(await askFarmAssistant("[refuse]", context)).toEqual({ ok: false, reason: "refused" });
    expect(await askFarmAssistant("[fail]", context)).toEqual({ ok: false, reason: "unavailable" });
    expect(await askFarmAssistant("[garbled]", context)).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("question metadata", () => {
  it("is kept without the question or answer, private to the farmer, with feedback only afterwards", async () => {
    const { id, error } = await recordQuestion(server(a), META);
    expect(error).toBeNull();
    const { data: row } = await a.from("ai_interactions").select("*").eq("id", id!).single();
    expect(Object.keys(row!).sort()).toEqual(
      ["about_one_crop", "asked_for_information", "confidence", "created_at", "farmer_feedback", "farmer_id", "id", "interaction_type", "model", "see_expert"].sort(),
    );
    expect((await b.from("ai_interactions").select("id")).data).toEqual([]);
    expect((await setQuestionFeedback(server(b), id!, "HELPFUL")).updated).toBe(false);
    expect((await setQuestionFeedback(server(a), id!, "HELPFUL")).updated).toBe(true);
    expect((await a.from("ai_interactions").update({ confidence: "HIGH" } as never).eq("id", id!)).error?.code).toBe("42501");
    const bFarmer = (await b.from("farmers").select("id").single().throwOnError()).data.id;
    expect((await a.from("ai_interactions").insert({ ...META, interaction_type: "FARM_QUESTION", farmer_id: bFarmer } as never)).error?.code).toBe("42501");
  });

  it("limits a farmer to 30 questions a day", async () => {
    for (let i = (await countQuestionsToday(server(a), `${TODAY}T00:00:00+05:30`)); i < 30; i++) {
      const { error } = await recordQuestion(server(a), META);
      expect(error).toBeNull();
    }
    const over = await recordQuestion(server(a), META);
    expect(over.error?.message).toContain("question_limit_day");
    expect(await countQuestionsToday(server(a), `${TODAY}T00:00:00+05:30`)).toBe(30);
  });
});
