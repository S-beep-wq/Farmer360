import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listCurrentCrops, listSchemes } from "@/features/schemes/repository";
import { matchScheme, mayBeRelevant } from "@/features/schemes/rules";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { adminClient, anonClient, deleteTestUsers, signInWithTestPhone, TEST_PHONES } from "../support/supabase";

// Government scheme information against the local Supabase stack: loading by the team
// (service role), validation, and read-only access for farmers.

type Client = SupabaseClient<Database>;

const PREFIX = "it-scheme-";
const PHONES = [TEST_PHONES.integrationA];
let farmer: Client;

const text = (name: string) => ({
  name,
  summary: `${name} summary`,
  eligibility: "Rules from the official source.",
  benefit: "What the farmer gets.",
  required_documents: ["Aadhaar card", "Land record"],
  how_to_apply: "Apply at the block office.",
});

function scheme(slug: string, fields: Record<string, unknown> = {}) {
  return {
    slug: `${PREFIX}${slug}`,
    department: "Department of Agriculture",
    state: "Bihar",
    districts: [],
    crops: [],
    seasons: [],
    application_deadline: null,
    official_url: "https://example.gov.in/apply",
    source_name: "Official portal",
    source_url: "https://example.gov.in/scheme",
    last_verified_at: "2026-09-01",
    texts: { hi: text(`${slug} hi`), en: text(`${slug} en`) },
    ...fields,
  };
}

const importScheme = (p: object) => adminClient().rpc("import_scheme", { p });
const server = (c: Client) => c as unknown as ServerSupabaseClient;

async function cleanUp() {
  const { error } = await adminClient().from("government_schemes").delete().like("slug", `${PREFIX}%`);
  if (error) throw error;
}

beforeAll(async () => {
  await cleanUp();
  await deleteTestUsers(PHONES);
  ({ client: farmer } = await signInWithTestPhone(TEST_PHONES.integrationA));
  await farmer.from("farmers").insert({ full_name: "Test", preferred_language: "en", state: "Bihar", district: "Vaishali", village: "Hajipur" }).throwOnError();
  const { data: farm } = await farmer.from("farms").insert({ name: "Farm" }).select("id").single().throwOnError();
  const { data: plot } = await farmer.from("plots").insert({ farm_id: farm.id, name: "Plot", area: 1, area_unit: "acre" }).select("id").single().throwOnError();
  const { data: wheat } = await farmer.from("crop_catalog").select("id").eq("name", "Wheat").single().throwOnError();
  await farmer.from("crop_cycles").insert({ plot_id: plot.id, crop_id: wheat.id, season: "rabi", planned_sowing_date: "2026-11-15" }).throwOnError();
});

afterAll(async () => {
  await cleanUp();
  await deleteTestUsers(PHONES);
});

describe("loading schemes (team only)", () => {
  it("creates a scheme with both languages and its crops", async () => {
    const { data: id, error } = await importScheme(scheme("wheat", { districts: ["Vaishali"], crops: ["wheat"], seasons: ["rabi"] }));
    expect(error).toBeNull();
    const admin = adminClient();
    expect((await admin.from("scheme_texts").select("locale").eq("scheme_id", id).order("locale")).data).toEqual([{ locale: "en" }, { locale: "hi" }]);
    expect((await admin.from("scheme_crops").select("crop_id").eq("scheme_id", id)).data).toHaveLength(1);
  });

  it("updates the same scheme when imported again", async () => {
    const first = (await importScheme(scheme("update"))).data;
    const again = await importScheme(scheme("update", { texts: { hi: text("new hi"), en: text("new en") }, application_deadline: "2026-12-31" }));
    expect(again.data).toBe(first);
    const { data } = await adminClient().from("scheme_texts").select("name").eq("scheme_id", first).eq("locale", "en").single();
    expect(data!.name).toBe("new en");
  });

  it("refuses schemes without a source, a check date, both languages or known crops, and saves nothing", async () => {
    const bad = [
      scheme("bad-source", { source_url: "" }),
      scheme("bad-http", { source_url: "http://example.gov.in" }),
      scheme("bad-date", { last_verified_at: "" }),
      scheme("bad-future", { last_verified_at: "2099-01-01" }),
      scheme("bad-lang", { texts: { en: text("only en") } }),
      scheme("bad-crop", { crops: ["Dragonfruit"] }),
      scheme("bad-district", { state: null, districts: ["Patna"] }),
      scheme("bad-season", { seasons: ["monsoon"] }),
      scheme("bad-text", { texts: { hi: { ...text("x"), eligibility: "" }, en: text("x") } }),
    ];
    for (const s of bad) {
      const { error } = await importScheme(s);
      expect(error, s.slug).not.toBeNull();
    }
    const { count } = await adminClient().from("government_schemes").select("*", { count: "exact", head: true }).like("slug", `${PREFIX}bad-%`);
    expect(count).toBe(0);
  });

  it("cannot be done by farmers or anyone signed out", async () => {
    expect((await farmer.rpc("import_scheme", { p: scheme("farmer") })).error).not.toBeNull();
    expect((await anonClient().rpc("import_scheme", { p: scheme("anon") })).error).not.toBeNull();
    expect((await farmer.from("government_schemes").insert({ slug: `${PREFIX}x` } as never)).error?.code).toBe("42501");
    const { data: published } = await farmer.from("government_schemes").select("id").like("slug", `${PREFIX}wheat`).single();
    expect((await farmer.from("scheme_texts").update({ name: "changed" }).eq("scheme_id", published!.id)).error?.code).toBe("42501");
  });
});

describe("reading schemes", () => {
  it("is for signed-in users, and archived schemes are hidden", async () => {
    await importScheme(scheme("archived", { status: "ARCHIVED" }));
    const slugs = (await farmer.from("government_schemes").select("slug").like("slug", `${PREFIX}%`)).data!.map((s) => s.slug);
    expect(slugs).toContain(`${PREFIX}wheat`);
    expect(slugs).not.toContain(`${PREFIX}archived`);
    expect((await anonClient().from("government_schemes").select("id")).data ?? []).toEqual([]);
  });

  it("matches the farmer's district and crops", async () => {
    await importScheme(scheme("maize", { crops: ["Maize"] }));
    await importScheme(scheme("other-district", { districts: ["Patna"] }));
    const schemes = await listSchemes(server(farmer), "en");
    const crops = await listCurrentCrops(server(farmer));
    const result = Object.fromEntries(
      schemes
        .filter((s) => ["wheat en", "maize en", "other-district en"].includes(s.text.name))
        .map((s) => {
          const m = matchScheme(s, { state: "Bihar", district: "Vaishali" }, crops, "2026-10-03");
          return [s.text.name, { area: m.area, relevant: mayBeRelevant(m) }];
        }),
    );
    expect(result).toEqual({
      "wheat en": { area: "district", relevant: true },
      "maize en": { area: "state", relevant: false },
      "other-district en": { area: null, relevant: false },
    });
  });
});
