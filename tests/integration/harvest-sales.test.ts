import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listHarvestsWithSales, removeSale } from "@/features/harvest-sales/repository";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { deleteTestUsers, signInWithTestPhone, TEST_PHONES } from "../support/supabase";

// Harvests and sales against the local Supabase stack (migrations, triggers, auth and RLS).

type Client = SupabaseClient<Database>;

const PHONES = [TEST_PHONES.integrationA, TEST_PHONES.integrationB];
const PROFILE = { full_name: "Test Farmer", preferred_language: "hi", state: "Bihar", district: "Patna", village: "Bihta" };

let a: Client;
let b: Client;
let aActiveCycle: string;
let aPlannedCycle: string;
let bActiveCycle: string;
let aHarvest: string;
let aOtherHarvest: string;
let aSale: string;

async function farmerWithCrops(client: Client) {
  await client.from("farmers").insert(PROFILE).throwOnError();
  const { data: farm } = await client.from("farms").insert({ name: "Farm" }).select("id").single().throwOnError();
  const { data: plot } = await client
    .from("plots")
    .insert({ farm_id: farm.id, name: "Plot", area: 1, area_unit: "acre" })
    .select("id")
    .single()
    .throwOnError();
  const { data: crop } = await client.from("crop_catalog").select("id").eq("name", "Rice (paddy)").single().throwOnError();
  const cycle = async (fields: Database["public"]["Tables"]["crop_cycles"]["Insert"]) =>
    (await client.from("crop_cycles").insert(fields).select("id").single().throwOnError()).data.id;
  return {
    active: await cycle({ plot_id: plot.id, crop_id: crop.id, season: "kharif", status: "ACTIVE", actual_sowing_date: "2026-07-01" }),
    planned: await cycle({ plot_id: plot.id, crop_id: crop.id, season: "rabi", planned_sowing_date: "2026-11-15" }),
  };
}

const server = (client: Client) => client as unknown as ServerSupabaseClient;

function sale(harvestId: string, fields: Partial<Database["public"]["Tables"]["sales"]["Insert"]> = {}) {
  return {
    harvest_id: harvestId,
    buyer_type: "MANDI",
    sale_date: "2026-10-01",
    quantity: 1,
    quantity_unit: "quintal",
    price_per_unit: 2300,
    payment_status: "PAID",
    ...fields,
  };
}

beforeAll(async () => {
  await deleteTestUsers(PHONES);
  ({ client: a } = await signInWithTestPhone(TEST_PHONES.integrationA));
  ({ client: b } = await signInWithTestPhone(TEST_PHONES.integrationB));
  ({ active: aActiveCycle, planned: aPlannedCycle } = await farmerWithCrops(a));
  ({ active: bActiveCycle } = await farmerWithCrops(b));
});

afterAll(async () => {
  await deleteTestUsers(PHONES);
});

describe("harvests", () => {
  it("are recorded for a crop in the field", async () => {
    const { data, error } = await a
      .from("harvests")
      .insert({ crop_cycle_id: aActiveCycle, harvest_date: "2026-09-30", quantity: 10, quantity_unit: "quintal", quality_grade: "GOOD" })
      .select("id")
      .single();
    expect(error).toBeNull();
    aHarvest = data!.id;
    aOtherHarvest = (
      await a
        .from("harvests")
        .insert({ crop_cycle_id: aActiveCycle, harvest_date: "2026-10-01", quantity: 500, quantity_unit: "kg" })
        .select("id")
        .single()
        .throwOnError()
    ).data.id;
  });

  it("are refused for a crop that is not sown, before sowing, or with bad values", async () => {
    const planned = await a.from("harvests").insert({ crop_cycle_id: aPlannedCycle, harvest_date: "2026-12-01", quantity: 1, quantity_unit: "kg" });
    expect(planned.error?.code).toBe("23514");
    const early = await a.from("harvests").insert({ crop_cycle_id: aActiveCycle, harvest_date: "2026-06-30", quantity: 1, quantity_unit: "kg" });
    expect(early.error?.code).toBe("23514");
    const unit = await a.from("harvests").insert({ crop_cycle_id: aActiveCycle, harvest_date: "2026-09-30", quantity: 1, quantity_unit: "bag" });
    expect(unit.error?.code).toBe("23514");
    const zero = await a.from("harvests").insert({ crop_cycle_id: aActiveCycle, harvest_date: "2026-09-30", quantity: 0, quantity_unit: "kg" });
    expect(zero.error?.code).toBe("23514");
  });

  it("are private to the farmer", async () => {
    expect((await b.from("harvests").select("id").eq("id", aHarvest)).data).toEqual([]);
    const intrusion = await b.from("harvests").insert({ crop_cycle_id: aActiveCycle, harvest_date: "2026-09-30", quantity: 1, quantity_unit: "kg" });
    expect(intrusion.error?.code).toBe("42501");
  });
});

describe("sales", () => {
  it("have their amounts calculated by the database", async () => {
    const { data, error } = await a
      .from("sales")
      .insert(sale(aHarvest, { quantity: 8, transport_cost: 400, other_cost: 200 }))
      .select("id, gross_amount, net_amount")
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ gross_amount: 18400, net_amount: 17800 });
    aSale = data!.id;

    // The app cannot send its own totals.
    const forged = await a.from("sales").insert({ ...sale(aHarvest), gross_amount: 1 } as never);
    expect(forged.error).not.toBeNull();
  });

  it("cannot sell more than was harvested (compared across units)", async () => {
    // 8 quintal sold of 10: 2 quintal (200 kg) left.
    const tooMuch = await a.from("sales").insert(sale(aHarvest, { quantity: 201, quantity_unit: "kg" }));
    expect(tooMuch.error?.code).toBe("23514");
    const exact = await a.from("sales").insert(sale(aHarvest, { quantity: 0.2, quantity_unit: "tonne" })).select("id").single();
    expect(exact.error).toBeNull();
    // Now fully sold.
    expect((await a.from("sales").insert(sale(aHarvest, { quantity: 1, quantity_unit: "kg" }))).error?.code).toBe("23514");
    // Remove the last sale again so the next tests have room.
    await a.from("sales").update({ deleted_at: new Date().toISOString() }).eq("id", exact.data!.id).throwOnError();
  });

  it("cannot be before the harvest or move to another harvest", async () => {
    expect((await a.from("sales").insert(sale(aHarvest, { sale_date: "2026-09-29" }))).error?.code).toBe("23514");
    expect((await a.from("sales").update({ harvest_id: aOtherHarvest }).eq("id", aSale)).error?.code).toBe("23514");
  });

  it("keep the harvest at least as large as what was sold", async () => {
    expect((await a.from("harvests").update({ quantity: 7.99 }).eq("id", aHarvest)).error?.code).toBe("23514");
    expect((await a.from("harvests").update({ quantity: 8, quantity_unit: "quintal" }).eq("id", aHarvest)).error).toBeNull();
    await a.from("harvests").update({ quantity: 10 }).eq("id", aHarvest).throwOnError();
  });

  it("block removing a harvest that still has sales", async () => {
    const remove = await a.from("harvests").update({ deleted_at: new Date().toISOString() }).eq("id", aHarvest);
    expect(remove.error?.code).toBe("23514");
  });

  it("are private to the farmer and cannot be deleted", async () => {
    expect((await b.from("sales").select("id").eq("id", aSale)).data).toEqual([]);
    expect((await b.from("sales").insert(sale(aHarvest))).error?.code).toBe("42501");
    expect((await b.from("sales").update({ price_per_unit: 1 }).eq("id", aSale).select("id")).data).toEqual([]);
    expect((await a.from("sales").delete().eq("id", aSale)).error?.code).toBe("42501");
  });

  it("are listed per harvest without removed sales", async () => {
    const harvests = await listHarvestsWithSales(server(a), aActiveCycle);
    const main = harvests.find((h) => h.id === aHarvest)!;
    expect(main.sales.map((s) => s.id)).toEqual([aSale]);
    expect(harvests.map((h) => h.id)).toEqual([aOtherHarvest, aHarvest]); // newest harvest first

    expect(await removeSale(server(a), aHarvest, aSale)).toMatchObject({ updated: true, error: null });
    const after = await listHarvestsWithSales(server(a), aActiveCycle);
    expect(after.find((h) => h.id === aHarvest)!.sales).toEqual([]);
    // With no sales left, the harvest can be removed.
    expect((await a.from("harvests").update({ deleted_at: new Date().toISOString() }).eq("id", aOtherHarvest)).error).toBeNull();
  });

  it("are closed once the crop is completed", async () => {
    await a.from("crop_cycles").update({ status: "HARVESTED", actual_harvest_date: "2026-10-02" }).eq("id", aActiveCycle).throwOnError();
    await a.from("crop_cycles").update({ status: "COMPLETED" }).eq("id", aActiveCycle).throwOnError();
    expect((await a.from("sales").insert(sale(aHarvest))).error?.code).toBe("23514");
    expect((await a.from("harvests").update({ notes: "late" }).eq("id", aHarvest)).error?.code).toBe("23514");
    // Another farmer's crop is unaffected and still usable.
    const bHarvest = await b
      .from("harvests")
      .insert({ crop_cycle_id: bActiveCycle, harvest_date: "2026-09-30", quantity: 1, quantity_unit: "quintal" });
    expect(bHarvest.error).toBeNull();
  });
});
