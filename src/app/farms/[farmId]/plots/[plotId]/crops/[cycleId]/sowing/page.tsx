import { Page, PageTitle } from "@/components/ui/layout";
import { RecordSowingForm } from "@/features/crops/components/CropStatusForms";
import { todayInIndia } from "@/features/crops/dates";
import { cropName } from "@/features/crops/format";
import { loadCropPage } from "@/features/crops/page-data";
import { recordSowingAction } from "@/features/crops/status-actions";

export default async function RecordSowingPage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/sowing">) {
  const { cycle, ids, cropHref, locale, t } = await loadCropPage(params, "recordSowing");
  return (
    <Page>
      <PageTitle backHref={cropHref} backLabel={cropName(cycle.crop, locale)}>
        {t.crops.recordSowingTitle}
      </PageTitle>
      <RecordSowingForm
        t={t}
        action={recordSowingAction.bind(null, ids)}
        today={todayInIndia()}
        expectedHarvestDate={cycle.expected_harvest_date}
      />
    </Page>
  );
}
