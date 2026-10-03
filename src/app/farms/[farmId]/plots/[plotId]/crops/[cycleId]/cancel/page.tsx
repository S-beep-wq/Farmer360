import { Page, PageTitle } from "@/components/ui/layout";
import { CancelCropForm } from "@/features/crops/components/CropStatusForms";
import { cropName } from "@/features/crops/format";
import { loadCropPage } from "@/features/crops/page-data";
import { cancelCropCycleAction } from "@/features/crops/status-actions";

export default async function CancelCropPage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/cancel">) {
  const { cycle, ids, cropHref, locale, t } = await loadCropPage(params, "cancel");
  return (
    <Page>
      <PageTitle backHref={cropHref} backLabel={cropName(cycle.crop, locale)}>
        {t.crops.cancelTitle}
      </PageTitle>
      <CancelCropForm t={t} action={cancelCropCycleAction.bind(null, ids)} backHref={cropHref} />
    </Page>
  );
}
