import Link from "next/link";
import { notFound } from "next/navigation";

import { LinkButton, Page, PageTitle } from "@/components/ui/layout";
import { cropName } from "@/features/crops/format";
import { listOpenCropsByPlot } from "@/features/crops/repository";
import { getFarm } from "@/features/farms/repository";
import { isId } from "@/features/farms/schema";
import { formatArea, formatMeasuredArea } from "@/features/plots/format";
import { PlotsMap } from "@/features/plots/location/PlotsMap";
import { listPlots } from "@/features/plots/repository";
import { requireFarmer } from "@/lib/auth";
import { format } from "@/lib/i18n";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function FarmPage({ params }: PageProps<"/farms/[farmId]">) {
  await requireFarmer();
  const { farmId } = await params;
  if (!isId(farmId)) notFound();

  const supabase = await createClient();
  // Row Level Security returns nothing for another farmer's farm, which becomes a 404.
  const farm = await getFarm(supabase, farmId);
  if (!farm) notFound();

  const [{ locale, t }, plots, openCrops] = await Promise.all([
    getServerMessages(),
    listPlots(supabase, farmId),
    listOpenCropsByPlot(supabase, farmId),
  ]);
  const mappedPlots = plots.filter((p) => p.boundary || p.latitude !== null);

  return (
    <Page>
      <PageTitle backHref="/farms" backLabel={t.farms.allFarms}>
        {farm.name}
      </PageTitle>
      <p className="text-lg text-stone-700">
        {[farm.village, farm.district, formatArea(farm.total_area, farm.area_unit, t, locale)].filter(Boolean).join(" · ")}
      </p>
      <LinkButton href={`/farms/${farm.id}/edit`} variant="secondary">
        {t.common.edit}
      </LinkButton>

      {mappedPlots.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">{t.farms.mapTitle}</h2>
          <PlotsMap plots={mappedPlots} label={`${t.farms.mapTitle}: ${farm.name}`} />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">{t.farms.plotsTitle}</h2>
        {plots.length === 0 ? (
          <p className="text-lg text-stone-700">{t.farms.noPlots}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {plots.map((plot) => (
              <li key={plot.id}>
                <Link
                  href={`/farms/${farm.id}/plots/${plot.id}`}
                  className="flex flex-col gap-1 rounded-2xl border-2 border-stone-200 bg-white p-4 shadow-sm hover:border-green-700 focus:outline-none focus:ring-4 focus:ring-green-300"
                >
                  <span className="text-xl font-semibold">{plot.name}</span>
                  <span className="text-lg text-stone-700">
                    {formatArea(plot.area, plot.area_unit, t, locale) ??
                      (plot.boundary_area_sq_m !== null ? formatMeasuredArea(plot.boundary_area_sq_m, t, locale) : null)}
                  </span>
                  {openCrops.get(plot.id)?.length ? (
                    <span className="text-lg font-medium text-green-800">
                      {format(t.crops.nowOnPlot, {
                        crops: openCrops.get(plot.id)!.map((c) => cropName(c.crop, locale)).join(", "),
                      })}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <LinkButton href={`/farms/${farm.id}/plots/new`}>{t.farms.addPlot}</LinkButton>
    </Page>
  );
}
