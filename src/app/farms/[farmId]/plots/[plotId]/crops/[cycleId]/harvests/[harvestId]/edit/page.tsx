import { Page, PageTitle } from "@/components/ui/layout";
import { RemoveEntry } from "@/features/crop-records/components/RecordForms";
import { cropName } from "@/features/crops/format";
import { removeHarvestAction, updateHarvestAction } from "@/features/harvest-sales/actions";
import { HarvestForm } from "@/features/harvest-sales/components/HarvestSaleForms";
import { harvestFormValues } from "@/features/harvest-sales/form-values";
import { loadHarvestPage } from "@/features/harvest-sales/page-data";

export default async function EditHarvestPage({
  params,
}: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/harvests/[harvestId]/edit">) {
  const { cycle, harvest, harvestIds, cropHref, locale, t, today, sowingDate } = await loadHarvestPage(params);
  return (
    <Page>
      <PageTitle backHref={cropHref} backLabel={cropName(cycle.crop, locale)}>
        {t.harvests.editTitle}
      </PageTitle>
      <HarvestForm
        t={t}
        action={updateHarvestAction.bind(null, harvestIds)}
        today={today}
        minDate={sowingDate}
        initialValues={harvestFormValues(harvest)}
      />
      <RemoveEntry t={t} action={removeHarvestAction.bind(null, harvestIds)} />
    </Page>
  );
}
