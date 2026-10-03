import { Card, DetailRow, LinkButton, Page, PageTitle } from "@/components/ui/layout";
import { CropStatusBadge } from "@/features/crops/components/CropStatusBadge";
import { formatDate } from "@/features/crops/dates";
import { cropName, isSeason, sowingSummary } from "@/features/crops/format";
import { loadCropPage } from "@/features/crops/page-data";
import { availableActions } from "@/features/crops/transitions";

export default async function CropCyclePage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]">) {
  const { farm, plot, cycle, cropHref, locale, t } = await loadCropPage(params);
  const actions = availableActions(cycle.status);

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
