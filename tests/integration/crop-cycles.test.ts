import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listOpenCropsByPlot, updateCropCycle } from "@/features/crops/repository";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { anonClient, deleteTestUsers, signInWithTestPhone, TEST_PHONES } from "../support/supabase";

// Crop catalog and crop cycles against the local Supabase stack (migrations, auth and RLS).

type Client = SupabaseClient<Database>;

const PHONES = [TEST_PHONES.integrationA, TEST_PHONES.integrationB];
const PROFILE = { full_name: "Test Farmer", preferred_language: "hi", state: "Bihar", district: "Patna", village: "Bihta" };

let a: Client;
let b: Client;
let aFarmId: string;
let aPlotId: string;
let bPlotId: string;
let wheatId: string;
let riceId: string;
let aCycleId: string;

async function farmerWithPlot(client: Client) {
  await client.from("farmers").insert(PROFILE).throwOnError();
  const { data: farm } = await client.from("farms").insert({ name: "Farm" }).select("id").single().throwOnError();
  const { data: plot } = await client
    .from("plots")
    .insert({ farm_id: farm.id, name: "Plot", area: 1, area_unit: "acre" })
    .select("id")
    .single()
    .throwOnError();
  return { farmId: farm.id, plotId: plot.id };
}

beforeAll(async () => {
  await deleteTestUsers(PHONES);
  ({ client: a } = await signInWithTestPhone(TEST_PHONES.integrationA));
  ({ client: b } = await signInWithTestPhone(TEST_PHONES.integrationB));
  ({ farmId: aFarmId, plotId: aPlotId } = await farmerWithPlot(a));
  ({ plotId: bPlotId } = await farmerWithPlot(b));
});

afterAll(async () => {
  await deleteTestUsers(PHONES);
});

describe("crop catalog", () => {
  it("lists the starter crops with Hindi names for signed-in farmers", async () => {
    const { data, error } = await a.from("crop_catalog").select("id, name, name_hi, category, typical_duration_days");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(16);
    const wheat = data!.find((c) => c.name === "Wheat")!;
    const rice = data!.find((c) => c.name === "Rice (paddy)")!;
    expect(wheat.name_hi).toBe("गेहूँ");
    // No agronomic numbers are claimed without a verified source.
    expect(data!.every((c) => c.typical_duration_days === null)).toBe(true);
    wheatId = wheat.id;
    riceId = rice.id;
  });

  it("cannot be changed by farmers", async () => {
    const { error: insertError } = await a.from("crop_catalog").insert({ name: "Fake", name_hi: "नकली", category: "other" });
    expect(insertError?.code).toBe("42501");
    const { error: updateError } = await a.from("crop_catalog").update({ name: "Changed" }).eq("id", wheatId);
    expect(updateError?.code).toBe("42501");
  });

  it("is not visible to signed-out visitors", async () => {
    const { error } = await anonClient().from("crop_catalog").select("id");
    expect(error?.code).toBe("42501");
  });
});

describe("crop cycles", () => {
  it("can be planned on the farmer's own plot", async () => {
    const { data, error } = await a
      .from("crop_cycles")
      .insert({ plot_id: aPlotId, crop_id: wheatId, season: "rabi", planned_sowing_date: "2026-11-15" })
      .select("id, status, actual_sowing_date")
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "PLANNED", actual_sowing_date: null });
    aCycleId = data!.id;
  });

  it("can be recorded as already in the field", async () => {
    const { error } = await a.from("crop_cycles").insert({
      plot_id: aPlotId,
      crop_id: riceId,
      season: "kharif",
      status: "ACTIVE",
      actual_sowing_date: "2026-07-01",
      expected_harvest_date: "2026-11-01",
      variety_name: "Rajendra Mahsuri",
    });
    expect(error).toBeNull();
  });

  it("keep the sowing date consistent with the status", async () => {
    const plannedButSown = await a.from("crop_cycles").insert({
      plot_id: aPlotId,
      crop_id: wheatId,
      season: "rabi",
      status: "PLANNED",
      planned_sowing_date: "2026-11-15",
      actual_sowing_date: "2026-11-15",
    });
    expect(plannedButSown.error?.code).toBe("23514");

    const activeNotSown = await a
      .from("crop_cycles")
      .insert({ plot_id: aPlotId, crop_id: wheatId, season: "rabi", status: "ACTIVE", planned_sowing_date: "2026-11-15" });
    expect(activeNotSown.error?.code).toBe("23514");

    const noDate = await a.from("crop_cycles").insert({ plot_id: aPlotId, crop_id: wheatId, season: "rabi" });
    expect(noDate.error?.code).toBe("23514");
  });

  it("reject a harvest before sowing, an unknown season and an unknown crop", async () => {
    const early = await a.from("crop_cycles").insert({
      plot_id: aPlotId,
      crop_id: wheatId,
      season: "rabi",
      planned_sowing_date: "2026-11-15",
      expected_harvest_date: "2026-11-01",
    });
    expect(early.error?.code).toBe("23514");

    const season = await a
      .from("crop_cycles")
      .insert({ plot_id: aPlotId, crop_id: wheatId, season: "monsoon", planned_sowing_date: "2026-11-15" });
    expect(season.error?.code).toBe("23514");

    const crop = await a.from("crop_cycles").insert({
      plot_id: aPlotId,
      crop_id: "00000000-0000-4000-8000-000000000000",
      season: "rabi",
      planned_sowing_date: "2026-11-15",
    });
    expect(crop.error?.code).toBe("23503");
  });

  it("are invisible to other farmers", async () => {
    const { data } = await b.from("crop_cycles").select("id").eq("plot_id", aPlotId);
    expect(data).toEqual([]);
  });

  it("cannot be added to another farmer's plot", async () => {
    const { error } = await b
      .from("crop_cycles")
      .insert({ plot_id: aPlotId, crop_id: wheatId, season: "rabi", planned_sowing_date: "2026-11-15" });
    expect(error?.code).toBe("42501");
  });

  it("cannot be moved to another farmer's plot or changed by them", async () => {
    const { error } = await a.from("crop_cycles").update({ plot_id: bPlotId }).eq("id", aCycleId);
    // Refused by the "stays on its plot" trigger (23514), and by RLS (42501) if the trigger were removed.
    expect(["23514", "42501"]).toContain(error?.code);
    const { data: unchanged } = await a.from("crop_cycles").select("plot_id").eq("id", aCycleId).single();
    expect(unchanged!.plot_id).toBe(aPlotId);
    const { data } = await b.from("crop_cycles").update({ variety_name: "Hijacked" }).eq("id", aCycleId).select("id");
    expect(data).toEqual([]);
  });

  it("cannot be deleted (history is preserved)", async () => {
    const { error } = await a.from("crop_cycles").delete().eq("id", aCycleId);
    expect(error?.code).toBe("42501");
  });

  it("are listed per plot as the farm's current crops", async () => {
    const byPlot = await listOpenCropsByPlot(a as unknown as ServerSupabaseClient, aFarmId);
    expect(byPlot.get(aPlotId)?.map((c) => [c.crop.name, c.status])).toEqual([
      ["Wheat", "PLANNED"],
      ["Rice (paddy)", "ACTIVE"],
    ]);
    // Another farmer's farm id gives nothing.
    expect((await listOpenCropsByPlot(b as unknown as ServerSupabaseClient, aFarmId)).size).toBe(0);
  });
});

describe("crop status changes", () => {
  async function newCycle(fields: Partial<Database["public"]["Tables"]["crop_cycles"]["Insert"]> = {}) {
    const { data } = await a
      .from("crop_cycles")
      .insert({ plot_id: aPlotId, crop_id: wheatId, season: "rabi", planned_sowing_date: "2026-11-15", ...fields })
      .select("id")
      .single()
      .throwOnError();
    return data.id;
  }

  async function update(id: string, patch: Database["public"]["Tables"]["crop_cycles"]["Update"]) {
    return a.from("crop_cycles").update(patch).eq("id", id).select("status").maybeSingle();
  }

  it("follow planned → in the field → harvested", async () => {
    const id = await newCycle();
    expect((await update(id, { status: "ACTIVE", actual_sowing_date: "2026-09-20" })).data?.status).toBe("ACTIVE");
    expect((await update(id, { status: "HARVESTED", actual_harvest_date: "2026-10-01" })).data?.status).toBe("HARVESTED");
  });

  it("need the matching dates", async () => {
    const id = await newCycle();
    expect((await update(id, { status: "ACTIVE" })).error?.code).toBe("23514");
    await update(id, { status: "ACTIVE", actual_sowing_date: "2026-09-20" });
    expect((await update(id, { status: "HARVESTED" })).error?.code).toBe("23514");
    expect((await update(id, { actual_harvest_date: "2026-10-01" })).error?.code).toBe("23514");
  });

  it("cannot skip steps or go backwards", async () => {
    const planned = await newCycle();
    const skip = await update(planned, { status: "HARVESTED", actual_sowing_date: "2026-09-20", actual_harvest_date: "2026-10-01" });
    expect(skip.error?.code).toBe("23514");

    const harvested = await newCycle({ status: "ACTIVE", planned_sowing_date: null, actual_sowing_date: "2026-07-01" });
    await update(harvested, { status: "HARVESTED", actual_harvest_date: "2026-10-01" });
    expect((await update(harvested, { status: "ACTIVE", actual_harvest_date: null })).error?.code).toBe("23514");
    expect((await update(harvested, { status: "CANCELLED", actual_harvest_date: null })).error?.code).toBe("23514");
  });

  it("can cancel a planned or growing crop, after which it cannot be changed", async () => {
    const planned = await newCycle();
    expect((await update(planned, { status: "CANCELLED" })).data?.status).toBe("CANCELLED");
    expect((await update(planned, { variety_name: "Changed later" })).error?.code).toBe("23514");
    expect((await update(planned, { status: "PLANNED" })).error?.code).toBe("23514");

    const active = await newCycle({ status: "ACTIVE", planned_sowing_date: null, actual_sowing_date: "2026-07-01" });
    expect((await update(active, { status: "CANCELLED" })).data?.status).toBe("CANCELLED");
  });

  it("cannot be created as harvested, completed or cancelled", async () => {
    for (const status of ["HARVESTED", "COMPLETED", "CANCELLED"]) {
      const { error } = await a.from("crop_cycles").insert({
        plot_id: aPlotId,
        crop_id: wheatId,
        season: "rabi",
        status,
        actual_sowing_date: "2026-07-01",
        actual_harvest_date: status === "CANCELLED" ? null : "2026-10-01",
      });
      expect(error?.code, status).toBe("23514");
    }
  });

  it("stay on the plot they were grown on", async () => {
    const { data: otherPlot } = await a
      .from("plots")
      .insert({ farm_id: aFarmId, name: "Other plot", area: 1, area_unit: "acre" })
      .select("id")
      .single()
      .throwOnError();
    const id = await newCycle();
    expect((await update(id, { plot_id: otherPlot.id })).error?.code).toBe("23514");
  });

  it("are only updated from the status the farmer saw (no lost updates)", async () => {
    const id = await newCycle();
    const client = a as unknown as ServerSupabaseClient;
    const first = await updateCropCycle(client, aPlotId, id, "PLANNED", { status: "CANCELLED" });
    expect(first).toMatchObject({ updated: true, error: null });
    // A second tab still showing "planned" tries to record sowing.
    const second = await updateCropCycle(client, aPlotId, id, "PLANNED", { status: "ACTIVE", actual_sowing_date: "2026-09-20" });
    expect(second).toMatchObject({ updated: false, error: null });
  });
});
