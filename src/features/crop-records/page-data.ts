import "server-only";

import { notFound, redirect } from "next/navigation";

import { todayInIndia } from "@/features/crops/dates";
import { loadCropPage } from "@/features/crops/page-data";
import { isId } from "@/features/farms/schema";
import { createClient } from "@/lib/supabase/server";

import { getActivity, getExpense } from "./repository";
import { canRecord } from "./rules";

type CropParams = { farmId: string; plotId: string; cycleId: string };

/** A crop page where work or costs can be recorded; otherwise back to the crop. */
export async function loadRecordPage(params: Promise<CropParams>) {
  const page = await loadCropPage(params);
  if (!canRecord(page.cycle.status)) redirect(page.cropHref);
  return { ...page, today: todayInIndia() };
}

export async function loadActivityPage(params: Promise<CropParams & { activityId: string }>) {
  const { activityId } = await params;
  const page = await loadRecordPage(params);
  const activity = isId(activityId) ? await getActivity(await createClient(), page.cycle.id, activityId) : null;
  if (!activity) notFound();
  return { ...page, activity, recordIds: { ...page.ids, recordId: activity.id } };
}

export async function loadExpensePage(params: Promise<CropParams & { expenseId: string }>) {
  const { expenseId } = await params;
  const page = await loadRecordPage(params);
  const expense = isId(expenseId) ? await getExpense(await createClient(), page.cycle.id, expenseId) : null;
  if (!expense) notFound();
  return { ...page, expense, recordIds: { ...page.ids, recordId: expense.id } };
}
