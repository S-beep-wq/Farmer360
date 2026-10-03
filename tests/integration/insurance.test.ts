import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listInsuranceForCrop } from "@/features/insurance/repository";
import { matchInsurance } from "@/features/insurance/rules";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { adminClient, anonClient, deleteTestUsers, signInWithTestPhone, TEST_PHONES } from "../support/supabase";

// Crop insurance information against the local Supabase stack: loading by the team (service
// role), validation, and read-only access for farmers.

type Client = SupabaseClient<Database>;

const PREFIX = "it-insurance-";
const PHONES = [TEST_PHONES.integrationA];
let farmer: Client;
let wheatId: string;

const text = (name: string) => ({
  name,
  summary: `${name} summary`,
  eligibility: "Rules from the official source.",
  coverage: "Losses covered.",
  premium: "What the farmer pays.",
  important_dates: "Enrolment window.",
  claim_process: "Report damage to the insurer.",
});

function product(slug: string, fields: Record<string, unknown> = {}) {
  return {
    slug: `${PREFIX}${slug}`,
    provider: "Test programme",
    state: "Bihar",
    districts: [],
    crops: ["Wheat"],
    seasons: ["rabi"],
    enrollment_deadline: null,
    official_url: "https://example.gov.in/enrol",
    source_name: "Official portal",
    source_url: "https://example.gov.in/insurance",
    last_verified_at: "2026-09-01",
    texts: { hi: text(`${slug} hi`), en: text(`${slug} en`) },
    ...fields,
  };
}

const importProduct = (p: object) => adminClient().rpc("import_insurance_product", { p });
const server = (c: Client) => c as unknown as ServerSupabaseClient;

async function cleanUp() {
  const { error } = await adminClient().from("insurance_products").delete().like("slug", `${PREFIX}%`);
  if (error) throw error;
}

beforeAll(async () => {
  await cleanUp();
  await deleteTestUsers(PHONES);
  ({ client: farmer } = await signInWithTestPhone(TEST_PHONES.integrationA));
  await farmer.from("farmers").insert({ full_name: "Test", preferred_language: "en", state: "Bihar", district: "Vaishali", village: "Hajipur" }).throwOnError();
  wheatId = (await farmer.from("crop_catalog").select("id").eq("name", "Wheat").single().throwOnError()).data.id;
});

afterAll(async () => {
  await cleanUp();
  await deleteTestUsers(PHONES);
});

describe("loading insurance information (team only)", () => {
  it("creates and updates a product with both languages and its crops", async () => {
    const first = await importProduct(product("wheat"));
    expect(first.error).toBeNull();
    const again = await importProduct(product("wheat", { crops: ["Wheat", "Mustard"], texts: { hi: text("new hi"), en: text("new en") } }));
    expect(again.data).toBe(first.data);
    const admin = adminClient();
    expect((await admin.from("insurance_crops").select("crop_id").eq("product_id", first.data)).data).toHaveLength(2);
    expect((await admin.from("insurance_texts").select("name").eq("product_id", first.data).eq("locale", "en").single()).data).toEqual({ name: "new en" });
  });

  it("refuses incomplete information and saves nothing", async () => {
    const bad = [
      product("bad-crops", { crops: [] }),
      product("bad-unknown-crop", { crops: ["Dragonfruit"] }),
      product("bad-source", { source_url: "" }),
      product("bad-future", { last_verified_at: "2099-01-01" }),
      product("bad-lang", { texts: { hi: text("only hi") } }),
      product("bad-claim", { texts: { hi: { ...text("x"), claim_process: "" }, en: text("x") } }),
      product("bad-url", { official_url: "http://example.gov.in" }),
    ];
    for (const p of bad) {
      expect((await importProduct(p)).error, p.slug).not.toBeNull();
    }
    const { count } = await adminClient().from("insurance_products").select("*", { count: "exact", head: true }).like("slug", `${PREFIX}bad-%`);
    expect(count).toBe(0);
  });

  it("cannot be done by farmers or anyone signed out", async () => {
    expect((await farmer.rpc("import_insurance_product", { p: product("farmer") })).error).not.toBeNull();
    expect((await anonClient().rpc("import_insurance_product", { p: product("anon") })).error).not.toBeNull();
    expect((await farmer.from("insurance_products").insert({ slug: `${PREFIX}x` } as never)).error?.code).toBe("42501");
  });
});

describe("reading insurance information", () => {
  it("lists published products covering a crop, for signed-in users only", async () => {
    await importProduct(product("archived", { status: "ARCHIVED" }));
    await importProduct(product("kharif", { seasons: ["kharif"] }));
    await importProduct(product("maize", { crops: ["Maize"] }));
    const names = (await listInsuranceForCrop(server(farmer), wheatId, "en")).map((p) => p.text.name).filter((n) => n.endsWith(" en")).sort();
    expect(names).toEqual(["kharif en", "new en"]);
    expect((await anonClient().from("insurance_products").select("id")).data ?? []).toEqual([]);
  });

  it("applies only in the crop's season", async () => {
    const products = (await listInsuranceForCrop(server(farmer), wheatId, "en")).filter((p) => p.text.name.endsWith(" en"));
    const applying = products
      .filter((p) => matchInsurance(p, { state: "Bihar", district: "Vaishali" }, { crop_id: wheatId, season: "rabi" }, "2026-10-03").applies)
      .map((p) => p.text.name);
    expect(applying).toEqual(["new en"]);
  });
});
