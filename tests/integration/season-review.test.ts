import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listActivities, listExpenses, spentSoFar } from "@/features/crop-records/repository";
import { cropResult } from "@/features/harvest-sales/economics";
import { listHarvestsWithSales } from "@/features/harvest-sales/repository";
import { getCropTotals, listCropTotals } from "@/features/season-review/repository";
import { seasonSummary } from "@/features/season-review/summary";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { anonClient, deleteTestUsers, signInWithTestPhone, TEST_PHONES } from "../support/supabase";

// Season review against the local Supabase stack: closing a season, the totals view and
// what can still change afterwards.

type Client = SupabaseClient<Database>;

const PHONES = [TEST_PHONES.integrationA, TEST_PHONES.integrationB];
const PROFILE = { full_name: "Test Farmer", preferred_language: "hi", state: "Bihar", district: "Patna", village: "Bihta" };

let a: Client;
let b: Client;
let cycleId: string;
let activeCycleId: string;
let saleId: string;
let removedSaleId: string;

const server = (client: Client) => client as unknown as ServerSupabaseClient;

beforeAll(async () => {
  await deleteTestUsers(PHONES);
  ({ client: a } = await signInWithTestPhone(TEST_PHONES.integrationA));
  ({ client: b } = await signInWithTestPhone(TEST_PHONES.integrationB));

  await a.from("farmers").insert(PROFILE).throwOnError();
  const { data: farm } = await a.from("farms").insert({ name: "Farm" }).select("id").single().throwOnError();
  const { data: plot } = await a
    .from("plots")
    .insert({ farm_id: farm.id, name: "Plot", area: 2, area_unit: "acre" })
    .select("id")
    .single()
    .throwOnError();
  const { data: crop } = await a.from("crop_catalog").select("id").eq("name", "Wheat").single().throwOnError();
  const newCycle = async () =>
    (
      await a
        .from("crop_cycles")
        .insert({ plot_id: plot.id, crop_id: crop.id, season: "rabi", status: "ACTIVE", actual_sowing_date: "2026-07-01" })
        .select("id")
        .single()
        .throwOnError()
    ).data.id;
  cycleId = await newCycle();
  activeCycleId = await newCycle();

  await a.from("crop_activities").insert([
    { crop_cycle_id: cycleId, activity_type: "LABOUR", activity_date: "2026-07-10", cost: 1200 },
    { crop_cycle_id: cycleId, activity_type: "WEEDING", activity_date: "2026-07-20", cost: 300, deleted_at: new Date().toISOString() },
  ]).throwOnError();
  await a.from("expenses").insert({ crop_cycle_id: cycleId, category: "SEED", amount: 5000, expense_date: "2026-06-30" }).throwOnError();
  const { data: harvest } = await a
    .from("harvests")
    .insert({ crop_cycle_id: cycleId, harvest_date: "2026-09-30", quantity: 12, quantity_unit: "quintal" })
    .select("id")
    .single()
    .throwOnError();
  const sale = (fields: Partial<Database["public"]["Tables"]["sales"]["Insert"]>) => ({
    harvest_id: harvest.id,
    buyer_type: "MANDI",
    sale_date: "2026-10-01",
    quantity: 10,
    quantity_unit: "quintal",
    price_per_unit: 2300,
    transport_cost: 500,
    payment_status: "PARTIAL",
    ...fields,
  });
  saleId = (await a.from("sales").insert(sale({})).select("id").single().throwOnError()).data.id;
  removedSaleId = (await a.from("sales").insert(sale({ quantity: 1, transport_cost: 0 })).select("id").single().throwOnError()).data.id;
  await a.from("sales").update({ deleted_at: new Date().toISOString() }).eq("id", removedSaleId).throwOnError();
});

afterAll(async () => {
  await deleteTestUsers(PHONES);
});

describe("crop totals view", () => {
  it("adds up costs, harvest and sales, leaving out removed entries", async () => {
    const totals = await getCropTotals(server(a), cycleId);
    expect(totals).toEqual({
      crop_cycle_id: cycleId,
      work_costs: 1200,
      expense_total: 5000,
      harvested_kg: 1200,
      sold_kg: 1000,
      revenue: 23000,
      selling_costs: 500,
      unpaid_sales: 1,
    });
  });

  it("gives the same net result as the crop page", async () => {
    const [activities, expenses, harvests, totals] = await Promise.all([
      listActivities(server(a), cycleId),
      listExpenses(server(a), cycleId),
      listHarvestsWithSales(server(a), cycleId),
      getCropTotals(server(a), cycleId),
    ]);
    const onCropPage = cropResult(spentSoFar(activities, expenses).total, harvests.flatMap((h) => h.sales)).net;
    expect(seasonSummary(totals!, null).net).toBe(onCropPage);
    expect(onCropPage).toBe(16300);
  });

  it("returns zeros for a crop with no records, and nothing for other farmers or visitors", async () => {
    const empty = await listCropTotals(server(a), [activeCycleId]);
    expect(empty.get(activeCycleId)).toMatchObject({ work_costs: 0, revenue: 0, harvested_kg: 0, unpaid_sales: 0 });
    expect(await getCropTotals(server(b), cycleId)).toBeNull();
    const { error } = await anonClient().from("crop_cycle_totals").select("crop_cycle_id");
    expect(error?.code).toBe("42501");
  });
});

describe("closing a season", () => {
  it("is only possible for a harvested crop", async () => {
    const { error } = await a.from("crop_cycles").update({ status: "COMPLETED" }).eq("id", activeCycleId);
    expect(error?.code).toBe("23514");
  });

  it("saves the notes and the close time, which the app cannot set itself", async () => {
    await a.from("crop_cycles").update({ status: "HARVESTED", actual_harvest_date: "2026-10-02" }).eq("id", cycleId).throwOnError();
    const forged = await a.from("crop_cycles").update({ completed_at: "2020-01-01T00:00:00Z" }).eq("id", cycleId).select("completed_at").single();
    expect(forged.data!.completed_at).toBeNull();

    const before = Date.now();
    const { data, error } = await a
      .from("crop_cycles")
      .update({ status: "COMPLETED", notes: "Sow earlier next year.", completed_at: "2020-01-01T00:00:00Z" })
      .eq("id", cycleId)
      .select("status, notes, completed_at")
      .single();
    expect(error).toBeNull();
    expect(data!.status).toBe("COMPLETED");
    expect(data!.notes).toBe("Sow earlier next year.");
    expect(Date.parse(data!.completed_at!)).toBeGreaterThan(before - 60_000);
  });

  it("freezes the crop and its records", async () => {
    expect((await a.from("crop_cycles").update({ notes: "changed" }).eq("id", cycleId)).error?.code).toBe("23514");
    expect((await a.from("sales").update({ price_per_unit: 2400 }).eq("id", saleId)).error?.code).toBe("23514");
    expect((await a.from("sales").update({ deleted_at: new Date().toISOString() }).eq("id", saleId)).error?.code).toBe("23514");
    // Bringing back a removed sale would change the totals, so it is refused too.
    expect((await a.from("sales").update({ deleted_at: null }).eq("id", removedSaleId)).error?.code).toBe("23514");
  });

  it("still lets the farmer record that a buyer has paid", async () => {
    const { data, error } = await a.from("sales").update({ payment_status: "PAID" }).eq("id", saleId).select("payment_status").single();
    expect(error).toBeNull();
    expect(data!.payment_status).toBe("PAID");
    expect((await getCropTotals(server(a), cycleId))!.unpaid_sales).toBe(0);
  });

  it("does not let another farmer change the payment", async () => {
    const { data } = await b.from("sales").update({ payment_status: "PENDING" }).eq("id", saleId).select("id");
    expect(data).toEqual([]);
  });
});
