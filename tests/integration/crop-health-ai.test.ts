import type { Server } from "node:http";

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { insertAnalysis, listAnalyses, setFeedback } from "@/features/crop-health-ai/repository";
import { normalizeResult } from "@/features/crop-health-ai/rules";
import type { CropHealthResult } from "@/features/crop-health-ai/schema";
import { analyzeCropPhotos, CROP_HEALTH_MODEL, isCropHealthAiEnabled } from "@/features/crop-health-ai/service";
import { savePhoto } from "@/features/observations/repository";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { MOCK_ANSWER, startMockAnthropic, type MockRequest } from "../support/mock-anthropic";
import { deleteTestUsers, signInWithTestPhone, TEST_PHONES } from "../support/supabase";

// AI crop-health assistance: the AI service against a local stand-in for the Anthropic API, and
// the database rules for storing analyses (RLS, limits, the farmer's observation untouched).

type Client = SupabaseClient<Database>;

const PHONES = [TEST_PHONES.integrationA, TEST_PHONES.integrationB];
const PROFILE = { full_name: "Test Farmer", preferred_language: "en", state: "Bihar", district: "Vaishali", village: "Hajipur" };
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const JPEG_TYPE = { mime: "image/jpeg", ext: "jpg" } as const;
const CONTEXT = {
  locale: "en" as const,
  cropName: "Maize",
  season: "Kharif (monsoon)",
  daysSinceSowing: 31,
  observationDate: "2026-08-01",
  district: "Vaishali",
  state: "Bihar",
  farmerStatus: "PROBLEM",
  farmerNote: "Yellow leaves",
};

let mock: { server: Server; url: string; requests: MockRequest[] };
let a: Client;
let b: Client;
let farm: { farmerId: string; farmId: string; plotId: string; cycleId: string };
let withPhoto: string;
let withoutPhoto: string;

const server = (c: Client) => c as unknown as ServerSupabaseClient;
const result = normalizeResult(MOCK_ANSWER as CropHealthResult, "PROBLEM");
const analysis = { locale: "en", model: CROP_HEALTH_MODEL, result };

async function observation(photo: boolean) {
  const { data } = await a
    .from("crop_observations")
    .insert({ crop_cycle_id: farm.cycleId, observation_date: "2026-08-01", health_status: "PROBLEM", farmer_notes: "Yellow leaves" })
    .select("id")
    .single()
    .throwOnError();
  if (photo) {
    const path = `${farm.farmerId}/${farm.farmId}/${farm.plotId}/${farm.cycleId}/${data.id}/p.jpg`;
    const { error } = await savePhoto(server(a), data.id, path, JPEG, JPEG_TYPE, "p.jpg");
    if (error) throw error;
  }
  return data.id;
}

beforeAll(async () => {
  mock = await startMockAnthropic();
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_BASE_URL = mock.url;

  await deleteTestUsers(PHONES);
  ({ client: a } = await signInWithTestPhone(TEST_PHONES.integrationA));
  ({ client: b } = await signInWithTestPhone(TEST_PHONES.integrationB));
  const { data: farmer } = await a.from("farmers").insert(PROFILE).select("id").single().throwOnError();
  await b.from("farmers").insert(PROFILE).throwOnError();
  const { data: f } = await a.from("farms").insert({ name: "Farm" }).select("id").single().throwOnError();
  const { data: plot } = await a.from("plots").insert({ farm_id: f.id, name: "Plot", area: 1, area_unit: "acre" }).select("id").single().throwOnError();
  const { data: crop } = await a.from("crop_catalog").select("id").eq("name", "Maize").single().throwOnError();
  const { data: cycle } = await a
    .from("crop_cycles")
    .insert({ plot_id: plot.id, crop_id: crop.id, season: "kharif", status: "ACTIVE", actual_sowing_date: "2026-07-01" })
    .select("id")
    .single()
    .throwOnError();
  farm = { farmerId: farmer.id, farmId: f.id, plotId: plot.id, cycleId: cycle.id };
  withPhoto = await observation(true);
  withoutPhoto = await observation(false);
});

afterAll(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_BASE_URL;
  mock.server.close();
  await deleteTestUsers(PHONES);
});

describe("the AI service", () => {
  const photos = [{ data: JPEG, type: JPEG_TYPE }];

  it("is enabled only with an API key", () => {
    expect(isCropHealthAiEnabled()).toBe(true);
    const key = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(isCropHealthAiEnabled()).toBe(false);
    process.env.ANTHROPIC_API_KEY = key;
  });

  it("sends the photo and only the needed facts, and returns a checked, structured answer", async () => {
    const outcome = await analyzeCropPhotos(photos, CONTEXT);
    expect(outcome).toEqual({ ok: true, result, model: CROP_HEALTH_MODEL });

    const sent = mock.requests.at(-1)!.body;
    expect(sent).toMatchObject({ model: CROP_HEALTH_MODEL, fallbacks: "default", thinking: { type: "adaptive" } });
    const content = (sent.messages as { content: { type: string; source?: { data: string } }[] }[])[0].content;
    expect(content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: Buffer.from(JPEG).toString("base64") } });
    const text = JSON.stringify(content[1]);
    expect(text).toContain("Vaishali district");
    for (const personal of ["Test Farmer", "Hajipur", "+91"]) expect(text).not.toContain(personal);
  });

  it("is cautious when the photo is not usable", async () => {
    const outcome = await analyzeCropPhotos(photos, { ...CONTEXT, farmerNote: "[blurry]" });
    expect(outcome.ok && outcome.result).toMatchObject({ image_usable: false, possible_causes: [], confidence: "LOW", see_expert: true });
  });

  it("reports a refusal, an unavailable API and a malformed answer without throwing", async () => {
    expect(await analyzeCropPhotos(photos, { ...CONTEXT, farmerNote: "[refuse]" })).toEqual({ ok: false, reason: "refused" });
    expect(await analyzeCropPhotos(photos, { ...CONTEXT, farmerNote: "[fail]" })).toEqual({ ok: false, reason: "unavailable" });
    expect(await analyzeCropPhotos(photos, { ...CONTEXT, farmerNote: "[garbled]" })).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("storing analyses", () => {
  it("are kept separately: the farmer's own observation does not change", async () => {
    const before = (await a.from("crop_observations").select("*").eq("id", withPhoto).single()).data;
    expect((await insertAnalysis(server(a), withPhoto, analysis)).error).toBeNull();
    const after = (await a.from("crop_observations").select("*").eq("id", withPhoto).single()).data;
    expect(after).toEqual(before);
    const [saved] = await listAnalyses(server(a), withPhoto);
    expect(saved).toMatchObject({ model: CROP_HEALTH_MODEL, confidence: "MEDIUM", image_usable: true, see_expert: false, farmer_feedback: null });
    expect(saved.result.possible_causes).toHaveLength(2);
  });

  it("need a photo, and at most 3 per observation", async () => {
    expect((await insertAnalysis(server(a), withoutPhoto, analysis)).error?.code).toBe("23514");
    await insertAnalysis(server(a), withPhoto, analysis);
    await insertAnalysis(server(a), withPhoto, analysis);
    const fourth = await insertAnalysis(server(a), withPhoto, analysis);
    expect(fourth.error?.message).toContain("analysis_limit_observation");
  });

  it("are private to the farmer", async () => {
    expect((await b.from("crop_health_analyses").select("id")).data).toEqual([]);
    expect((await insertAnalysis(server(b), withPhoto, analysis)).error?.code).toBe("42501");
  });

  it("can only receive the farmer's feedback afterwards", async () => {
    const [first] = await listAnalyses(server(a), withPhoto);
    expect((await setFeedback(server(a), first.id, "HELPFUL")).updated).toBe(true);
    expect((await setFeedback(server(b), first.id, "NOT_HELPFUL")).updated).toBe(false);
    expect((await setFeedback(server(a), first.id, "GREAT")).error?.code).toBe("23514");
    const rewrite = await a.from("crop_health_analyses").update({ confidence: "HIGH" } as never).eq("id", first.id);
    expect(rewrite.error?.code).toBe("42501");
    const preset = await a.from("crop_health_analyses").insert({ observation_id: withPhoto, ...analysis, confidence: "LOW", image_usable: true, see_expert: false, farmer_feedback: "HELPFUL" } as never);
    expect(preset.error?.code).toBe("42501");
    expect((await a.from("crop_health_analyses").delete().eq("id", first.id)).error?.code).toBe("42501");
  });

  it("are limited to 20 per farmer per day", async () => {
    // 3 already on withPhoto; 6 more observations × 3 = 21 attempts in total.
    let lastError: string | undefined;
    for (let i = 0; i < 6 && !lastError; i++) {
      const id = await observation(true);
      for (let j = 0; j < 3; j++) {
        const { error } = await insertAnalysis(server(a), id, analysis);
        if (error) {
          lastError = error.message;
          break;
        }
      }
    }
    expect(lastError).toContain("analysis_limit_day");
    const { count } = await a.from("crop_health_analyses").select("id", { count: "exact", head: true });
    expect(count).toBe(20);
  });
});
