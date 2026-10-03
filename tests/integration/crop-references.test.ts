import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listCropReferences } from "@/features/planning/repository";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { adminClient, anonClient, deleteTestUsers, signInWithTestPhone, TEST_PHONES } from "../support/supabase";

// Crop reference data for planning: loading by the team (service role), validation, and
// read-only access for farmers.

type Client = SupabaseClient<Database>;

const PREFIX = "it-ref-";
const PHONES = [TEST_PHONES.integrationA];
let farmer: Client;

const text = (lang: string) => ({ input_needs: `Seed, compost (${lang})`, production_risks: `Late sowing (${lang})`, market_notes: null });

function reference(slug: string, fields: Record<string, unknown> = {}) {
  return {
    slug: `${PREFIX}${slug}`,
    crop: "Wheat",
    season: "rabi",
    state: "Bihar",
    districts: [],
    duration_days_min: 110,
    duration_days_max: 130,
    water_need: "MEDIUM",
    cost_per_acre_min: 15000,
    cost_per_acre_max: 20000,
    yield_kg_per_acre_min: 1200,
    yield_kg_per_acre_max: 1600,
    price_per_quintal_min: 2000,
    price_per_quintal_max: 2400,
    source_name: "Test source",
    source_url: "https://example.gov.in/costs",
    last_verified_at: "2026-09-01",
    texts: { hi: text("hi"), en: text("en") },
    ...fields,
  };
}

const importRef = (p: object) => adminClient().rpc("import_crop_reference", { p });
const server = (c: Client) => c as unknown as ServerSupabaseClient;

async function cleanUp() {
  const { error } = await adminClient().from("crop_references").delete().like("slug", `${PREFIX}%`);
  if (error) throw error;
}

beforeAll(async () => {
  await cleanUp();
  await deleteTestUsers(PHONES);
  ({ client: farmer } = await signInWithTestPhone(TEST_PHONES.integrationA));
});

afterAll(async () => {
  await cleanUp();
  await deleteTestUsers(PHONES);
});

describe("loading reference data (team only)", () => {
  it("creates and updates a reference with both languages", async () => {
    const first = await importRef(reference("wheat"));
    expect(first.error).toBeNull();
    const again = await importRef(reference("wheat", { cost_per_acre_max: 21000, labour_days_per_acre_min: 20, labour_days_per_acre_max: 30 }));
    expect(again.data).toBe(first.data);
    const { data } = await adminClient().from("crop_references").select("cost_per_acre_max, labour_days_per_acre_min").eq("id", first.data).single();
    expect(data).toEqual({ cost_per_acre_max: 21000, labour_days_per_acre_min: 20 });
  });

  it("allows leaving out numbers the source does not give", async () => {
    const partial = reference("partial", { crop: "Lentil (masoor)" }) as Record<string, unknown>;
    for (const k of ["cost_per_acre_min", "cost_per_acre_max", "price_per_quintal_min", "price_per_quintal_max"]) delete partial[k];
    expect((await importRef(partial)).error).toBeNull();
  });

  it("refuses rows without a source or check date, with an unknown crop, broken ranges, zeros or one language", async () => {
    const bad = [
      reference("bad-source", { source_url: "" }),
      reference("bad-future", { last_verified_at: "2099-01-01" }),
      reference("bad-crop", { crop: "Lentil" }),
      reference("bad-season", { season: "monsoon" }),
      reference("bad-range", { cost_per_acre_min: 30000, cost_per_acre_max: 20000 }),
      reference("bad-half", { yield_kg_per_acre_max: null }),
      reference("bad-zero", { price_per_quintal_min: 0 }),
      reference("bad-water", { water_need: "LOTS" }),
      reference("bad-lang", { texts: { en: text("en") } }),
    ];
    for (const r of bad) expect((await importRef(r)).error, r.slug).not.toBeNull();
    const { count } = await adminClient().from("crop_references").select("*", { count: "exact", head: true }).like("slug", `${PREFIX}bad-%`);
    expect(count).toBe(0);
  });

  it("cannot be done by farmers or anyone signed out", async () => {
    expect((await farmer.rpc("import_crop_reference", { p: reference("farmer") })).error).not.toBeNull();
    expect((await anonClient().rpc("import_crop_reference", { p: reference("anon") })).error).not.toBeNull();
    expect((await farmer.from("crop_references").insert({ slug: `${PREFIX}x` } as never)).error?.code).toBe("42501");
  });
});

describe("reading reference data", () => {
  it("gives farmers published references for a season, in their language", async () => {
    await importRef(reference("archived", { status: "ARCHIVED" }));
    await importRef(reference("kharif-maize", { crop: "Maize", season: "kharif" }));
    const rabi = (await listCropReferences(server(farmer), "rabi", "hi")).filter((r) => r.source_name === "Test source");
    expect(rabi.map((r) => r.season)).toEqual(["rabi", "rabi"]);
    const wheat = rabi.find((r) => r.cost_per_acre_max === 21000)!;
    expect(wheat.text).toEqual({ input_needs: "Seed, compost (hi)", production_risks: "Late sowing (hi)", market_notes: null });
    expect((await listCropReferences(server(farmer), "kharif", "en")).some((r) => r.source_name === "Test source")).toBe(true);
    expect((await anonClient().from("crop_references").select("id")).data ?? []).toEqual([]);
  });
});
