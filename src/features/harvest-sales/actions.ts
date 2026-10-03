"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { todayInIndia } from "@/features/crops/dates";
import { getCropCycle } from "@/features/crops/repository";
import { isId } from "@/features/farms/schema";
import { getPlot } from "@/features/plots/repository";
import { requireFarmer } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { isProduceUnit, soldKg, toKg } from "./quantities";
import {
  getHarvestWithSales,
  insertHarvest,
  insertSale,
  removeHarvest,
  removeSale,
  updateHarvest,
  updateSale,
} from "./repository";
import { canAddHarvest, canChangeHarvests } from "./rules";
import { harvestSchema, saleSchema } from "./schema";

// Harvests and sales for a crop. Ids are bound by the page and come from the browser, so every
// action re-reads the plot, crop and harvest under the farmer's session (RLS). The database
// enforces the same rules (dates, quantities, overselling).

type CropIds = { farmId: string; plotId: string; cycleId: string };
type HarvestIds = CropIds & { harvestId: string };
type SaleIds = HarvestIds & { saleId: string };

async function loadCrop(ids: CropIds, forNewHarvest = false) {
  const farmer = await requireFarmer();
  if (!isId(ids.farmId) || !isId(ids.plotId) || !isId(ids.cycleId)) return null;
  const supabase = await createClient();
  const [plot, cycle] = await Promise.all([getPlot(supabase, ids.farmId, ids.plotId), getCropCycle(supabase, ids.plotId, ids.cycleId)]);
  if (!plot || !cycle || !cycle.actual_sowing_date) return null;
  if (forNewHarvest ? !canAddHarvest(cycle.status) : !canChangeHarvests(cycle.status)) return null;
  return { farmer, supabase, sowingDate: cycle.actual_sowing_date };
}

async function loadHarvest(ids: HarvestIds) {
  const crop = await loadCrop(ids);
  if (!crop || !isId(ids.harvestId)) return null;
  const harvest = await getHarvestWithSales(crop.supabase, ids.cycleId, ids.harvestId);
  if (!harvest || !isProduceUnit(harvest.quantity_unit)) return null;
  return { ...crop, harvest, harvestKg: toKg(harvest.quantity, harvest.quantity_unit) };
}

function cropPage(ids: CropIds) {
  return `/farms/${ids.farmId}/plots/${ids.plotId}/crops/${ids.cycleId}`;
}

function failed(what: string, farmerId: string, error: PostgrestError | null, values: Record<string, string>): FormState {
  console.error(`${what} failed`, { farmerId, code: error?.code });
  return { formError: "generic", values };
}

export async function createHarvestAction(ids: CropIds, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const crop = await loadCrop(ids, true);
  if (!crop) return { formError: "generic", values };

  const parsed = harvestSchema(todayInIndia(), crop.sowingDate).safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const { error } = await insertHarvest(crop.supabase, ids.cycleId, parsed.data);
  if (error) return failed("createHarvest", crop.farmer.id, error, values);
  redirect(cropPage(ids));
}

export async function updateHarvestAction(ids: HarvestIds, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const loaded = await loadHarvest(ids);
  if (!loaded) return { formError: "generic", values };

  const parsed = harvestSchema(todayInIndia(), loaded.sowingDate, soldKg(loaded.harvest.sales)).safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const { updated, error } = await updateHarvest(loaded.supabase, ids.cycleId, ids.harvestId, parsed.data);
  if (error || !updated) return failed("updateHarvest", loaded.farmer.id, error, values);
  redirect(cropPage(ids));
}

export async function removeHarvestAction(ids: HarvestIds): Promise<FormState> {
  const loaded = await loadHarvest(ids);
  if (!loaded) return { formError: "generic" };
  if (loaded.harvest.sales.length > 0) return { formError: "harvestHasSales" };
  const { updated, error } = await removeHarvest(loaded.supabase, ids.cycleId, ids.harvestId);
  if (error || !updated) return failed("removeHarvest", loaded.farmer.id, error, {});
  redirect(cropPage(ids));
}

export async function createSaleAction(ids: HarvestIds, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const loaded = await loadHarvest(ids);
  if (!loaded) return { formError: "generic", values };

  const availableKg = loaded.harvestKg - soldKg(loaded.harvest.sales);
  const parsed = saleSchema(todayInIndia(), loaded.harvest.harvest_date, availableKg).safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const { error } = await insertSale(loaded.supabase, ids.harvestId, parsed.data);
  if (error) return failed("createSale", loaded.farmer.id, error, values);
  redirect(cropPage(ids));
}

export async function updateSaleAction(ids: SaleIds, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const loaded = await loadHarvest(ids);
  if (!loaded || !isId(ids.saleId) || !loaded.harvest.sales.some((s) => s.id === ids.saleId)) {
    return { formError: "generic", values };
  }

  // This sale's own quantity is available again while it is being changed.
  const otherSales = loaded.harvest.sales.filter((s) => s.id !== ids.saleId);
  const availableKg = loaded.harvestKg - soldKg(otherSales);
  const parsed = saleSchema(todayInIndia(), loaded.harvest.harvest_date, availableKg).safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const { updated, error } = await updateSale(loaded.supabase, ids.harvestId, ids.saleId, parsed.data);
  if (error || !updated) return failed("updateSale", loaded.farmer.id, error, values);
  redirect(cropPage(ids));
}

export async function removeSaleAction(ids: SaleIds): Promise<FormState> {
  const loaded = await loadHarvest(ids);
  if (!loaded || !isId(ids.saleId)) return { formError: "generic" };
  const { updated, error } = await removeSale(loaded.supabase, ids.harvestId, ids.saleId);
  if (error || !updated) return failed("removeSale", loaded.farmer.id, error, {});
  redirect(cropPage(ids));
}
