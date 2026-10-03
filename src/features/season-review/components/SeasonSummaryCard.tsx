import { ACTIVITY_TYPES, type ActivityType } from "@/features/crop-records/constants";
import { formatDate } from "@/features/crops/dates";
import { formatProduce } from "@/features/harvest-sales/format";
import { formatRupees } from "@/features/shared/money";
import { format, type Locale, type Messages } from "@/lib/i18n";

import { daysInField, displayWeight, type SeasonSummary } from "../summary";

type Props = {
  t: Messages;
  locale: Locale;
  summary: SeasonSummary;
  sowingDate: string | null;
  harvestDate: string | null;
  /** The plot area used for "per acre", already formatted, or null when unknown. */
  plotAreaText: string | null;
  activityTypes: string[];
};

function Row({ label, value, testId, children }: { label: string; value: string; testId?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-stone-100 py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-lg text-stone-700">{label}</dt>
        <dd className="text-lg font-semibold text-stone-900" data-testid={testId}>
          {value}
        </dd>
      </div>
      {children}
    </div>
  );
}

/** The season in numbers (USER_WORKFLOWS.md section 16): cost, harvest, revenue, result and work done. */
export function SeasonSummaryCard({ t, locale, summary, sowingDate, harvestDate, plotAreaText, activityTypes }: Props) {
  const weight = (kg: number) => {
    const w = displayWeight(kg);
    return formatProduce(w.quantity, w.unit, t, locale);
  };
  const days = daysInField(sowingDate, harvestDate);
  const profit = summary.net >= 0;

  // "Fertiliser ×2, Labour ×1", in the order the work types are listed in the app.
  const counts = new Map<string, number>();
  for (const type of activityTypes) counts.set(type, (counts.get(type) ?? 0) + 1);
  const work = ACTIVITY_TYPES.filter((type) => counts.has(type)).map(
    (type) => `${t.activityTypes[type as ActivityType]} ×${counts.get(type)}`,
  );

  return (
    // The page title already says "Season review", so the card itself has no heading.
    <section className="rounded-2xl border-2 border-stone-300 bg-white p-5 shadow-sm" aria-label={t.review.title}>
      {sowingDate && harvestDate ? (
        <p className="text-base text-stone-700">
          {format(t.review.sownToHarvest, { sown: formatDate(sowingDate, locale), harvest: formatDate(harvestDate, locale) })}
          {days !== null ? ` · ${format(t.review.daysInField, { days })}` : null}
        </p>
      ) : null}

      <dl className="mt-2">
        <Row label={t.review.totalCost} value={formatRupees(summary.totalCost, locale)} testId="review-total-cost">
          <span className="text-base text-stone-600">
            {format(t.review.costSplit, { work: formatRupees(summary.workCosts, locale), costs: formatRupees(summary.expenseTotal, locale) })}
          </span>
        </Row>
        <Row
          label={t.review.harvested}
          value={summary.harvestedKg > 0 ? weight(summary.harvestedKg) : t.review.notRecorded}
          testId="review-harvested"
        />
        {summary.harvestKgPerAcre !== null && plotAreaText ? (
          <Row label={t.review.perAcre} value={weight(summary.harvestKgPerAcre)} testId="review-per-acre">
            <span className="text-base text-stone-600">{format(t.review.perAcreNote, { area: plotAreaText })}</span>
          </Row>
        ) : null}
        <Row label={t.review.sold} value={weight(summary.soldKg)} />
        <Row label={t.result.revenue} value={formatRupees(summary.revenue, locale)} />
        <Row label={t.result.sellingCosts} value={formatRupees(summary.sellingCosts, locale)} />
        <div className="flex items-baseline justify-between gap-3 border-t-2 border-stone-200 pt-3">
          <dt className="text-xl font-semibold">
            {t.result.net} ({profit ? t.result.profit : t.result.loss})
          </dt>
          <dd className={`text-2xl font-bold ${profit ? "text-green-800" : "text-red-700"}`} data-testid="review-net">
            {formatRupees(Math.abs(summary.net), locale)}
          </dd>
        </div>
      </dl>

      <h3 className="mt-5 text-lg font-semibold">{t.review.workDone}</h3>
      <p className="text-base text-stone-700" data-testid="review-work">
        {work.length ? work.join(", ") : t.review.noWork}
      </p>
      <p className="mt-4 text-base text-stone-600">{t.result.basedOnRecords}</p>
    </section>
  );
}
