import { notFound } from "next/navigation";

import { Card, Page, PageTitle } from "@/components/ui/layout";
import { displayPhone } from "@/features/auth/phone";
import { formatDate, todayInIndia } from "@/features/crops/dates";
import { closeDemandAction } from "@/features/market/actions";
import { DemandBadges, DemandFacts, DemandStateBadge, demandHeadline } from "@/features/market/components/DemandDisplay";
import { CloseDemand } from "@/features/market/components/MarketForms";
import { telHref } from "@/features/market/format";
import { getOwnDemand, listInterestedFarmers } from "@/features/market/repository";
import { demandState } from "@/features/market/rules";
import { requireBuyer } from "@/lib/auth";
import { format } from "@/lib/i18n";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function BuyerDemandPage({ params }: PageProps<"/buyer/demands/[demandId]">) {
  const buyer = await requireBuyer();
  const { demandId } = await params;
  const supabase = await createClient();
  const demand = await getOwnDemand(supabase, buyer.id, demandId);
  if (!demand) notFound();
  const [{ locale, t }, farmers] = await Promise.all([getServerMessages(), listInterestedFarmers(supabase, demandId)]);
  const state = demandState(demand, todayInIndia());

  return (
    <Page>
      <PageTitle backHref="/buyer" backLabel={t.buyer.homeTitle}>
        {demandHeadline(demand, t, locale).crop}
      </PageTitle>
      <div className="flex flex-wrap gap-2">
        <DemandStateBadge t={t} state={state} />
      </div>
      <DemandBadges t={t} demandType={demand.demand_type} />
      <Card>
        <DemandFacts t={t} locale={locale} demand={demand} />
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold text-stone-900">{t.buyer.interestedTitle}</h2>
        {farmers.length === 0 ? (
          <p className="text-lg text-stone-700">{t.buyer.noInterest}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {farmers.map((f) => (
              <li key={f.interest_id} data-testid="interested-farmer" className="flex flex-col gap-2 rounded-2xl border-2 border-stone-200 bg-white p-5">
                <span className="text-xl font-semibold text-stone-900">{f.full_name}</span>
                <span className="text-lg text-stone-700">{format(t.buyer.farmerFrom, { village: f.village, district: f.district })}</span>
                <span className="text-base text-stone-600">{format(t.buyer.respondedOn, { date: formatDate(todayInIndia(new Date(f.created_at)), locale) })}</span>
                {f.note ? <p className="text-lg text-stone-900">“{f.note}”</p> : null}
                {f.phone ? (
                  <a
                    href={telHref(f.phone)}
                    className="flex min-h-14 items-center justify-center rounded-xl bg-green-700 px-6 text-xl font-semibold text-white hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-300"
                  >
                    {format(t.buyer.callFarmer, { name: f.full_name })} · {displayPhone(f.phone)}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {state === "OPEN" || state === "DATE_PASSED" ? (
        <CloseDemand t={t} fulfil={closeDemandAction.bind(null, demand.id, "FULFILLED")} cancel={closeDemandAction.bind(null, demand.id, "CANCELLED")} />
      ) : null}
    </Page>
  );
}
