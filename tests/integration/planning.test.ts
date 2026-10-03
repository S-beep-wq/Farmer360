import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { todayInIndia } from "@/features/crops/dates";
import { planCandidates } from "@/features/planning/engine";
import { countOpenDemand, lastCropOnPlot, listPastSeasons } from "@/features/planning/repository";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { deleteTestUsers, signInWithTestPhone, TEST_PHONES } from "../support/supabase";

// Crop planning data against the local Supabase stack: only the farmer's own closed seasons,
// with totals, and open buyer demand per crop.

type Client = SupabaseClient<Database>;

const PHONES = [TEST_PHONES.integrationA, TEST_PHONES.integrationB, TEST_PHONES.integrationBuyer];
const PROFILE = { full_name: "Test Farmer", preferred_language: "en", state: "Bihar", district: "Patna", village: "Bihta" };
const TODAY = todayInIndia();
const LATER = (() => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString().slice(0, 10);
})();

let a: Client;
let b: Client;
let plotId: string;
let wheatId: string;
let mustardId: string;

const server = (c: Client) => c as unknown as ServerSupabaseClient;

async function cropId(client: Client, name: string) {
  return (await client.from("crop_catalog").select("id").eq("name", name).single().throwOnError()).data.id;
}

/** A closed season on the plot: sown, harvested, sold and reviewed. */
async function closedSeason(client: Client, plot: string, crop: string, money: { cost: number; quintal: number; price: number }) {
  const { data: cycle } = await client
    .from("crop_cycles")
    .insert({ plot_id: plot, crop_id: crop, season: "rabi", status: "ACTIVE", actual_sowing_date: "2025-11-10" })
    .select("id")
    .single()
    .throwOnError();
  await client.from("expenses").insert({ crop_cycle_id: cycle.id, category: "SEED", amount: money.cost, expense_date: "2025-11-09" }).throwOnError();
  const { data: harvest } = await client
    .from("harvests")
    .insert({ crop_cycle_id: cycle.id, harvest_date: "2026-03-30", quantity: money.quintal, quantity_unit: "quintal" })
    .select("id")
    .single()
    .throwOnError();
  await client
    .from("sales")
    .insert({ harvest_id: harvest.id, buyer_type: "MANDI", sale_date: "2026-04-02", quantity: money.quintal, quantity_unit: "quintal", price_per_unit: money.price, payment_status: "PAID" })
    .throwOnError();
  await client.from("crop_cycles").update({ status: "HARVESTED", actual_harvest_date: "2026-03-30" }).eq("id", cycle.id).throwOnError();
  await client.from("crop_cycles").update({ status: "COMPLETED" }).eq("id", cycle.id).throwOnError();
  return cycle.id;
}

beforeAll(async () => {
  await deleteTestUsers(PHONES);
  ({ client: a } = await signInWithTestPhone(TEST_PHONES.integrationA));
  ({ client: b } = await signInWithTestPhone(TEST_PHONES.integrationB));
  for (const c of [a, b]) await c.from("farmers").insert(PROFILE).throwOnError();
  wheatId = await cropId(a, "Wheat");
  mustardId = await cropId(a, "Mustard");

  const { data: farm } = await a.from("farms").insert({ name: "Farm" }).select("id").single().throwOnError();
  plotId = (await a.from("plots").insert({ farm_id: farm.id, name: "Plot", area: 2, area_unit: "acre" }).select("id").single().throwOnError()).data.id;
  // 2 acres: spent 10,000, sold 20 quintal at 2,500 = 50,000 → net 40,000 → 20,000 per acre.
  await closedSeason(a, plotId, wheatId, { cost: 10000, quintal: 20, price: 2500 });
  // A crop still in the field is not a past season.
  await a.from("crop_cycles").insert({ plot_id: plotId, crop_id: mustardId, season: "rabi", status: "ACTIVE", actual_sowing_date: "2026-09-01" }).throwOnError();

  const { data: bFarm } = await b.from("farms").insert({ name: "B farm" }).select("id").single().throwOnError();
  const bPlot = (await b.from("plots").insert({ farm_id: bFarm.id, name: "B plot", area: 1, area_unit: "acre" }).select("id").single().throwOnError()).data.id;
  await closedSeason(b, bPlot, mustardId, { cost: 1000, quintal: 5, price: 5000 });

  const { client: buyer } = await signInWithTestPhone(TEST_PHONES.integrationBuyer);
  await buyer.from("buyers").insert({ name: "Buyer", buyer_type: "MANDI", preferred_language: "en", state: "Bihar", district: "Patna", location: "Bihta" }).throwOnError();
  await buyer
    .from("buyer_demands")
    .insert({ crop_id: wheatId, quantity: 10, quantity_unit: "quintal", demand_type: "INDICATIVE", required_date: LATER, state: "Bihar", district: "Patna", location: "Bihta", pickup_available: true })
    .throwOnError();
});

afterAll(async () => {
  await deleteTestUsers(PHONES);
});

describe("crop planning data", () => {
  it("uses only the farmer's own closed seasons, with their totals and plot size", async () => {
    const seasons = await listPastSeasons(server(a));
    expect(seasons).toHaveLength(1);
    expect(seasons[0]).toMatchObject({ crop_id: wheatId, season: "rabi", plot_id: plotId, acres: 2, sowingDate: "2025-11-10", harvestDate: "2026-03-30" });
    expect(seasons[0].totals).toMatchObject({ expense_total: 10000, revenue: 50000, harvested_kg: 2000 });
  });

  it("knows the last crop sown on the plot", async () => {
    expect(await lastCropOnPlot(server(a), plotId)).toEqual({ crop_id: mustardId, season: "rabi" });
  });

  it("counts open buyer demand per crop", async () => {
    expect(Object.fromEntries(await countOpenDemand(server(a), TODAY))).toEqual({ [wheatId]: 1 });
  });

  it("compares crops from these facts", async () => {
    const plan = planCandidates({
      season: "rabi",
      plotId,
      cropIds: [wheatId, mustardId],
      pastSeasons: await listPastSeasons(server(a)),
      lastCropOnPlot: mustardId,
      openDemand: await countOpenDemand(server(a), TODAY),
      schemes: new Map(),
      insurance: new Map(),
    });
    expect(plan.withHistory).toHaveLength(1);
    expect(plan.withHistory[0]).toMatchObject({ crop_id: wheatId, openDemand: 1, history: { seasons: 1, onThisPlot: 1, netPerAcre: { average: 20000 } } });
    expect(plan.others[0]).toMatchObject({ crop_id: mustardId, grownHereLast: true, history: { seasons: 0 } });
  });
});
