import { notFound } from "next/navigation";

import { Card, DetailRow, Page, PageTitle } from "@/components/ui/layout";
import { displayPhone } from "@/features/auth/phone";
import { formatDate, todayInIndia } from "@/features/crops/dates";
import { expressInterestAction } from "@/features/market/actions";
import { DemandBadges, DemandFacts, DemandStateBadge, demandHeadline } from "@/features/market/components/DemandDisplay";
import { InterestForm } from "@/features/market/components/MarketForms";
import { buyerTypeLabel, telHref } from "@/features/market/format";
import { getDemandForFarmer, getOwnInterest } from "@/features/market/repository";
import { demandState } from "@/features/market/rules";
import { requireFarmer } from "@/lib/auth";
import { format } from "@/lib/i18n";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function MarketDemandPage({ params }: PageProps<"/market/[demandId]">) {
  const farmer = await requireFarmer();
  const { demandId } = await params;
  const supabase = await createClient();
  const [{ locale, t }, demand, interest] = await Promise.all([
    getServerMessages(),
    getDemandForFarmer(supabase, demandId),
    getOwnInterest(supabase, farmer.id, demandId),
  ]);
  if (!demand) notFound();
  const state = demandState(demand, todayInIndia());
  const { buyer } = demand;

  return (
    <Page>
      <PageTitle backHref="/market" backLabel={t.market.title}>
        {demandHeadline(demand, t, locale).crop}
      </PageTitle>
      {state === "OPEN" ? null : (
        <div className="flex">
          <DemandStateBadge t={t} state={state} />
        </div>
      )}
      <DemandBadges t={t} demandType={demand.demand_type} verification={buyer.verification_status} />
      <Card>
        <DemandFacts t={t} locale={locale} demand={demand} />
      </Card>

      <Card>
        <h2 className="text-xl font-semibold text-stone-900">{t.market.buyerLabel}</h2>
        <dl>
          <DetailRow label={t.buyerOnboarding.nameLabel} value={buyer.organization_name ? `${buyer.name} (${buyer.organization_name})` : buyer.name} />
          <DetailRow label={t.buyerOnboarding.buyerTypeLabel} value={format(t.market.buyerFrom, { type: buyerTypeLabel(buyer.buyer_type, t), place: `${buyer.location}, ${buyer.district}` })} />
        </dl>
      </Card>

      <p className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-lg text-amber-900" data-testid="trust-note">
        {t.market.trustNote}
      </p>

      {buyer.phone && state === "OPEN" ? (
        <a
          href={telHref(buyer.phone)}
          className="flex min-h-14 items-center justify-center rounded-xl bg-green-700 px-6 text-xl font-semibold text-white hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-300"
        >
          {t.market.call} · {displayPhone(buyer.phone)}
        </a>
      ) : null}

      {interest ? (
        <section className="flex flex-col gap-2 rounded-xl border-2 border-green-200 bg-green-50 p-4" role="status">
          <p className="text-lg text-green-900">{format(t.market.interestSent, { date: formatDate(todayInIndia(new Date(interest.created_at)), locale) })}</p>
          {interest.note ? <p className="text-lg text-stone-800">{format(t.market.yourNote, { note: interest.note })}</p> : null}
        </section>
      ) : state === "OPEN" ? (
        <section className="flex flex-col gap-3 border-t-2 border-stone-200 pt-6">
          <h2 className="text-2xl font-semibold text-stone-900">{t.market.interestTitle}</h2>
          <InterestForm t={t} action={expressInterestAction.bind(null, demand.id)} />
        </section>
      ) : null}
    </Page>
  );
}
