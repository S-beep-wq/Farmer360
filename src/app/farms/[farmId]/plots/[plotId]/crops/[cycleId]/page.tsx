import { notFound } from "next/navigation";

import { Card, DetailRow, LinkButton, Page, PageTitle } from "@/components/ui/layout";
import { formatDate } from "@/features/crops/dates";
import { cropName, isCropCycleStatus, isSeason, sowingSummary } from "@/features/crops/format";
import { getCropCycle } from "@/features/crops/repository";
import { CropStatusBadge } from "@/features/crops/components/CropStatusBadge";
import { getFarm } from "@/features/farms/repository";
import { isId } from "@/features/farms/schema";
import { getPlot } from "@/features/plots/repository";
import { requireFarmer } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function CropCyclePage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]">) {
  await requireFarmer();
  const { farmId, plotId, cycleId } = await params;
  if (!isId(farmId) || !isId(plotId) || !isId(cycleId)) notFound();

  const supabase = await createClient();
  const [farm, plot, cycle] = await Promise.all([
    getFarm(supabase, farmId),
    getPlot(supabase, farmId, plotId),
    getCropCycle(supabase, plotId, cycleId),
  ]);
  if (!farm || !plot || !cycle) notFound();

  const { locale, t } = await getServerMessages();

  return (
    <Page>
      <PageTitle backHref={`/farms/${farm.id}/plots/${plot.id}`} backLabel={plot.name}>
        {cropName(cycle.crop, locale)}
      </PageTitle>
      {isCropCycleStatus(cycle.status) ? <CropStatusBadge status={cycle.status} t={t} /> : null}

      <Card>
        <dl>
          <DetailRow label={t.crops.plotLabel} value={`${plot.name} · ${farm.name}`} />
          <DetailRow label={t.crops.season} value={isSeason(cycle.season) ? t.seasons[cycle.season] : cycle.season} />
          <DetailRow label={t.crops.variety} value={cycle.variety_name ?? t.crops.notSet} />
          <DetailRow label={t.crops.sowingDateLabel} value={sowingSummary(cycle, t, locale) ?? t.crops.notSet} />
          <DetailRow
            label={t.crops.expectedHarvest}
            value={cycle.expected_harvest_date ? formatDate(cycle.expected_harvest_date, locale) : t.crops.notSet}
          />
        </dl>
      </Card>

      <LinkButton href={`/farms/${farm.id}/plots/${plot.id}`} variant="secondary">
        {plot.name}
      </LinkButton>
    </Page>
  );
}
