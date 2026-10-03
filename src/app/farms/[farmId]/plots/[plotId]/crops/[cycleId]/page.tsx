import { Card, DetailRow, LinkButton, Page, PageTitle } from "@/components/ui/layout";
import { ActivityList, ExpenseList, SpentSoFar } from "@/features/crop-records/components/RecordLists";
import { listActivities, listExpenses, spentSoFar } from "@/features/crop-records/repository";
import { canRecord } from "@/features/crop-records/rules";
import { CropStatusBadge } from "@/features/crops/components/CropStatusBadge";
import { formatDate } from "@/features/crops/dates";
import { cropName, isSeason, sowingSummary } from "@/features/crops/format";
import { loadCropPage } from "@/features/crops/page-data";
import { availableActions } from "@/features/crops/transitions";
import { CropResultCard, HarvestList } from "@/features/harvest-sales/components/HarvestList";
import { cropResult } from "@/features/harvest-sales/economics";
import { listHarvestsWithSales } from "@/features/harvest-sales/repository";
import { canAddHarvest, canChangeHarvests } from "@/features/harvest-sales/rules";
import { createClient } from "@/lib/supabase/server";

export default async function CropCyclePage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]">) {
  const { farm, plot, cycle, cropHref, locale, t } = await loadCropPage(params);
  const actions = availableActions(cycle.status);
  const supabase = await createClient();
  const [activities, expenses, harvests] = await Promise.all([
    listActivities(supabase, cycle.id),
    listExpenses(supabase, cycle.id),
    listHarvestsWithSales(supabase, cycle.id),
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

      {sales.length > 0 ? <CropResultCard t={t} locale={locale} {...result} /> : null}
      {harvestAllowed || harvests.length > 0 ? (
        <HarvestList
          t={t}
          locale={locale}
          harvests={harvests}
          cropHref={cropHref}
          canAddHarvest={harvestAllowed && !harvestIsNextStep}
          canChange={canChangeHarvests(cycle.status)}
        />
      ) : null}
      <SpentSoFar t={t} locale={locale} {...spent} />
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
