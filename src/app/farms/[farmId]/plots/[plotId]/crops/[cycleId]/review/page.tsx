import { Page, PageTitle } from "@/components/ui/layout";
import { formatDate, todayInIndia } from "@/features/crops/dates";
import { cropName } from "@/features/crops/format";
import { formatProduce } from "@/features/harvest-sales/format";
import { CropHealthHistory } from "@/features/observations/components/CropHealthSection";
import { completeSeasonAction } from "@/features/season-review/actions";
import { SeasonReviewForm } from "@/features/season-review/components/SeasonForms";
import { SeasonSummaryCard } from "@/features/season-review/components/SeasonSummaryCard";
import { loadSeasonPage } from "@/features/season-review/page-data";
import { displayWeight } from "@/features/season-review/summary";
import { format } from "@/lib/i18n";

export default async function SeasonReviewPage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/review">) {
  const { cycle, ids, cropHref, locale, t, summary, plotAreaText, activityTypes, health } = await loadSeasonPage(params);

  // Things worth checking before the records are frozen. None of them stops the farmer.
  const reminders: string[] = [];
  if (summary.harvestedKg === 0) reminders.push(t.review.reminderNoHarvest);
  if (summary.unsoldKg > 0) {
    const w = displayWeight(summary.unsoldKg);
    reminders.push(format(t.review.reminderUnsold, { quantity: formatProduce(w.quantity, w.unit, t, locale) }));
  }
  if (summary.unpaidSales > 0) reminders.push(format(t.review.reminderUnpaid, { count: summary.unpaidSales }));

  return (
    <Page>
      <PageTitle backHref={cropHref} backLabel={cropName(cycle.crop, locale)}>
        {t.review.title}
      </PageTitle>
      <SeasonSummaryCard
        t={t}
        locale={locale}
        summary={summary}
        sowingDate={cycle.actual_sowing_date}
        harvestDate={cycle.actual_harvest_date}
        plotAreaText={plotAreaText}
        activityTypes={activityTypes}
      />
      <CropHealthHistory
        t={t}
        locale={locale}
        observations={health.observations}
        links={health.links}
        sowingDate={cycle.actual_sowing_date}
        cropHref={cropHref}
      />
      {cycle.status === "HARVESTED" ? (
        <SeasonReviewForm t={t} action={completeSeasonAction.bind(null, ids)} reminders={reminders} />
      ) : (
        <section className="flex flex-col gap-2" aria-labelledby="notes-title">
          {cycle.completed_at ? (
            <p className="text-lg text-stone-700">
              {format(t.review.completedOn, { date: formatDate(todayInIndia(new Date(cycle.completed_at)), locale) })}
            </p>
          ) : null}
          <h2 id="notes-title" className="text-xl font-semibold">
            {t.review.notesTitle}
          </h2>
          <p className="whitespace-pre-line text-lg text-stone-800" data-testid="review-notes">
            {cycle.notes ?? t.review.notRecorded}
          </p>
        </section>
      )}
    </Page>
  );
}
