import "server-only";

import { notFound, redirect } from "next/navigation";

import { getFarm } from "@/features/farms/repository";
import { isId } from "@/features/farms/schema";
import { getPlot } from "@/features/plots/repository";
import { requireFarmer } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

import type { CropCycleStatus } from "./constants";
import { isCropCycleStatus } from "./format";
import { getCropCycle, type CropCycle } from "./repository";
import { canDo, type CropCycleAction } from "./transitions";

type Params = { farmId: string; plotId: string; cycleId: string };

/**
 * Loads a crop page's farm, plot and crop under the farmer's session (404 when RLS hides them).
 * With `action`, sends the farmer back to the crop page if that action is not possible in its status.
 */
export async function loadCropPage(params: Promise<Params>, action?: CropCycleAction) {
  await requireFarmer();
  const ids = await params;
  if (!isId(ids.farmId) || !isId(ids.plotId) || !isId(ids.cycleId)) notFound();

  const supabase = await createClient();
  const [farm, plot, cycle] = await Promise.all([
    getFarm(supabase, ids.farmId),
    getPlot(supabase, ids.farmId, ids.plotId),
    getCropCycle(supabase, ids.plotId, ids.cycleId),
  ]);
  if (!farm || !plot || !cycle || !isCropCycleStatus(cycle.status)) notFound();

  const cropHref = `/farms/${farm.id}/plots/${plot.id}/crops/${cycle.id}`;
  if (action && !canDo(cycle.status, action)) redirect(cropHref);

  const { locale, t } = await getServerMessages();
  return {
    farm,
    plot,
    cycle: cycle as CropCycle & { status: CropCycleStatus },
    ids: { farmId: farm.id, plotId: plot.id, cycleId: cycle.id },
    cropHref,
    locale,
    t,
  };
}
