import { Page, PageTitle } from "@/components/ui/layout";
import { RemoveEntry } from "@/features/crop-records/components/RecordForms";
import { removeObservationAction } from "@/features/observations/actions";
import { ObservationCard } from "@/features/observations/components/ObservationCard";
import { loadObservationPage } from "@/features/observations/page-data";
import { canRemoveObservation } from "@/features/observations/rules";

export default async function ObservationPage({
  params,
}: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/observations/[observationId]">) {
  const { cycle, ids, cropHref, locale, t, observation, links } = await loadObservationPage(params);
  return (
    <Page>
      <PageTitle backHref={`${cropHref}/observations`} backLabel={t.observations.timelineTitle}>
        {t.observations.detailTitle}
      </PageTitle>
      <ObservationCard t={t} locale={locale} observation={observation} sowingDate={cycle.actual_sowing_date} photoLinks={links} large />
      {canRemoveObservation(cycle.status) ? (
        <RemoveEntry t={t} action={removeObservationAction.bind(null, { ...ids, observationId: observation.id })} />
      ) : null}
    </Page>
  );
}
