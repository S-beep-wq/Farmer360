import { notFound } from "next/navigation";

import { Card, DetailRow, Page, PageTitle } from "@/components/ui/layout";
import { createCropCycleAction } from "@/features/crops/actions";
import { CropCycleForm } from "@/features/crops/components/CropCycleForm";
import { todayInIndia } from "@/features/crops/dates";
import { isSeason } from "@/features/crops/format";
import { listCrops } from "@/features/crops/repository";
import { getFarm } from "@/features/farms/repository";
import { isId } from "@/features/farms/schema";
import { getPlot } from "@/features/plots/repository";
import { requireFarmer } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function NewCropCyclePage({ params, searchParams }: PageProps<"/farms/[farmId]/plots/[plotId]/crops/new">) {
  await requireFarmer();
  const { farmId, plotId } = await params;
  // Coming from crop planning: the chosen crop and season are filled in (and can be changed).
  const { crop, season } = await searchParams;
  if (!isId(farmId) || !isId(plotId)) notFound();

  const supabase = await createClient();
  // Row Level Security returns nothing for another farmer's farm or plot, which becomes a 404.
  const [farm, plot, crops] = await Promise.all([getFarm(supabase, farmId), getPlot(supabase, farmId, plotId), listCrops(supabase)]);
  if (!farm || !plot) notFound();

  const { locale, t } = await getServerMessages();
  const initialValues: Record<string, string> = {};
  if (typeof crop === "string" && crops.some((c) => c.id === crop)) initialValues.crop_id = crop;
  if (typeof season === "string" && isSeason(season)) initialValues.season = season;

  return (
    <Page>
      <PageTitle backHref={`/farms/${farm.id}/plots/${plot.id}`} backLabel={plot.name}>
        {t.crops.newTitle}
      </PageTitle>
      {/* "Confirm plot" (USER_WORKFLOWS.md section 6): the farmer sees which plot the crop is for. */}
      <Card>
        <dl>
          <DetailRow label={t.crops.plotLabel} value={`${plot.name} · ${farm.name}`} />
        </dl>
      </Card>
      <CropCycleForm
        t={t}
        locale={locale}
        crops={crops}
        action={createCropCycleAction.bind(null, farm.id, plot.id)}
        today={todayInIndia()}
        initialValues={initialValues}
      />
    </Page>
  );
}
