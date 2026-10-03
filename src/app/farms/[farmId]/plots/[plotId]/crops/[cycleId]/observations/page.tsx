import { LinkButton, Page, PageTitle } from "@/components/ui/layout";
import { cropName } from "@/features/crops/format";
import { ObservationCard } from "@/features/observations/components/ObservationCard";
import { loadTimelinePage } from "@/features/observations/page-data";
import { canAddObservation } from "@/features/observations/rules";

/** The crop health timeline, oldest first (USER_WORKFLOWS.md section 9). */
export default async function TimelinePage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/observations">) {
  const { cycle, cropHref, locale, t, observations, links } = await loadTimelinePage(params);
  return (
    <Page>
      <PageTitle backHref={cropHref} backLabel={cropName(cycle.crop, locale)}>
        {t.observations.timelineTitle}
      </PageTitle>
      {observations.length === 0 ? <p className="text-lg text-stone-700">{t.observations.empty}</p> : null}
      <ol className="flex flex-col gap-4">
        {observations.map((o) => (
          <li key={o.id}>
            <ObservationCard
              t={t}
              locale={locale}
              observation={o}
              sowingDate={cycle.actual_sowing_date}
              photoLinks={links}
              href={`${cropHref}/observations/${o.id}`}
            />
          </li>
        ))}
      </ol>
      {canAddObservation(cycle.status) ? <LinkButton href={`${cropHref}/observations/new`}>{t.observations.add}</LinkButton> : null}
    </Page>
  );
}
