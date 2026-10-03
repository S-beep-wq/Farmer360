import { sumRupees } from "@/features/shared/money";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import type { ActivityInput, ExpenseInput } from "./schema";

// Data access for crop activities and expenses. RLS limits them to the signed-in farmer's crops.
// Removed entries (deleted_at set) are kept in the database for history but never shown or counted.

const ACTIVITY_COLUMNS = "id, crop_cycle_id, activity_type, activity_date, quantity, quantity_unit, cost, notes, created_at";
const EXPENSE_COLUMNS = "id, crop_cycle_id, category, amount, expense_date, quantity, quantity_unit, vendor, notes, created_at";

export async function listActivities(supabase: ServerSupabaseClient, cropCycleId: string) {
  const { data, error } = await supabase
    .from("crop_activities")
    .select(ACTIVITY_COLUMNS)
    .eq("crop_cycle_id", cropCycleId)
    .is("deleted_at", null)
    .order("activity_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export type Activity = Awaited<ReturnType<typeof listActivities>>[number];

export async function getActivity(supabase: ServerSupabaseClient, cropCycleId: string, activityId: string) {
  const { data, error } = await supabase
    .from("crop_activities")
    .select(ACTIVITY_COLUMNS)
    .eq("crop_cycle_id", cropCycleId)
    .eq("id", activityId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listExpenses(supabase: ServerSupabaseClient, cropCycleId: string) {
  const { data, error } = await supabase
    .from("expenses")
    .select(EXPENSE_COLUMNS)
    .eq("crop_cycle_id", cropCycleId)
    .is("deleted_at", null)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export type Expense = Awaited<ReturnType<typeof listExpenses>>[number];

export async function getExpense(supabase: ServerSupabaseClient, cropCycleId: string, expenseId: string) {
  const { data, error } = await supabase
    .from("expenses")
    .select(EXPENSE_COLUMNS)
    .eq("crop_cycle_id", cropCycleId)
    .eq("id", expenseId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function activityFields(input: ActivityInput) {
  return {
    activity_type: input.activity_type,
    activity_date: input.activity_date,
    quantity: input.quantity ?? null,
    quantity_unit: input.quantity_unit ?? null,
    cost: input.cost ?? null,
    notes: input.notes ?? null,
  };
}

function expenseFields(input: ExpenseInput) {
  return {
    category: input.category,
    amount: input.amount,
    expense_date: input.expense_date,
    quantity: input.quantity ?? null,
    quantity_unit: input.quantity_unit ?? null,
    vendor: input.vendor ?? null,
    notes: input.notes ?? null,
  };
}

export async function insertActivity(supabase: ServerSupabaseClient, cropCycleId: string, input: ActivityInput) {
  const { error } = await supabase.from("crop_activities").insert({ ...activityFields(input), crop_cycle_id: cropCycleId });
  return { error };
}

export async function insertExpense(supabase: ServerSupabaseClient, cropCycleId: string, input: ExpenseInput) {
  const { error } = await supabase.from("expenses").insert({ ...expenseFields(input), crop_cycle_id: cropCycleId });
  return { error };
}

type ActivityUpdate = Database["public"]["Tables"]["crop_activities"]["Update"];
type ExpenseUpdate = Database["public"]["Tables"]["expenses"]["Update"];

// Updates only entries that have not been removed. `updated` is false when nothing matched
// (a removed entry, a wrong id, or RLS hiding another farmer's entry).

async function updateActivityRow(supabase: ServerSupabaseClient, cropCycleId: string, id: string, values: ActivityUpdate) {
  const { data, error } = await supabase
    .from("crop_activities")
    .update(values)
    .eq("crop_cycle_id", cropCycleId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  return { updated: Boolean(data?.length), error };
}

async function updateExpenseRow(supabase: ServerSupabaseClient, cropCycleId: string, id: string, values: ExpenseUpdate) {
  const { data, error } = await supabase
    .from("expenses")
    .update(values)
    .eq("crop_cycle_id", cropCycleId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  return { updated: Boolean(data?.length), error };
}

export function updateActivity(supabase: ServerSupabaseClient, cropCycleId: string, id: string, input: ActivityInput) {
  return updateActivityRow(supabase, cropCycleId, id, activityFields(input));
}

export function updateExpense(supabase: ServerSupabaseClient, cropCycleId: string, id: string, input: ExpenseInput) {
  return updateExpenseRow(supabase, cropCycleId, id, expenseFields(input));
}

/** Hides an entry made by mistake. It stays in the database (DATABASE.md section 24). */
export function removeActivity(supabase: ServerSupabaseClient, cropCycleId: string, id: string) {
  return updateActivityRow(supabase, cropCycleId, id, { deleted_at: new Date().toISOString() });
}

export function removeExpense(supabase: ServerSupabaseClient, cropCycleId: string, id: string) {
  return updateExpenseRow(supabase, cropCycleId, id, { deleted_at: new Date().toISOString() });
}

/** Money spent on a crop so far: costs entered with work done, plus expenses. */
export function spentSoFar(activities: Pick<Activity, "cost">[], expenses: Pick<Expense, "amount">[]) {
  const workCosts = sumRupees(activities.map((a) => a.cost));
  const expenseTotal = sumRupees(expenses.map((e) => e.amount));
  return { workCosts, expenseTotal, total: sumRupees([workCosts, expenseTotal]) };
}
