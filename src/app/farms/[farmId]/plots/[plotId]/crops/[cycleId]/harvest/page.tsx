import { Page, PageTitle } from "@/components/ui/layout";
import { RecordHarvestForm } from "@/features/crops/components/CropStatusForms";
import { todayInIndia } from "@/features/crops/dates";
import { cropName } from "@/features/crops/format";
import { loadCropPage } from "@/features/crops/page-data";
import { recordHarvestAction } from "@/features/crops/status-actions";

export default async function RecordHarvestPage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/harvest">) {
  const { cycle, ids, cropHref, locale, t } = await loadCropPage(params, "recordHarvest");
  return (
    <Page>
      <PageTitle backHref={cropHref} backLabel={cropName(cycle.crop, locale)}>
        {t.crops.recordHarvestTitle}
      </PageTitle>
      <RecordHarvestForm
        t={t}
        action={recordHarvestAction.bind(null, ids)}
        today={todayInIndia()}
        sowingDate={cycle.actual_sowing_date ?? ""}
      />
    </Page>
  );
}
