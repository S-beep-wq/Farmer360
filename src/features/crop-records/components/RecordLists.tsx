import Link from "next/link";

import { LinkButton } from "@/components/ui/layout";
import { formatDate } from "@/features/crops/dates";
import { QUANTITY_UNITS, type QuantityUnit } from "@/features/shared/land";
import { formatRupees } from "@/features/shared/money";
import { format, type Locale, type Messages } from "@/lib/i18n";

import { ACTIVITY_TYPES, EXPENSE_CATEGORIES, type ActivityType, type ExpenseCategory } from "../constants";
import type { Activity, Expense } from "../repository";

function quantityText(quantity: number | null, unit: string | null, t: Messages, locale: Locale) {
  if (quantity === null || unit === null || !(QUANTITY_UNITS as readonly string[]).includes(unit)) return null;
  const n = new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", { maximumFractionDigits: 3 }).format(quantity);
  return `${n} ${t.quantityUnits[unit as QuantityUnit]}`;
}

const itemClass =
  "flex flex-col gap-1 rounded-2xl border-2 border-stone-200 bg-white p-4 shadow-sm hover:border-green-700 " +
  "focus:outline-none focus:ring-4 focus:ring-green-300";

type ListProps<T> = { t: Messages; locale: Locale; items: T[]; cropHref: string; canAdd: boolean };

/** The crop's "work done" list, newest first. Each entry opens its edit page when recording is allowed. */
export function ActivityList({ t, locale, items, cropHref, canAdd }: ListProps<Activity>) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="work-title">
      <h2 id="work-title" className="text-2xl font-semibold">
        {t.records.workTitle}
      </h2>
      {items.length === 0 ? <p className="text-lg text-stone-700">{t.records.noWork}</p> : null}
      <ul className="flex flex-col gap-3">
        {items.map((a) => {
          const title = (ACTIVITY_TYPES as readonly string[]).includes(a.activity_type)
            ? t.activityTypes[a.activity_type as ActivityType]
            : a.activity_type;
          const details = [
            formatDate(a.activity_date, locale),
            quantityText(a.quantity, a.quantity_unit, t, locale),
            a.cost !== null ? formatRupees(a.cost, locale) : null,
          ].filter(Boolean);
          const body = (
            <>
              <span className="text-xl font-semibold">{title}</span>
              <span className="text-lg text-stone-700">{details.join(" · ")}</span>
              {a.notes ? <span className="text-base text-stone-600">{a.notes}</span> : null}
            </>
          );
          return (
            <li key={a.id} data-testid="activity-item">
              {canAdd ? (
                <Link href={`${cropHref}/activities/${a.id}/edit`} className={itemClass}>
                  {body}
                </Link>
              ) : (
                <div className={itemClass}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {canAdd ? (
        <LinkButton href={`${cropHref}/activities/new`} variant="secondary">
          {t.records.addWork}
        </LinkButton>
      ) : null}
    </section>
  );
}

/** The crop's costs list, newest first. */
export function ExpenseList({ t, locale, items, cropHref, canAdd }: ListProps<Expense>) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="costs-title">
      <h2 id="costs-title" className="text-2xl font-semibold">
        {t.records.costsTitle}
      </h2>
      {items.length === 0 ? <p className="text-lg text-stone-700">{t.records.noCosts}</p> : null}
      <ul className="flex flex-col gap-3">
        {items.map((e) => {
          const title = (EXPENSE_CATEGORIES as readonly string[]).includes(e.category)
            ? t.expenseCategories[e.category as ExpenseCategory]
            : e.category;
          const details = [formatDate(e.expense_date, locale), quantityText(e.quantity, e.quantity_unit, t, locale), e.vendor].filter(Boolean);
          const body = (
            <>
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-xl font-semibold">{title}</span>
                <span className="text-xl font-semibold text-stone-900">{formatRupees(e.amount, locale)}</span>
              </span>
              <span className="text-lg text-stone-700">{details.join(" · ")}</span>
              {e.notes ? <span className="text-base text-stone-600">{e.notes}</span> : null}
            </>
          );
          return (
            <li key={e.id} data-testid="expense-item">
              {canAdd ? (
                <Link href={`${cropHref}/expenses/${e.id}/edit`} className={itemClass}>
                  {body}
                </Link>
              ) : (
                <div className={itemClass}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {canAdd ? (
        <LinkButton href={`${cropHref}/expenses/new`} variant="secondary">
          {t.records.addCost}
        </LinkButton>
      ) : null}
    </section>
  );
}

/** "Spent so far: ₹4,500" with the split between work costs and other costs. */
export function SpentSoFar({ t, locale, workCosts, expenseTotal, total }: { t: Messages; locale: Locale; workCosts: number; expenseTotal: number; total: number }) {
  return (
    <section className="rounded-2xl border-2 border-green-200 bg-green-50 p-5" aria-labelledby="spent-title">
      <h2 id="spent-title" className="text-lg font-medium text-green-900">
        {t.records.spentSoFar}
      </h2>
      <p className="text-3xl font-bold text-green-950" data-testid="spent-total">
        {formatRupees(total, locale)}
      </p>
      <p className="text-base text-green-900">
        {format(t.records.spentBreakdown, { work: formatRupees(workCosts, locale), costs: formatRupees(expenseTotal, locale) })}
      </p>
    </section>
  );
}
