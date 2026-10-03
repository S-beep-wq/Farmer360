import Link from "next/link";

import { DetailRow } from "@/components/ui/layout";
import { cropName } from "@/features/crops/format";
import { formatDate } from "@/features/crops/dates";
import { formatProduce } from "@/features/harvest-sales/format";
import { format, type Locale, type Messages } from "@/lib/i18n";

import { demandStateLabel } from "../format";
import type { Demand } from "../repository";
import type { DemandState } from "../rules";

const badge = "inline-flex min-h-8 items-center rounded-full px-3 text-base font-semibold";

/**
 * Whether the buyer committed to buy, and whether Kisan 360 verified them. Indicative demand is
 * never shown as a sure sale (PRODUCT_SPEC.md section 15).
 */
export function DemandBadges({ t, demandType, verification }: { t: Messages; demandType: string; verification?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {demandType === "CONFIRMED" ? (
        <span data-testid="demand-type" className={`${badge} bg-green-100 text-green-900`}>
          {t.market.confirmed}
        </span>
      ) : (
        <span data-testid="demand-type" className={`${badge} bg-amber-100 text-amber-900`}>
          {t.market.indicative}
        </span>
      )}
      {verification === undefined ? null : verification === "VERIFIED" ? (
        <span data-testid="verification" className={`${badge} bg-blue-100 text-blue-900`}>
          ✓ {t.market.verified}
        </span>
      ) : (
        <span data-testid="verification" className={`${badge} bg-stone-200 text-stone-800`}>
          {t.market.notVerified}
        </span>
      )}
    </div>
  );
}

export function DemandStateBadge({ t, state }: { t: Messages; state: DemandState }) {
  const colour = state === "OPEN" ? "bg-green-100 text-green-900" : "bg-stone-200 text-stone-800";
  return (
    <span data-testid="demand-state" className={`${badge} ${colour}`}>
      {demandStateLabel(state, t)}
    </span>
  );
}

/** "Wheat · Needs 20 quintal by 15 Nov 2026". */
export function demandHeadline(demand: Demand, t: Messages, locale: Locale) {
  return {
    crop: cropName(demand.crop, locale),
    needs: format(t.market.needs, {
      quantity: formatProduce(demand.quantity, demand.quantity_unit, t, locale),
      date: formatDate(demand.required_date, locale),
    }),
  };
}

/** The demand's details, as a definition list. */
export function DemandFacts({ t, locale, demand }: { t: Messages; locale: Locale; demand: Demand }) {
  const { needs } = demandHeadline(demand, t, locale);
  return (
    <dl>
      <DetailRow label={t.buyer.quantityLabel} value={needs} />
      <DetailRow label={t.buyer.placeLabel} value={`${demand.location}, ${demand.district}, ${demand.state}`} />
      <DetailRow label={t.buyer.pickupLabel} value={demand.pickup_available ? t.market.pickupYes : t.market.pickupNo} />
      {demand.quality_requirements ? <DetailRow label={t.market.qualityLabel} value={demand.quality_requirements} /> : null}
      {demand.payment_terms ? <DetailRow label={t.market.paymentTermsLabel} value={demand.payment_terms} /> : null}
    </dl>
  );
}

/** One demand in a list, as a tappable card. */
export function DemandCardLink(props: {
  t: Messages;
  locale: Locale;
  demand: Demand;
  href: string;
  verification?: string;
  state?: DemandState;
  extra?: string;
}) {
  const { t, locale, demand } = props;
  const { crop, needs } = demandHeadline(demand, t, locale);
  return (
    <Link
      href={props.href}
      data-testid="demand-item"
      className="flex flex-col gap-2 rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm hover:border-green-700 focus:outline-none focus:ring-4 focus:ring-green-300"
    >
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-2xl font-semibold text-stone-900">{crop}</span>
        {props.state ? <DemandStateBadge t={t} state={props.state} /> : null}
      </span>
      <span className="text-lg text-stone-800">{needs}</span>
      <span className="text-lg text-stone-700">{format(t.market.deliverTo, { place: `${demand.location}, ${demand.district}` })}</span>
      {props.extra ? <span className="text-lg text-green-800">{props.extra}</span> : null}
      <DemandBadges t={t} demandType={demand.demand_type} verification={props.verification} />
    </Link>
  );
}
