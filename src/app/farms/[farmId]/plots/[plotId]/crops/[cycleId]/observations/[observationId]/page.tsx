import { Page, PageTitle } from "@/components/ui/layout";
import { RemoveEntry } from "@/features/crop-records/components/RecordForms";
import { requestAnalysisAction } from "@/features/crop-health-ai/actions";
import { AnalysisCard } from "@/features/crop-health-ai/components/AnalysisCard";
import { AskAiForm } from "@/features/crop-health-ai/components/AskAiForm";
import { listAnalyses } from "@/features/crop-health-ai/repository";
import { canRequestAnalysis } from "@/features/crop-health-ai/rules";
import { isCropHealthAiEnabled } from "@/features/crop-health-ai/service";
import { removeObservationAction } from "@/features/observations/actions";
import { ObservationCard } from "@/features/observations/components/ObservationCard";
import { loadObservationPage } from "@/features/observations/page-data";
import { canRemoveObservation } from "@/features/observations/rules";
import { createClient } from "@/lib/supabase/server";

export default async function ObservationPage({
  params,
}: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/observations/[observationId]">) {
  const { cycle, ids, cropHref, locale, t, observation, links } = await loadObservationPage(params);
  const analyses = await listAnalyses(await createClient(), observation.id);
  const enabled = isCropHealthAiEnabled();
  const hasPhoto = observation.photos.length > 0;
  const observationIds = { ...ids, observationId: observation.id };

  return (
    <Page>
      <PageTitle backHref={`${cropHref}/observations`} backLabel={t.observations.timelineTitle}>
        {t.observations.detailTitle}
      </PageTitle>
      <ObservationCard t={t} locale={locale} observation={observation} sowingDate={cycle.actual_sowing_date} photoLinks={links} large />

      {/* AI help is separate from, and never changes, the farmer's own observation above. */}
      {hasPhoto && (enabled || analyses.length > 0) ? (
        <section className="flex flex-col gap-4 border-t-2 border-stone-200 pt-6" data-testid="ai-section">
          <h2 className="text-2xl font-semibold text-stone-900">{t.cropHealthAi.title}</h2>
          {analyses.map((a) => (
            <AnalysisCard key={a.id} t={t} locale={locale} analysis={a} />
          ))}
          {canRequestAnalysis({ enabled, hasPhoto, analyses: analyses.length }) ? (
            <AskAiForm t={t} action={requestAnalysisAction.bind(null, observationIds)} again={analyses.length > 0} />
          ) : enabled ? (
            <p className="text-lg text-stone-700">{t.cropHealthAi.limitReached}</p>
          ) : null}
        </section>
      ) : null}

      {canRemoveObservation(cycle.status) ? <RemoveEntry t={t} action={removeObservationAction.bind(null, observationIds)} /> : null}
    </Page>
  );
}
