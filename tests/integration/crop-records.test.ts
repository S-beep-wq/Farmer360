import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listActivities, listExpenses, removeExpense, spentSoFar } from "@/features/crop-records/repository";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { deleteTestUsers, signInWithTestPhone, TEST_PHONES } from "../support/supabase";

// Crop activities and expenses against the local Supabase stack (migrations, auth and RLS).

type Client = SupabaseClient<Database>;

const PHONES = [TEST_PHONES.integrationA, TEST_PHONES.integrationB];
const PROFILE = { full_name: "Test Farmer", preferred_language: "hi", state: "Bihar", district: "Patna", village: "Bihta" };

let a: Client;
let b: Client;
let aCycleId: string;
let aOtherCycleId: string;
let bCycleId: string;
let aExpenseId: string;
let aActivityId: string;

async function farmerWithCrop(client: Client) {
  await client.from("farmers").insert(PROFILE).throwOnError();
  const { data: farm } = await client.from("farms").insert({ name: "Farm" }).select("id").single().throwOnError();
  const { data: plot } = await client
    .from("plots")
    .insert({ farm_id: farm.id, name: "Plot", area: 1, area_unit: "acre" })
    .select("id")
    .single()
    .throwOnError();
  const { data: crop } = await client.from("crop_catalog").select("id").eq("name", "Wheat").single().throwOnError();
  const newCycle = async () =>
    (
      await client
        .from("crop_cycles")
        .insert({ plot_id: plot.id, crop_id: crop.id, season: "rabi", status: "ACTIVE", actual_sowing_date: "2026-09-01" })
        .select("id")
        .single()
        .throwOnError()
    ).data.id;
  return { cycleId: await newCycle(), otherCycleId: await newCycle() };
}

const server = (client: Client) => client as unknown as ServerSupabaseClient;

beforeAll(async () => {
  await deleteTestUsers(PHONES);
  ({ client: a } = await signInWithTestPhone(TEST_PHONES.integrationA));
  ({ client: b } = await signInWithTestPhone(TEST_PHONES.integrationB));
  ({ cycleId: aCycleId, otherCycleId: aOtherCycleId } = await farmerWithCrop(a));
  ({ cycleId: bCycleId } = await farmerWithCrop(b));
});

afterAll(async () => {
  await deleteTestUsers(PHONES);
});

describe("activities and expenses", () => {
  it("are recorded on the farmer's own crop", async () => {
    const activity = await a
      .from("crop_activities")
      .insert({ crop_cycle_id: aCycleId, activity_type: "LABOUR", activity_date: "2026-09-10", quantity: 3, quantity_unit: "day", cost: 1200 })
      .select("id")
      .single();
    expect(activity.error).toBeNull();
    aActivityId = activity.data!.id;

    const expense = await a
      .from("expenses")
      .insert({ crop_cycle_id: aCycleId, category: "SEED", amount: 800.5, expense_date: "2026-08-30", vendor: "Krishi Kendra" })
      .select("id, currency")
      .single();
    expect(expense.error).toBeNull();
    expect(expense.data!.currency).toBe("INR");
    aExpenseId = expense.data!.id;
  });

  it("enforce valid values", async () => {
    const cases = [
      a.from("expenses").insert({ crop_cycle_id: aCycleId, category: "SEED", amount: 0, expense_date: "2026-09-01" }),
      a.from("expenses").insert({ crop_cycle_id: aCycleId, category: "SEED", amount: 10, currency: "USD", expense_date: "2026-09-01" }),
      a.from("expenses").insert({ crop_cycle_id: aCycleId, category: "GOLD", amount: 10, expense_date: "2026-09-01" }),
      a.from("expenses").insert({ crop_cycle_id: aCycleId, category: "SEED", amount: 10, expense_date: "2026-09-01", quantity: 2 }),
      a.from("crop_activities").insert({ crop_cycle_id: aCycleId, activity_type: "DANCING", activity_date: "2026-09-01" }),
      a.from("crop_activities").insert({ crop_cycle_id: aCycleId, activity_type: "WEEDING", activity_date: "2026-09-01", cost: -5 }),
      a.from("crop_activities").insert({ crop_cycle_id: aCycleId, activity_type: "WEEDING", activity_date: "2026-09-01", quantity_unit: "kg" }),
    ];
    for (const [i, result] of (await Promise.all(cases)).entries()) {
      expect(result.error?.code, `case ${i}`).toBe("23514");
    }
  });

  it("are invisible to other farmers and cannot be added to their crops", async () => {
    expect((await b.from("expenses").select("id").eq("crop_cycle_id", aCycleId)).data).toEqual([]);
    expect((await b.from("crop_activities").select("id").eq("crop_cycle_id", aCycleId)).data).toEqual([]);
    const intrusion = await b
      .from("expenses")
      .insert({ crop_cycle_id: aCycleId, category: "SEED", amount: 1, expense_date: "2026-09-01" });
    expect(intrusion.error?.code).toBe("42501");
    const change = await b.from("expenses").update({ amount: 1 }).eq("id", aExpenseId).select("id");
    expect(change.data).toEqual([]);
  });

  it("cannot be moved to another crop, even the farmer's own", async () => {
    expect((await a.from("expenses").update({ crop_cycle_id: aOtherCycleId }).eq("id", aExpenseId)).error?.code).toBe("23514");
    const toOtherFarmer = await a.from("crop_activities").update({ crop_cycle_id: bCycleId }).eq("id", aActivityId);
    expect(["23514", "42501"]).toContain(toOtherFarmer.error?.code);
  });

  it("cannot be deleted, only removed (kept for history, not counted)", async () => {
    expect((await a.from("expenses").delete().eq("id", aExpenseId)).error?.code).toBe("42501");

    const before = spentSoFar(await listActivities(server(a), aCycleId), await listExpenses(server(a), aCycleId));
    expect(before).toEqual({ workCosts: 1200, expenseTotal: 800.5, total: 2000.5 });

    expect(await removeExpense(server(a), aCycleId, aExpenseId)).toMatchObject({ updated: true, error: null });
    // Removing again finds nothing: the entry is already hidden.
    expect(await removeExpense(server(a), aCycleId, aExpenseId)).toMatchObject({ updated: false });

    const after = spentSoFar(await listActivities(server(a), aCycleId), await listExpenses(server(a), aCycleId));
    expect(after).toEqual({ workCosts: 1200, expenseTotal: 0, total: 1200 });

    const { data: kept } = await a.from("expenses").select("deleted_at").eq("id", aExpenseId).single();
    expect(kept!.deleted_at).not.toBeNull();
  });

  it("can still be recorded for a cancelled crop, but not for a completed one", async () => {
    await a.from("crop_cycles").update({ status: "CANCELLED" }).eq("id", aOtherCycleId).throwOnError();
    const onCancelled = await a
      .from("expenses")
      .insert({ crop_cycle_id: aOtherCycleId, category: "SEED", amount: 100, expense_date: "2026-09-01" });
    expect(onCancelled.error).toBeNull();

    await a.from("crop_cycles").update({ status: "HARVESTED", actual_harvest_date: "2026-10-01" }).eq("id", aCycleId).throwOnError();
    await a.from("crop_cycles").update({ status: "COMPLETED" }).eq("id", aCycleId).throwOnError();
    const onCompleted = await a
      .from("crop_activities")
      .insert({ crop_cycle_id: aCycleId, activity_type: "OTHER", activity_date: "2026-10-02" });
    expect(onCompleted.error?.code).toBe("23514");
    expect((await a.from("crop_activities").update({ notes: "late change" }).eq("id", aActivityId)).error?.code).toBe("23514");
  });
});
