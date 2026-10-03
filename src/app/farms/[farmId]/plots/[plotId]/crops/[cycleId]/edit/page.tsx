import { notFound } from "next/navigation";

import { Page, PageTitle } from "@/components/ui/layout";
import { CropCycleEditForm } from "@/features/crops/components/CropStatusForms";
import { todayInIndia } from "@/features/crops/dates";
import { cropName } from "@/features/crops/format";
import { cropCycleFormValues } from "@/features/crops/form-values";
import { loadCropPage } from "@/features/crops/page-data";
import { listCrops } from "@/features/crops/repository";
import { updateCropCycleAction } from "@/features/crops/status-actions";
import { createClient } from "@/lib/supabase/server";

export default async function EditCropPage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/edit">) {
  const { cycle, ids, cropHref, locale, t } = await loadCropPage(params, "edit");
  const status = cycle.status;
  if (status !== "PLANNED" && status !== "ACTIVE" && status !== "HARVESTED") notFound();
  const crops = await listCrops(await createClient());

  return (
    <Page>
      <PageTitle backHref={cropHref} backLabel={cropName(cycle.crop, locale)}>
        {t.crops.editTitle}
      </PageTitle>
      <CropCycleEditForm
        t={t}
        locale={locale}
        crops={crops}
        action={updateCropCycleAction.bind(null, ids)}
        today={todayInIndia()}
        status={status}
        initialValues={cropCycleFormValues(cycle)}
      />
    </Page>
  );
}
