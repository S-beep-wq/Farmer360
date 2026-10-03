import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, DetailRow, Page, PageTitle } from "@/components/ui/layout";
import { SEASONS } from "@/features/crops/constants";
import { todayInIndia } from "@/features/crops/dates";
import { cropName, isSeason } from "@/features/crops/format";
import { listCrops } from "@/features/crops/repository";
import { getFarm } from "@/features/farms/repository";
import { isId } from "@/features/farms/schema";
import { listInsuranceProducts } from "@/features/insurance/repository";
import { CandidateCard } from "@/features/planning/components/CandidateCard";
import { planCandidates } from "@/features/planning/engine";
import { pickReference, referenceEstimate } from "@/features/planning/reference";
import { countOpenDemand, lastCropOnPlot, listCropReferences, listPastSeasons } from "@/features/planning/repository";
import { supportCounts } from "@/features/planning/support";
import { formatArea } from "@/features/plots/format";
import { getPlot } from "@/features/plots/repository";
import { listSchemes } from "@/features/schemes/repository";
import { requireFarmer } from "@/lib/auth";
import { format } from "@/lib/i18n";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/** Crop planning for one plot and season (USER_WORKFLOWS.md section 5). */
export default async function PlanCropPage({ params, searchParams }: PageProps<"/farms/[farmId]/plots/[plotId]/plan">) {
  const farmer = await requireFarmer();
  const { farmId, plotId } = await params;
  if (!isId(farmId) || !isId(plotId)) notFound();
  const rawSeason = (await searchParams).season;
  const season = typeof rawSeason === "string" && isSeason(rawSeason) ? rawSeason : null;

  const supabase = await createClient();
  const [farm, plot, crops, last] = await Promise.all([getFarm(supabase, farmId), getPlot(supabase, farmId, plotId), listCrops(supabase), lastCropOnPlot(supabase, plotId)]);
  if (!farm || !plot) notFound();
  const { locale, t } = await getServerMessages();
  const plotHref = `/farms/${farm.id}/plots/${plot.id}`;
  const crop = (id: string) => crops.find((c) => c.id === id);
  const lastCrop = last ? crop(last.crop_id) : undefined;

  let plan = null;
  if (season) {
    const today = todayInIndia();
    const [pastSeasons, openDemand, schemes, insurance, references] = await Promise.all([
      listPastSeasons(supabase),
      countOpenDemand(supabase, today),
      listSchemes(supabase, locale),
      listInsuranceProducts(supabase, locale),
      listCropReferences(supabase, season, locale),
    ]);
    const cropIds = crops.map((c) => c.id);
    const estimates = new Map(
      cropIds.flatMap((id) => {
        const ref = pickReference(
          references.filter((r) => r.crop_id === id),
          farmer,
        );
        return ref ? [[id, referenceEstimate(ref)] as const] : [];
      }),
    );
    plan = planCandidates({
      season,
      plotId: plot.id,
      cropIds,
      pastSeasons,
      lastCropOnPlot: last?.crop_id ?? null,
      openDemand,
      references: estimates,
      ...supportCounts(cropIds, season, farmer, schemes, insurance, today),
    });
  }

  const card = (c: NonNullable<typeof plan>["others"][number]) => {
    const name = cropName(crop(c.crop_id)!, locale);
    return (
      <li key={c.crop_id}>
        <CandidateCard t={t} locale={locale} today={todayInIndia()} candidate={c} cropName={name} planHref={`${plotHref}/crops/new?crop=${c.crop_id}&season=${season}`} />
      </li>
    );
  };

  return (
    <Page>
      <PageTitle backHref={plotHref} backLabel={plot.name}>
        {t.planning.title}
      </PageTitle>
      <p className="text-lg text-stone-700">{format(t.planning.intro, { plot: plot.name })}</p>

      <Card>
        <h2 className="text-xl font-semibold text-stone-900">{t.planning.plotTitle}</h2>
        <dl>
          <DetailRow label={t.plots.enteredArea} value={formatArea(plot.area, plot.area_unit, t, locale) ?? t.plots.notSet} />
          <DetailRow label={t.plots.soil} value={plot.soil_type && plot.soil_type in t.soilTypes ? t.soilTypes[plot.soil_type as keyof typeof t.soilTypes] : t.plots.notSet} />
          <DetailRow label={t.plots.irrigation} value={plot.irrigation_available === null ? t.plots.notSet : plot.irrigation_available ? t.common.yes : t.common.no} />
        </dl>
        <p className="mt-2 text-lg text-stone-800" data-testid="last-crop">
          {last && lastCrop
            ? format(t.planning.lastCrop, { crop: cropName(lastCrop, locale), season: isSeason(last.season) ? t.seasons[last.season] : last.season })
            : t.planning.noLastCrop}
        </p>
      </Card>

      <nav aria-label={t.planning.seasonLabel} className="flex flex-col gap-2">
        <p className="text-lg font-semibold text-stone-900">{t.planning.seasonLabel}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SEASONS.map((s) => (
            <Link
              key={s}
              href={`${plotHref}/plan?season=${s}`}
              aria-current={s === season ? "page" : undefined}
              className={`flex min-h-14 items-center justify-center rounded-xl border-2 px-3 text-center text-lg font-medium focus:outline-none focus:ring-4 focus:ring-green-300 ${
                s === season ? "border-green-700 bg-green-50 text-green-900" : "border-stone-300 bg-white text-stone-900 hover:border-green-700"
              }`}
            >
              {t.seasons[s]}
            </Link>
          ))}
        </div>
      </nav>

      {plan && season ? (
        <>
          <div className="flex flex-col gap-2 rounded-xl border-2 border-blue-200 bg-blue-50 p-4 text-lg text-blue-950" data-testid="facts-note">
            <p>{t.planning.factsNote}</p>
            <p>{[...plan.withHistory, ...plan.others].some((c) => c.reference) ? t.planning.estimatesNote : t.planning.noEstimates}</p>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold text-stone-900">{format(t.planning.withHistoryTitle, { season: t.seasons[season] })}</h2>
            {plan.withHistory.length === 0 ? (
              <p className="text-lg text-stone-700">{format(t.planning.noHistory, { season: t.seasons[season] })}</p>
            ) : (
              <>
                <p className="text-lg text-stone-700">{t.planning.withHistoryHint}</p>
                <ul className="flex flex-col gap-4" data-testid="with-history">
                  {plan.withHistory.map(card)}
                </ul>
              </>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold text-stone-900">{t.planning.othersTitle}</h2>
            <p className="text-lg text-stone-700">{format(t.planning.othersHint, { season: t.seasons[season] })}</p>
            <ul className="flex flex-col gap-4" data-testid="other-crops">
              {plan.others.map(card)}
            </ul>
          </section>
        </>
      ) : null}
    </Page>
  );
}
