import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, DetailRow, LinkButton, Page, PageTitle } from "@/components/ui/layout";
import { CropStatusBadge } from "@/features/crops/components/CropStatusBadge";
import { cropName, isCropCycleStatus, isSeason, sowingSummary } from "@/features/crops/format";
import { listCropCycles } from "@/features/crops/repository";
import { getFarm } from "@/features/farms/repository";
import { isId } from "@/features/farms/schema";
import { formatArea, formatMeasuredArea } from "@/features/plots/format";
import { PlotsMap } from "@/features/plots/location/PlotsMap";
import { getPlot } from "@/features/plots/repository";
import { IRRIGATION_TYPES, LOCATION_SOURCES, SOIL_TYPES } from "@/features/shared/land";
import { requireFarmer } from "@/lib/auth";
import { format } from "@/lib/i18n";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

function label<K extends string>(value: string | null, keys: readonly K[], labels: Record<K, string>) {
  return value !== null && (keys as readonly string[]).includes(value) ? labels[value as K] : null;
}

export default async function PlotPage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]">) {
  await requireFarmer();
  const { farmId, plotId } = await params;
  if (!isId(farmId) || !isId(plotId)) notFound();

  const supabase = await createClient();
  const [farm, plot, cycles] = await Promise.all([
    getFarm(supabase, farmId),
    getPlot(supabase, farmId, plotId),
    listCropCycles(supabase, plotId),
  ]);
  if (!farm || !plot) notFound();

  const { locale, t } = await getServerMessages();
  const hasLocation = plot.boundary !== null || plot.latitude !== null;
  const locationSource = label(plot.location_source, LOCATION_SOURCES, t.locationSources);

  const irrigation =
    plot.irrigation_available === null
      ? t.plots.notSet
      : plot.irrigation_available
        ? [t.common.yes, label(plot.irrigation_type, IRRIGATION_TYPES, t.irrigationTypes)].filter(Boolean).join(" · ")
        : t.common.no;

  return (
    <Page>
      <PageTitle backHref={`/farms/${farm.id}`} backLabel={farm.name}>
        {plot.name}
      </PageTitle>

      {hasLocation ? (
        <PlotsMap plots={[plot]} label={`${t.plots.location}: ${plot.name}`} />
      ) : (
        <p className="text-lg text-stone-700">{t.plots.noLocation}</p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">{t.crops.title}</h2>
        {cycles.length === 0 ? (
          <p className="text-lg text-stone-700">{t.crops.noCrops}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {cycles.map((cycle) => (
              <li key={cycle.id}>
                <Link
                  href={`/farms/${farm.id}/plots/${plot.id}/crops/${cycle.id}`}
                  className="flex flex-col gap-2 rounded-2xl border-2 border-stone-200 bg-white p-4 shadow-sm hover:border-green-700 focus:outline-none focus:ring-4 focus:ring-green-300"
                >
                  <span className="text-xl font-semibold">
                    {cropName(cycle.crop, locale)}
                    {isSeason(cycle.season) ? <span className="font-normal text-stone-600"> · {t.seasons[cycle.season]}</span> : null}
                  </span>
                  {isCropCycleStatus(cycle.status) ? <CropStatusBadge status={cycle.status} t={t} /> : null}
                  <span className="text-lg text-stone-700">{sowingSummary(cycle, t, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <LinkButton href={`/farms/${farm.id}/plots/${plot.id}/crops/new`}>{t.crops.addCrop}</LinkButton>
      </section>

      <Card>
        <dl>
          <DetailRow label={t.plots.enteredArea} value={formatArea(plot.area, plot.area_unit, t, locale) ?? t.plots.notSet} />
          {plot.boundary_area_sq_m !== null ? (
            <DetailRow
              label={t.plots.mapArea}
              value={
                <>
                  <span data-testid="plot-map-area">{formatMeasuredArea(plot.boundary_area_sq_m, t, locale)}</span>
                  <span className="mt-1 block text-base font-normal text-stone-600">{t.plots.approxNote}</span>
                </>
              }
            />
          ) : null}
          {locationSource ? (
            <DetailRow
              label={t.plots.locationSourceLabel}
              value={
                <>
                  {locationSource}
                  {plot.location_accuracy_m !== null ? (
                    <span className="mt-1 block text-base font-normal text-stone-600">
                      {format(t.plots.accuracy, { meters: Math.round(plot.location_accuracy_m) })}
                    </span>
                  ) : null}
                </>
              }
            />
          ) : null}
          <DetailRow label={t.plots.soil} value={label(plot.soil_type, SOIL_TYPES, t.soilTypes) ?? t.plots.notSet} />
          <DetailRow label={t.plots.irrigation} value={irrigation} />
        </dl>
      </Card>

      <LinkButton href={`/farms/${farm.id}/plots/${plot.id}/edit`} variant="secondary">
        {t.common.edit}
      </LinkButton>
      <LinkButton href={`/farms/${farm.id}`} variant="secondary">
        {farm.name}
      </LinkButton>
    </Page>
  );
}
