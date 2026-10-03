import { Page, PageTitle } from "@/components/ui/layout";
import { createActivityAction } from "@/features/crop-records/actions";
import { ActivityForm } from "@/features/crop-records/components/RecordForms";
import { loadRecordPage } from "@/features/crop-records/page-data";
import { cropName } from "@/features/crops/format";

export default async function NewActivityPage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/activities/new">) {
  const { cycle, ids, cropHref, locale, t, today } = await loadRecordPage(params);
  return (
    <Page>
      <PageTitle backHref={cropHref} backLabel={cropName(cycle.crop, locale)}>
        {t.records.newWorkTitle}
      </PageTitle>
      <ActivityForm t={t} action={createActivityAction.bind(null, ids)} today={today} initialValues={{ activity_date: today }} />
    </Page>
  );
}
