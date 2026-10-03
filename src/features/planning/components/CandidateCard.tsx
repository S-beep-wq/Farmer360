import Link from "next/link";

import { DetailRow } from "@/components/ui/layout";
import { format, type Locale, type Messages } from "@/lib/i18n";

import type { Candidate } from "../engine";
import { days, formatRange, rupees, weight } from "../format";

/** One crop in the comparison: the farmer's own results, then what is in the app today. */
export function CandidateCard(props: { t: Messages; locale: Locale; candidate: Candidate; cropName: string; planHref: string }) {
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
