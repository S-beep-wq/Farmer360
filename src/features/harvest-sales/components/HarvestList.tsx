import Link from "next/link";

import { LinkButton } from "@/components/ui/layout";
import { formatDate } from "@/features/crops/dates";
import { formatRupees } from "@/features/shared/money";
import { format, type Locale, type Messages } from "@/lib/i18n";

import { BUYER_TYPES, PAYMENT_STATUSES, QUALITY_GRADES, type BuyerType, type PaymentStatus, type QualityGrade } from "../constants";
import { formatProduce } from "../format";
import { isProduceUnit, remainingToSell, soldKg, fromKg } from "../quantities";
import type { HarvestWithSales, Sale } from "../repository";

function label<K extends string>(value: string | null, keys: readonly K[], labels: Record<K, string>) {
  return value !== null && (keys as readonly string[]).includes(value) ? labels[value as K] : value;
}

type Props = {
  t: Messages;
  locale: Locale;
  harvests: HarvestWithSales[];
  cropHref: string;
  canAddHarvest: boolean;
  canChange: boolean;
  /** After the season is closed, a sale opens its payment page instead of its edit page. */
  paymentOnly?: boolean;
};

function SaleItem({ t, locale, sale, href }: { t: Messages; locale: Locale; sale: Sale; href: string | null }) {
  const buyer = [label(sale.buyer_type, BUYER_TYPES, t.buyerTypes as Record<BuyerType, string>), sale.buyer_name].filter(Boolean).join(" · ");
  const unitLabel = isProduceUnit(sale.quantity_unit) ? t.produceUnits[sale.quantity_unit] : sale.quantity_unit;
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-lg font-semibold">{buyer}</span>
        <span className="text-lg font-semibold">{formatRupees(sale.gross_amount, locale)}</span>
      </span>
      <span className="text-base text-stone-700">
        {format(t.sales.line, {
          quantity: formatProduce(sale.quantity, sale.quantity_unit, t, locale),
          price: format(t.sales.pricePer, { price: formatRupees(sale.price_per_unit, locale), unit: unitLabel }),
          gross: formatRupees(sale.gross_amount, locale),
        })}
      </span>
      <span className="text-base text-stone-700">
        {formatDate(sale.sale_date, locale)} · {label(sale.payment_status, PAYMENT_STATUSES, t.paymentStatuses as Record<PaymentStatus, string>)}
      </span>
    </>
  );
  const className = "flex flex-col gap-1 rounded-xl border-2 border-stone-200 bg-stone-50 p-3";
  return (
    <li data-testid="sale-item">
      {href ? (
        <Link href={href} className={`${className} hover:border-green-700 focus:outline-none focus:ring-4 focus:ring-green-300`}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}

/** The crop's harvests, each with what was sold and what is left to sell. */
export function HarvestList({ t, locale, harvests, cropHref, canAddHarvest, canChange, paymentOnly = false }: Props) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="harvests-title">
      <h2 id="harvests-title" className="text-2xl font-semibold">
        {t.harvests.title}
      </h2>
      {harvests.length === 0 ? <p className="text-lg text-stone-700">{t.harvests.noHarvests}</p> : null}
      <ul className="flex flex-col gap-4">
        {harvests.map((h) => {
          const harvestHref = `${cropHref}/harvests/${h.id}`;
          const left = remainingToSell(h, h.sales);
          const sold = isProduceUnit(h.quantity_unit) ? fromKg(soldKg(h.sales), h.quantity_unit) : 0;
          return (
            <li key={h.id} data-testid="harvest-item" className="flex flex-col gap-3 rounded-2xl border-2 border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-xl font-semibold">{formatProduce(h.quantity, h.quantity_unit, t, locale)}</span>
                  {h.quality_grade ? (
                    <span className="text-base text-stone-700">{label(h.quality_grade, QUALITY_GRADES, t.qualityGrades as Record<QualityGrade, string>)}</span>
                  ) : null}
                </span>
                <span className="text-lg text-stone-700">{format(t.harvests.harvestedOn, { date: formatDate(h.harvest_date, locale) })}</span>
                <span className="text-lg text-stone-700" data-testid="harvest-sold">
                  {format(t.harvests.sold, { quantity: formatProduce(sold, h.quantity_unit, t, locale) })} ·{" "}
                  {format(t.harvests.left, { quantity: formatProduce(left, h.quantity_unit, t, locale) })}
                </span>
                {h.notes ? <span className="text-base text-stone-600">{h.notes}</span> : null}
              </div>

              {h.sales.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {h.sales.map((s) => (
                    <SaleItem
                      key={s.id}
                      t={t}
                      locale={locale}
                      sale={s}
                      href={
                        canChange
                          ? `${harvestHref}/sales/${s.id}/edit`
                          : paymentOnly
                            ? `${harvestHref}/sales/${s.id}/payment`
                            : null
                      }
                    />
                  ))}
                </ul>
              ) : null}

              {canChange && left > 0 ? <LinkButton href={`${harvestHref}/sales/new`}>{t.sales.addSale}</LinkButton> : null}
              {canChange ? (
                <LinkButton href={`${harvestHref}/edit`} variant="secondary">
                  {t.harvests.change}
                </LinkButton>
              ) : null}
            </li>
          );
        })}
      </ul>
      {canAddHarvest ? (
        <LinkButton href={`${cropHref}/harvests/new`} variant="secondary">
          {t.harvests.addHarvest}
        </LinkButton>
      ) : null}
    </section>
  );
}

/** Revenue − production costs − selling costs = net result, from what was recorded. */
export function CropResultCard(props: {
  t: Messages;
  locale: Locale;
  revenue: number;
  productionCosts: number;
  sellingCosts: number;
  net: number;
  paymentPending: boolean;
}) {
  const { t, locale } = props;
  const profit = props.net >= 0;
  const row = (name: string, value: string, testId?: string) => (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-lg text-stone-700">{name}</dt>
      <dd className="text-lg font-semibold text-stone-900" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
  return (
    <section className="rounded-2xl border-2 border-stone-300 bg-white p-5 shadow-sm" aria-labelledby="result-title">
      <h2 id="result-title" className="mb-2 text-2xl font-semibold">
        {t.result.title}
      </h2>
      <dl>
        {row(t.result.revenue, formatRupees(props.revenue, locale), "result-revenue")}
        {row(`− ${t.result.productionCosts}`, formatRupees(props.productionCosts, locale))}
        {row(`− ${t.result.sellingCosts}`, formatRupees(props.sellingCosts, locale))}
        <div className="mt-2 flex items-baseline justify-between gap-3 border-t-2 border-stone-200 pt-3">
          <dt className="text-xl font-semibold">
            {t.result.net} ({profit ? t.result.profit : t.result.loss})
          </dt>
          <dd className={`text-2xl font-bold ${profit ? "text-green-800" : "text-red-700"}`} data-testid="result-net">
            {formatRupees(Math.abs(props.net), locale)}
          </dd>
        </div>
      </dl>
      {props.paymentPending ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-base text-amber-900">{t.result.paymentPending}</p> : null}
      <p className="mt-3 text-base text-stone-600">{t.result.basedOnRecords}</p>
    </section>
  );
}
