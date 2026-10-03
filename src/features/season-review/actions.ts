"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCropCycle, updateCropCycle } from "@/features/crops/repository";
import { isId } from "@/features/farms/schema";
import { PAYMENT_STATUSES } from "@/features/harvest-sales/constants";
import { getHarvestWithSales, updateSalePayment } from "@/features/harvest-sales/repository";
import { getPlot } from "@/features/plots/repository";
import { requireFarmer } from "@/lib/auth";
import { fieldErrorsFrom, formValues, optionalText, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// Closing a season (HARVESTED → COMPLETED) and, afterwards, updating payments from buyers.
// Ids are bound by the page and re-checked here under the farmer's session (RLS).

type CropIds = { farmId: string; plotId: string; cycleId: string };
type SaleIds = CropIds & { harvestId: string; saleId: string };

const reviewSchema = z.object({ notes: optionalText(1000) });
const paymentSchema = z.object({ payment_status: z.enum(PAYMENT_STATUSES, { error: "invalidChoice" }) });

async function loadCrop(ids: CropIds) {
  const farmer = await requireFarmer();
  if (!isId(ids.farmId) || !isId(ids.plotId) || !isId(ids.cycleId)) return null;
  const supabase = await createClient();
  const [plot, cycle] = await Promise.all([getPlot(supabase, ids.farmId, ids.plotId), getCropCycle(supabase, ids.plotId, ids.cycleId)]);
  return plot && cycle ? { farmer, supabase, cycle } : null;
}

function cropPage(ids: CropIds) {
  return `/farms/${ids.farmId}/plots/${ids.plotId}/crops/${ids.cycleId}`;
}

/** Saves the farmer's notes and closes the crop. Only a HARVESTED crop can be closed. */
export async function completeSeasonAction(ids: CropIds, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const crop = await loadCrop(ids);
  if (!crop || crop.cycle.status !== "HARVESTED") return { formError: "statusChanged", values };

  const parsed = reviewSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const { updated, error } = await updateCropCycle(crop.supabase, ids.plotId, ids.cycleId, "HARVESTED", {
    status: "COMPLETED",
    notes: parsed.data.notes ?? null,
  });
  if (error) {
    console.error("completeSeason failed", { farmerId: crop.farmer.id, cycleId: ids.cycleId, code: error.code });
    return { formError: "generic", values };
  }
  if (!updated) return { formError: "statusChanged", values };
  redirect(cropPage(ids));
}

/** After the season is closed, a sale's payment status is the only thing that can change. */
export async function updateSalePaymentAction(ids: SaleIds, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const crop = await loadCrop(ids);
  if (!crop || crop.cycle.status !== "COMPLETED" || !isId(ids.harvestId) || !isId(ids.saleId)) {
    return { formError: "generic", values };
  }
  const harvest = await getHarvestWithSales(crop.supabase, ids.cycleId, ids.harvestId);
  if (!harvest?.sales.some((s) => s.id === ids.saleId)) return { formError: "generic", values };

  const parsed = paymentSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const { updated, error } = await updateSalePayment(crop.supabase, ids.harvestId, ids.saleId, parsed.data.payment_status);
  if (error || !updated) {
    console.error("updateSalePayment failed", { farmerId: crop.farmer.id, code: error?.code });
    return { formError: "generic", values };
  }
  redirect(cropPage(ids));
}
