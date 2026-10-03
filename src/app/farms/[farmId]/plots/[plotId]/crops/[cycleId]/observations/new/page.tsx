import { Page, PageTitle } from "@/components/ui/layout";
import { cropName } from "@/features/crops/format";
import { createObservationAction } from "@/features/observations/actions";
import { ObservationForm } from "@/features/observations/components/ObservationForm";
import { loadNewObservationPage } from "@/features/observations/page-data";

export default async function NewObservationPage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/observations/new">) {
  const { cycle, ids, cropHref, locale, t, today, sowingDate } = await loadNewObservationPage(params);
  return (
    <Page>
      <PageTitle backHref={cropHref} backLabel={cropName(cycle.crop, locale)}>
        {t.observations.newTitle}
      </PageTitle>
      <ObservationForm t={t} action={createObservationAction.bind(null, ids)} today={today} sowingDate={sowingDate} />
    </Page>
  );
}
