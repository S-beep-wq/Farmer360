import "server-only";

import { notFound, redirect } from "next/navigation";

import { formatDate, todayInIndia } from "@/features/crops/dates";
import { loadCropPage } from "@/features/crops/page-data";
import { isId } from "@/features/farms/schema";
import { format } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

import { formatProduce } from "./format";
import { isProduceUnit, remainingToSell } from "./quantities";
import { getHarvestWithSales } from "./repository";
import { canAddHarvest, canChangeHarvests } from "./rules";

type CropParams = { farmId: string; plotId: string; cycleId: string };
type HarvestParams = CropParams & { harvestId: string };

/** The add-harvest page: only for a sown crop that is in the field or harvested. */
export async function loadNewHarvestPage(params: Promise<CropParams>) {
  const page = await loadCropPage(params);
  if (!canAddHarvest(page.cycle.status) || !page.cycle.actual_sowing_date) redirect(page.cropHref);
  return { ...page, today: todayInIndia(), sowingDate: page.cycle.actual_sowing_date };
}

/** A page about one harvest (edit it, or add or edit one of its sales). */
export async function loadHarvestPage(params: Promise<HarvestParams>) {
  const { harvestId } = await params;
  const page = await loadCropPage(params);
  if (!canChangeHarvests(page.cycle.status) || !page.cycle.actual_sowing_date) redirect(page.cropHref);

  const harvest = isId(harvestId) ? await getHarvestWithSales(await createClient(), page.cycle.id, harvestId) : null;
  if (!harvest || !isProduceUnit(harvest.quantity_unit)) notFound();

  const { t, locale } = page;
  return {
    ...page,
    today: todayInIndia(),
    sowingDate: page.cycle.actual_sowing_date,
    harvest,
    harvestIds: { ...page.ids, harvestId: harvest.id },
    harvestLabel: format(t.sales.fromHarvest, { date: formatDate(harvest.harvest_date, locale) }),
    /** "Not sold yet from this harvest: 12 quintal." — optionally counting one sale as unsold (when editing it). */
    availableText(exceptSaleId?: string) {
      const otherSales = harvest.sales.filter((s) => s.id !== exceptSaleId);
      const left = remainingToSell(harvest, otherSales);
      return format(t.sales.availableHint, { quantity: formatProduce(left, harvest.quantity_unit, t, locale) });
    },
  };
}
