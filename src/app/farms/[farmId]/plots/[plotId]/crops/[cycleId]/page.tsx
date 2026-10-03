import { Card, DetailRow, LinkButton, Page, PageTitle } from "@/components/ui/layout";
import { ActivityList, ExpenseList, SpentSoFar } from "@/features/crop-records/components/RecordLists";
import { listActivities, listExpenses, spentSoFar } from "@/features/crop-records/repository";
import { canRecord } from "@/features/crop-records/rules";
import { CropStatusBadge } from "@/features/crops/components/CropStatusBadge";
import { formatDate, todayInIndia } from "@/features/crops/dates";
import { cropName, isSeason, sowingSummary } from "@/features/crops/format";
import { loadCropPage } from "@/features/crops/page-data";
import { availableActions } from "@/features/crops/transitions";
import { CropResultCard, HarvestList } from "@/features/harvest-sales/components/HarvestList";
import { cropResult } from "@/features/harvest-sales/economics";
import { listHarvestsWithSales } from "@/features/harvest-sales/repository";
import { canAddHarvest, canChangeHarvests } from "@/features/harvest-sales/rules";
import { CropHealthSection } from "@/features/observations/components/CropHealthSection";
import { loadObservations } from "@/features/observations/page-data";
import { canAddObservation } from "@/features/observations/rules";
import { format } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export default async function CropCyclePage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]">) {
  const { farm, plot, cycle, cropHref, locale, t } = await loadCropPage(params);
  const actions = availableActions(cycle.status);
  const supabase = await createClient();
  const [activities, expenses, harvests, health] = await Promise.all([
    listActivities(supabase, cycle.id),
    listExpenses(supabase, cycle.id),
    listHarvestsWithSales(supabase, cycle.id),
    loadObservations(cycle.id),
  ]);
  const spent = spentSoFar(activities, expenses);
  const recording = canRecord(cycle.status);
  const sales = harvests.flatMap((h) => h.sales);
  const result = cropResult(spent.total, sales);
  const harvestAllowed = canAddHarvest(cycle.status);
  // A crop whose harvest is finished but whose quantity is not recorded yet: that is the next step.
  const harvestIsNextStep = cycle.status === "HARVESTED" && harvests.length === 0;

  return (
    <Page>
      <PageTitle backHref={`/farms/${farm.id}/plots/${plot.id}`} backLabel={plot.name}>
        {cropName(cycle.crop, locale)}
      </PageTitle>
      <CropStatusBadge status={cycle.status} t={t} />

      {/* The next step for this crop comes first. */}
      {actions.includes("recordSowing") ? <LinkButton href={`${cropHref}/sowing`}>{t.crops.recordSowing}</LinkButton> : null}
      {actions.includes("recordHarvest") ? <LinkButton href={`${cropHref}/harvest`}>{t.crops.recordHarvest}</LinkButton> : null}
      {cycle.status === "CANCELLED" ? <p className="text-lg text-stone-700">{t.crops.cancelledNote}</p> : null}
      {harvestIsNextStep ? <LinkButton href={`${cropHref}/harvests/new`}>{t.harvests.addHarvest}</LinkButton> : null}
      {/* Once the harvest is recorded, reviewing and closing the season is the next step. */}
      {actions.includes("review") ? (
        <LinkButton href={`${cropHref}/review`} variant={harvestIsNextStep ? "secondary" : "primary"}>
          {t.review.start}
        </LinkButton>
      ) : null}
      {cycle.status === "COMPLETED" ? (
        <>
          {cycle.completed_at ? (
            <p className="text-lg text-stone-700">
              {format(t.review.completedOn, { date: formatDate(todayInIndia(new Date(cycle.completed_at)), locale) })}
            </p>
          ) : null}
          <LinkButton href={`${cropHref}/review`}>{t.review.view}</LinkButton>
        </>
      ) : null}

      <Card>
        <dl>
          <DetailRow label={t.crops.plotLabel} value={`${plot.name} · ${farm.name}`} />
          <DetailRow label={t.crops.season} value={isSeason(cycle.season) ? t.seasons[cycle.season] : cycle.season} />
          <DetailRow label={t.crops.variety} value={cycle.variety_name ?? t.crops.notSet} />
          <DetailRow label={t.crops.sowingDateLabel} value={sowingSummary(cycle, t, locale) ?? t.crops.notSet} />
          {cycle.actual_harvest_date ? (
            <DetailRow label={t.crops.harvestDateLabel} value={formatDate(cycle.actual_harvest_date, locale)} />
          ) : (
            <DetailRow
              label={t.crops.expectedHarvest}
              value={cycle.expected_harvest_date ? formatDate(cycle.expected_harvest_date, locale) : t.crops.notSet}
            />
          )}
        </dl>
      </Card>

      {cycle.status === "ACTIVE" || health.observations.length > 0 ? (
        <CropHealthSection
          t={t}
          locale={locale}
          observations={health.observations}
          links={health.links}
          sowingDate={cycle.actual_sowing_date}
          cropHref={cropHref}
          canAdd={canAddObservation(cycle.status)}
        />
      ) : null}
      {sales.length > 0 ? <CropResultCard t={t} locale={locale} {...result} /> : null}
      {harvestAllowed || harvests.length > 0 ? (
        <HarvestList
          t={t}
          locale={locale}
          harvests={harvests}
          cropHref={cropHref}
          canAddHarvest={harvestAllowed && !harvestIsNextStep}
          canChange={canChangeHarvests(cycle.status)}
          paymentOnly={cycle.status === "COMPLETED"}
        />
      ) : null}
      <SpentSoFar t={t} locale={locale} {...spent} />
      {/* Crop cycle → insurance information (USER_WORKFLOWS.md section 11). */}
      {cycle.status === "PLANNED" || cycle.status === "ACTIVE" || cycle.status === "HARVESTED" ? (
        <LinkButton href={`${cropHref}/insurance`} variant="secondary">
          {t.insurance.link}
        </LinkButton>
      ) : null}
      {/* Harvest → search buyers (USER_WORKFLOWS.md section 14). */}
      {cycle.status === "ACTIVE" || cycle.status === "HARVESTED" ? (
        <LinkButton href={`/market?crop=${cycle.crop.id}`} variant="secondary">
          {format(t.market.findForCrop, { crop: cropName(cycle.crop, locale) })}
        </LinkButton>
      ) : null}

      <ActivityList t={t} locale={locale} items={activities} cropHref={cropHref} canAdd={recording} />
      <ExpenseList t={t} locale={locale} items={expenses} cropHref={cropHref} canAdd={recording} />

      {actions.includes("edit") ? (
        <LinkButton href={`${cropHref}/edit`} variant="secondary">
          {t.common.edit}
        </LinkButton>
      ) : null}
      {actions.includes("cancel") ? (
        <LinkButton href={`${cropHref}/cancel`} variant="secondary">
          {t.crops.cancel}
        </LinkButton>
      ) : null}
      <LinkButton href={`/farms/${farm.id}/plots/${plot.id}`} variant="secondary">
        {plot.name}
      </LinkButton>
    </Page>
  );
}
