import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { todayInIndia } from "@/features/crops/dates";
import { listInterestedFarmers, listOpenDemands } from "@/features/market/repository";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { adminClient, anonClient, deleteTestUsers, signInWithTestPhone, TEST_PHONES } from "../support/supabase";

// Buyer discovery against the local Supabase stack: roles, demand, interest and their privacy.

type Client = SupabaseClient<Database>;

const PHONES = [TEST_PHONES.integrationA, TEST_PHONES.integrationB, TEST_PHONES.integrationBuyer, TEST_PHONES.integrationBuyer2, TEST_PHONES.integrationNoProfile];
const FARMER = { preferred_language: "hi", state: "Bihar", district: "Patna" };
const BUYER = { buyer_type: "LOCAL_TRADER", preferred_language: "hi", state: "Bihar", district: "Patna", location: "Bihta mandi" };
const TODAY = todayInIndia();
const LATER = (() => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString().slice(0, 10);
})();

let farmerA: Client;
let farmerB: Client;
let buyerX: Client;
let buyerY: Client;
let nobody: Client;
let buyerXUserId: string;
let wheatId: string;
let maizeId: string;
let demandId: string;
let farOffDemandId: string;

const server = (c: Client) => c as unknown as ServerSupabaseClient;

function demand(fields: Partial<Database["public"]["Tables"]["buyer_demands"]["Insert"]> = {}) {
  return {
    crop_id: wheatId,
    quantity: 20,
    quantity_unit: "quintal",
    demand_type: "INDICATIVE",
    required_date: LATER,
    state: "Bihar",
    district: "Patna",
    location: "Bihta",
    pickup_available: true,
    ...fields,
  };
}

beforeAll(async () => {
  await deleteTestUsers(PHONES);
  ({ client: farmerA } = await signInWithTestPhone(TEST_PHONES.integrationA));
  ({ client: farmerB } = await signInWithTestPhone(TEST_PHONES.integrationB));
  ({ client: buyerX, userId: buyerXUserId } = await signInWithTestPhone(TEST_PHONES.integrationBuyer));
  ({ client: buyerY } = await signInWithTestPhone(TEST_PHONES.integrationBuyer2));
  ({ client: nobody } = await signInWithTestPhone(TEST_PHONES.integrationNoProfile));
  await farmerA.from("farmers").insert({ ...FARMER, full_name: "Ramesh", village: "Bihta" }).throwOnError();
  await farmerB.from("farmers").insert({ ...FARMER, full_name: "Sita", village: "Maner", district: "Gaya" }).throwOnError();
  const crops = (await farmerA.from("crop_catalog").select("id, name").in("name", ["Wheat", "Maize"]).throwOnError()).data;
  wheatId = crops.find((c) => c.name === "Wheat")!.id;
  maizeId = crops.find((c) => c.name === "Maize")!.id;
});

afterAll(async () => {
  await deleteTestUsers(PHONES);
});

describe("buyers", () => {
  it("register with the phone from their login, not verified", async () => {
    const { data, error } = await buyerX
      .from("buyers")
      .insert({ ...BUYER, name: "Suresh Traders" })
      .select("phone, verification_status")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ phone: TEST_PHONES.integrationBuyer, verification_status: "NOT_VERIFIED" });
    await buyerY.from("buyers").insert({ ...BUYER, name: "Other Buyer" }).throwOnError();
  });

  it("cannot verify themselves", async () => {
    const onUpdate = await buyerX.from("buyers").update({ verification_status: "VERIFIED" } as never).eq("user_id", buyerXUserId);
    expect(onUpdate.error?.code).toBe("42501");
    const onInsert = await nobody.from("buyers").insert({ ...BUYER, name: "x", verification_status: "VERIFIED" } as never);
    expect(onInsert.error?.code).toBe("42501");
  });

  it("are a separate role: a login is a farmer or a buyer, never both", async () => {
    expect((await farmerA.from("buyers").insert({ ...BUYER, name: "Ramesh" })).error?.code).toBe("23514");
    expect((await buyerX.from("farmers").insert({ ...FARMER, full_name: "Suresh", village: "Bihta" })).error?.code).toBe("23514");
  });

  it("are visible to farmers, with their phone, but not to other buyers or anyone signed out", async () => {
    const seen = (await farmerA.from("buyers").select("name, phone").order("name")).data;
    expect(seen).toEqual([
      { name: "Other Buyer", phone: TEST_PHONES.integrationBuyer2 },
      { name: "Suresh Traders", phone: TEST_PHONES.integrationBuyer },
    ]);
    expect((await buyerY.from("buyers").select("name")).data).toEqual([{ name: "Other Buyer" }]);
    expect((await anonClient().from("buyers").select("name")).data ?? []).toEqual([]);
  });
});

describe("demand", () => {
  it("is published by buyers, with the quantity in kg worked out by the database", async () => {
    const { data, error } = await buyerX.from("buyer_demands").insert(demand()).select("id, demand_status, quantity_kg").single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ demand_status: "ACTIVE", quantity_kg: 2000 });
    demandId = data!.id;
    farOffDemandId = (
      await buyerX
        .from("buyer_demands")
        .insert(demand({ crop_id: maizeId, quantity: 5, quantity_unit: "tonne", demand_type: "CONFIRMED", state: "Uttar Pradesh", district: "Ballia" }))
        .select("id")
        .single()
        .throwOnError()
    ).data.id;
  });

  it("cannot be published by farmers, for a past date, or as already closed", async () => {
    expect((await farmerA.from("buyer_demands").insert(demand())).error?.code).toBe("42501");
    expect((await buyerX.from("buyer_demands").insert(demand({ required_date: "2020-01-01" }))).error?.code).toBe("23514");
    expect((await buyerX.from("buyer_demands").insert({ ...demand(), demand_status: "FULFILLED" } as never)).error?.code).toBe("42501");
  });

  it("cannot be rewritten after publishing (farmers may already have responded)", async () => {
    expect((await buyerX.from("buyer_demands").update({ quantity: 1 } as never).eq("id", demandId)).error?.code).toBe("42501");
  });

  it("is private to its buyer among buyers, and hidden from anyone signed out", async () => {
    expect((await buyerY.from("buyer_demands").select("id")).data).toEqual([]);
    expect((await buyerY.from("buyer_demands").update({ demand_status: "CANCELLED" }).eq("id", demandId).select("id")).data).toEqual([]);
    expect((await anonClient().from("buyer_demands").select("id")).data ?? []).toEqual([]);
  });

  it("is found by farmers with crop, place and quantity filters", async () => {
    const place = { state: "Bihar", district: "patna" };
    const ids = async (filters: Parameters<typeof listOpenDemands>[2]) =>
      (await listOpenDemands(server(farmerA), TODAY, filters, place)).map((d) => d.id).sort();
    expect(await ids({})).toEqual([demandId, farOffDemandId].sort());
    expect(await ids({ crop: maizeId })).toEqual([farOffDemandId]);
    expect(await ids({ area: "district" })).toEqual([demandId]);
    expect(await ids({ area: "state" })).toEqual([demandId]);
    expect(await ids({ have: 25, have_unit: "quintal" })).toEqual([demandId]);
    expect(await ids({ have: 10, have_unit: "quintal" })).toEqual([]);
  });
});

describe("interest", () => {
  it("is expressed by a farmer, once per demand", async () => {
    const { error } = await farmerA.from("demand_interests").insert({ demand_id: demandId, note: "15 quintal ready" });
    expect(error).toBeNull();
    expect((await farmerA.from("demand_interests").insert({ demand_id: demandId })).error?.code).toBe("23505");
  });

  it("cannot be made by a buyer or on another farmer's behalf", async () => {
    expect((await buyerY.from("demand_interests").insert({ demand_id: demandId })).error?.code).toBe("42501");
    const bFarmerId = (await farmerB.from("farmers").select("id").single().throwOnError()).data.id;
    const forged = await farmerA.from("demand_interests").insert({ demand_id: farOffDemandId, farmer_id: bFarmerId } as never);
    expect(forged.error?.code).toBe("42501");
  });

  it("shares the farmer's name, village and phone with that buyer only", async () => {
    const farmers = await listInterestedFarmers(server(buyerX), demandId);
    expect(farmers).toHaveLength(1);
    expect(farmers[0]).toMatchObject({ full_name: "Ramesh", village: "Bihta", district: "Patna", phone: TEST_PHONES.integrationA, note: "15 quintal ready" });
    expect(await listInterestedFarmers(server(buyerY), demandId)).toEqual([]);
    expect(await listInterestedFarmers(server(farmerB), demandId)).toEqual([]);
    // Buyers never read the farmers table itself.
    expect((await buyerX.from("farmers").select("id")).data).toEqual([]);
  });

  it("is counted for the buyer and hidden from other farmers", async () => {
    const { data } = await buyerX.from("buyer_demands").select("id, interests:demand_interests(count)").eq("id", demandId).single();
    expect(data!.interests).toEqual([{ count: 1 }]);
    expect((await farmerB.from("demand_interests").select("id")).data).toEqual([]);
  });
});

describe("closing demand", () => {
  it("is done once by its buyer, who cannot reopen it", async () => {
    const { data } = await buyerX.from("buyer_demands").update({ demand_status: "FULFILLED" }).eq("id", demandId).select("closed_at").single().throwOnError();
    expect(data.closed_at).not.toBeNull();
    expect((await buyerX.from("buyer_demands").update({ demand_status: "ACTIVE" }).eq("id", demandId)).error?.code).toBe("23514");
  });

  it("hides it from the market, but the farmer who responded can still look it up", async () => {
    const open = await listOpenDemands(server(farmerB), TODAY, {}, { state: "Bihar", district: "Gaya" });
    expect(open.map((d) => d.id)).toEqual([farOffDemandId]);
    expect((await farmerB.from("buyer_demands").select("id").eq("id", demandId)).data).toEqual([]);
    expect((await farmerA.from("buyer_demands").select("demand_status").eq("id", demandId).single()).data).toEqual({ demand_status: "FULFILLED" });
  });

  it("stops new interest", async () => {
    expect((await farmerB.from("demand_interests").insert({ demand_id: demandId })).error?.code).toBe("23514");
  });
});

describe("account deletion", () => {
  it("removes a buyer with their demand and the interest in it", async () => {
    await farmerB.from("demand_interests").insert({ demand_id: farOffDemandId }).throwOnError();
    expect((await buyerX.rpc("delete_my_account")).error).toBeNull();
    const admin = adminClient();
    const { count: demands } = await admin.from("buyer_demands").select("*", { count: "exact", head: true }).in("id", [demandId, farOffDemandId]);
    expect(demands).toBe(0);
    const { count: interests } = await admin.from("demand_interests").select("*", { count: "exact", head: true }).in("demand_id", [demandId, farOffDemandId]);
    expect(interests).toBe(0);
  });
});
