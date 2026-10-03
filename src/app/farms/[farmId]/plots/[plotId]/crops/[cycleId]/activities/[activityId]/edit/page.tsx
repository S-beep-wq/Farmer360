import { Page, PageTitle } from "@/components/ui/layout";
import { removeActivityAction, updateActivityAction } from "@/features/crop-records/actions";
import { ActivityForm, RemoveEntry } from "@/features/crop-records/components/RecordForms";
import { activityFormValues } from "@/features/crop-records/form-values";
import { loadActivityPage } from "@/features/crop-records/page-data";
import { cropName } from "@/features/crops/format";

export default async function EditActivityPage({
  params,
}: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/activities/[activityId]/edit">) {
  const { cycle, activity, recordIds, cropHref, locale, t, today } = await loadActivityPage(params);
  return (
    <Page>
      <PageTitle backHref={cropHref} backLabel={cropName(cycle.crop, locale)}>
        {t.records.editWorkTitle}
      </PageTitle>
      <ActivityForm t={t} action={updateActivityAction.bind(null, recordIds)} today={today} initialValues={activityFormValues(activity)} />
      <RemoveEntry t={t} action={removeActivityAction.bind(null, recordIds)} />
    </Page>
  );
}
