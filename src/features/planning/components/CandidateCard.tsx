import Link from "next/link";

import { DetailRow } from "@/components/ui/layout";
import { formatDate } from "@/features/crops/dates";
import { StaleNote } from "@/features/shared/components/OfficialInfo";
import { isStale } from "@/features/shared/official-data";
import { format, type Locale, type Messages } from "@/lib/i18n";

import type { Candidate } from "../engine";
import { days, formatRange, rupees, weight } from "../format";
import type { ReferenceEstimate } from "../reference";

/** Typical ranges from a reference source: shown apart from, and never mixed with, the farmer's records. */
function ReferenceSection({ t, locale, today, e }: { t: Messages; locale: Locale; today: string; e: ReferenceEstimate }) {
  const money = rupees(locale);
  const water = e.waterNeed && e.waterNeed in t.planning.water ? t.planning.water[e.waterNeed as keyof typeof t.planning.water] : null;
  const plain = (n: number) => new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", { maximumFractionDigits: 1 }).format(n);
  const span = (r: { min: number; max: number }, f: (n: number) => string) => (r.min === r.max ? f(r.min) : format(t.planning.range, { min: f(r.min), max: f(r.max) }));
  return (
    <section data-testid="reference" className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-stone-400 bg-stone-50 p-4">
      <h4 className="text-lg font-semibold text-stone-900">{t.planning.referenceTitle}</h4>
      <p className="text-base text-stone-700">{t.planning.referenceExplain}</p>
      <dl>
        {e.durationDays ? <DetailRow label={t.planning.duration} value={span(e.durationDays, days(t))} /> : null}
        {water ? <DetailRow label={t.planning.waterNeed} value={water} /> : null}
        {e.labourDaysPerAcre ? <DetailRow label={t.planning.labour} value={format(t.planning.personDays, { days: span(e.labourDaysPerAcre, plain) })} /> : null}
        {e.costPerAcre ? <DetailRow label={t.planning.refCost} value={span(e.costPerAcre, money)} /> : null}
        {e.yieldKgPerAcre ? <DetailRow label={t.planning.refYield} value={span(e.yieldKgPerAcre, weight(t, locale))} /> : null}
        {e.pricePerQuintal ? <DetailRow label={t.planning.refPrice} value={span(e.pricePerQuintal, money)} /> : null}
        {e.revenuePerAcre ? <DetailRow label={t.planning.refRevenue} value={span(e.revenuePerAcre, money)} /> : null}
        {e.marginPerAcre ? (
          <DetailRow label={t.planning.refMargin} value={<span data-testid="reference-margin">{span(e.marginPerAcre, money)}</span>} />
        ) : null}
        {e.text?.input_needs ? <DetailRow label={t.planning.inputNeeds} value={e.text.input_needs} /> : null}
        {e.text?.production_risks ? <DetailRow label={t.planning.risks} value={e.text.production_risks} /> : null}
        {e.text?.market_notes ? <DetailRow label={t.planning.marketNotes} value={e.text.market_notes} /> : null}
      </dl>
      {isStale(e.lastVerifiedAt, today) ? <StaleNote t={t} /> : null}
      <p className="text-base text-stone-700" data-testid="reference-source">
        <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          {format(t.schemes.source, { source: e.sourceName })}
        </a>{" "}
        · {format(t.schemes.checkedOn, { date: formatDate(e.lastVerifiedAt, locale) })}
      </p>
    </section>
  );
}

/** One crop in the comparison: the farmer's own results, then what is in the app today. */
export function CandidateCard(props: { t: Messages; locale: Locale; today: string; candidate: Candidate; cropName: string; planHref: string }) {
  const { t, locale, candidate: c } = props;
  const h = c.history;
  const money = rupees(locale);
  const notes = [
    c.openDemand > 0 ? format(t.planning.buyersNow, { count: c.openDemand }) : null,
    c.schemes > 0 ? format(t.planning.schemesCount, { count: c.schemes }) : null,
    c.insurance > 0 ? format(t.planning.insuranceCount, { count: c.insurance }) : null,
  ].filter((n): n is string => n !== null);

  return (
    <article data-testid="candidate" className="flex flex-col gap-3 rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm">
      <h3 className="text-2xl font-semibold text-stone-900">{props.cropName}</h3>
      {c.reference ? (
        <span className="inline-flex min-h-8 w-fit items-center rounded-full bg-green-50 px-3 text-base font-semibold text-green-900">{t.planning.usuallyGrown}</span>
      ) : null}
      {c.grownHereLast ? (
        <span className="inline-flex min-h-8 w-fit items-center rounded-full bg-amber-100 px-3 text-base font-semibold text-amber-900">{t.planning.grownHereLast}</span>
      ) : null}

      {h.seasons > 0 ? (
        <>
          <p className="text-lg text-stone-800">{format(t.planning.seasonsCount, { count: h.seasons, here: h.onThisPlot })}</p>
          <dl>
            {h.netPerAcre ? (
              <DetailRow label={t.planning.netPerAcre} value={<span data-testid="net-per-acre">{formatRange(h.netPerAcre, money, t)}</span>} />
            ) : (
              <p className="py-2 text-base text-stone-600">{t.planning.noAcres}</p>
            )}
            {h.costPerAcre ? <DetailRow label={t.planning.costPerAcre} value={formatRange(h.costPerAcre, money, t)} /> : null}
            {h.revenuePerAcre ? <DetailRow label={t.planning.revenuePerAcre} value={formatRange(h.revenuePerAcre, money, t)} /> : null}
            {h.harvestKgPerAcre ? <DetailRow label={t.planning.harvestPerAcre} value={formatRange(h.harvestKgPerAcre, weight(t, locale), t)} /> : null}
            {h.daysInField ? <DetailRow label={t.planning.daysInField} value={formatRange(h.daysInField, days(t), t)} /> : null}
          </dl>
        </>
      ) : null}

      {c.reference ? <ReferenceSection t={t} locale={locale} today={props.today} e={c.reference} /> : null}

      {notes.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {notes.map((n) => (
            <li key={n} className="inline-flex min-h-8 items-center rounded-full bg-green-50 px-3 text-base font-medium text-green-900">
              {n}
            </li>
          ))}
        </ul>
      ) : null}

      <Link
        href={props.planHref}
        aria-label={`${t.planning.plan}: ${props.cropName}`}
        className="flex min-h-14 items-center justify-center rounded-xl border-2 border-green-700 bg-white px-6 text-xl font-semibold text-green-800 hover:bg-green-50 focus:outline-none focus:ring-4 focus:ring-green-300"
      >
        {t.planning.plan}
      </Link>
    </article>
  );
}
