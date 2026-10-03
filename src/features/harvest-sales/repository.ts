import type { ServerSupabaseClient } from "@/lib/supabase/server";

import type { HarvestInput, SaleInput } from "./schema";

// Data access for harvests and sales. RLS limits them to the signed-in farmer's crops.
// Removed entries (deleted_at set) are kept for history but never shown or counted.

const SALE_COLUMNS =
  "id, harvest_id, buyer_type, buyer_name, sale_date, quantity, quantity_unit, price_per_unit, transport_cost, " +
  "other_cost, gross_amount, net_amount, payment_status, notes, created_at";
const HARVEST_COLUMNS = "id, crop_cycle_id, harvest_date, quantity, quantity_unit, quality_grade, notes, created_at";

export type Sale = {
  id: string;
  harvest_id: string;
  buyer_type: string;
  buyer_name: string | null;
  sale_date: string;
  quantity: number;
  quantity_unit: string;
  price_per_unit: number;
  transport_cost: number;
  other_cost: number;
  gross_amount: number;
  net_amount: number;
  payment_status: string;
  notes: string | null;
  created_at: string;
};

export type Harvest = {
  id: string;
  crop_cycle_id: string;
  harvest_date: string;
  quantity: number;
  quantity_unit: string;
  quality_grade: string | null;
  notes: string | null;
  created_at: string;
};

export type HarvestWithSales = Harvest & { sales: Sale[] };

/** A crop's harvests (newest first), each with its sales (oldest first). */
export async function listHarvestsWithSales(supabase: ServerSupabaseClient, cropCycleId: string): Promise<HarvestWithSales[]> {
  const { data, error } = await supabase
    .from("harvests")
    .select(`${HARVEST_COLUMNS}, sales(${SALE_COLUMNS})`)
    .eq("crop_cycle_id", cropCycleId)
    .is("deleted_at", null)
    .is("sales.deleted_at", null)
    .order("harvest_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("sale_date", { referencedTable: "sales", ascending: true })
    .overrideTypes<HarvestWithSales[], { merge: false }>();
  if (error) throw error;
  return data;
}

export async function getHarvestWithSales(
  supabase: ServerSupabaseClient,
  cropCycleId: string,
  harvestId: string,
): Promise<HarvestWithSales | null> {
  const { data, error } = await supabase
    .from("harvests")
    .select(`${HARVEST_COLUMNS}, sales(${SALE_COLUMNS})`)
    .eq("crop_cycle_id", cropCycleId)
    .eq("id", harvestId)
    .is("deleted_at", null)
    .is("sales.deleted_at", null)
    .maybeSingle()
    .overrideTypes<HarvestWithSales, { merge: false }>();
  if (error) throw error;
  return data;
}

function harvestFields(input: HarvestInput) {
  return {
    harvest_date: input.harvest_date,
    quantity: input.quantity,
    quantity_unit: input.quantity_unit,
    quality_grade: input.quality_grade ?? null,
    notes: input.notes ?? null,
  };
}

function saleFields(input: SaleInput) {
  return {
    buyer_type: input.buyer_type,
    buyer_name: input.buyer_name ?? null,
    sale_date: input.sale_date,
    quantity: input.quantity,
    quantity_unit: input.quantity_unit,
    price_per_unit: input.price_per_unit,
    transport_cost: input.transport_cost ?? 0,
    other_cost: input.other_cost ?? 0,
    payment_status: input.payment_status,
    notes: input.notes ?? null,
  };
}

export async function insertHarvest(supabase: ServerSupabaseClient, cropCycleId: string, input: HarvestInput) {
  const { error } = await supabase.from("harvests").insert({ ...harvestFields(input), crop_cycle_id: cropCycleId });
  return { error };
}

export async function insertSale(supabase: ServerSupabaseClient, harvestId: string, input: SaleInput) {
  const { error } = await supabase.from("sales").insert({ ...saleFields(input), harvest_id: harvestId });
  return { error };
}

async function updateHarvestRow(
  supabase: ServerSupabaseClient,
  cropCycleId: string,
  id: string,
  values: ReturnType<typeof harvestFields> | { deleted_at: string },
) {
  const { data, error } = await supabase
    .from("harvests")
    .update(values)
    .eq("crop_cycle_id", cropCycleId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  return { updated: Boolean(data?.length), error };
}

async function updateSaleRow(
  supabase: ServerSupabaseClient,
  harvestId: string,
  id: string,
  values: ReturnType<typeof saleFields> | { deleted_at: string },
) {
  const { data, error } = await supabase
    .from("sales")
    .update(values)
    .eq("harvest_id", harvestId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  return { updated: Boolean(data?.length), error };
}

export function updateHarvest(supabase: ServerSupabaseClient, cropCycleId: string, id: string, input: HarvestInput) {
  return updateHarvestRow(supabase, cropCycleId, id, harvestFields(input));
}

/** Hides a harvest entered by mistake. The database refuses while it still has sales. */
export function removeHarvest(supabase: ServerSupabaseClient, cropCycleId: string, id: string) {
  return updateHarvestRow(supabase, cropCycleId, id, { deleted_at: new Date().toISOString() });
}

export function updateSale(supabase: ServerSupabaseClient, harvestId: string, id: string, input: SaleInput) {
  return updateSaleRow(supabase, harvestId, id, saleFields(input));
}

export function removeSale(supabase: ServerSupabaseClient, harvestId: string, id: string) {
  return updateSaleRow(supabase, harvestId, id, { deleted_at: new Date().toISOString() });
}

/**
 * Updates only a sale's payment status. This is the one change allowed after the season is
 * completed, because buyers often pay later (the database enforces this).
 */
export async function updateSalePayment(supabase: ServerSupabaseClient, harvestId: string, id: string, paymentStatus: string) {
  const { data, error } = await supabase
    .from("sales")
    .update({ payment_status: paymentStatus })
    .eq("harvest_id", harvestId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  return { updated: Boolean(data?.length), error };
}
