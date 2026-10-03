import { Page, PageTitle } from "@/components/ui/layout";
import { todayInIndia } from "@/features/crops/dates";
import { listCrops } from "@/features/crops/repository";
import { DemandCardLink } from "@/features/market/components/DemandDisplay";
import { MarketFilterForm } from "@/features/market/components/MarketFilterForm";
import { listOpenDemands, listOwnInterests } from "@/features/market/repository";
import { demandState } from "@/features/market/rules";
import { marketFilterSchema } from "@/features/market/schema";
import { requireFarmer } from "@/lib/auth";
import { format } from "@/lib/i18n";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/** Buyer discovery for farmers (USER_WORKFLOWS.md section 14, farmer side). */
export default async function MarketPage({ searchParams }: PageProps<"/market">) {
  const farmer = await requireFarmer();
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filters = marketFilterSchema.parse({
    crop: first(raw.crop) || undefined,
    area: first(raw.area) || undefined,
    have: first(raw.have) || undefined,
    have_unit: first(raw.have_unit) || undefined,
  });
  const today = todayInIndia();
  const supabase = await createClient();
  const [{ locale, t }, crops, demands, interests] = await Promise.all([
    getServerMessages(),
    listCrops(supabase),
    listOpenDemands(supabase, today, filters, farmer),
    listOwnInterests(supabase, farmer.id),
  ]);

  return (
    <Page>
      <PageTitle backHref="/farms" backLabel={t.farms.title}>
        {t.market.title}
      </PageTitle>
      <p className="text-lg text-stone-700">{t.market.intro}</p>
      <MarketFilterForm t={t} locale={locale} crops={crops} farmer={farmer} values={{ ...raw, ...filters }} />

      <section className="flex flex-col gap-3" aria-live="polite">
        <p className="text-lg font-semibold text-stone-900">{format(t.market.found, { count: demands.length })}</p>
        {demands.length === 0 ? (
          <p className="text-lg text-stone-700">{t.market.empty}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {demands.map((d) => (
              <li key={d.id}>
                <DemandCardLink t={t} locale={locale} demand={d} href={`/market/${d.id}`} verification={d.buyer.verification_status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {interests.length > 0 ? (
        <section className="flex flex-col gap-3 border-t-2 border-stone-200 pt-6">
          <h2 className="text-2xl font-semibold text-stone-900">{t.market.yourResponses}</h2>
          <ul className="flex flex-col gap-4">
            {interests.map((i) => (
              <li key={i.id}>
                <DemandCardLink
                  t={t}
                  locale={locale}
                  demand={i.demand}
                  href={`/market/${i.demand.id}`}
                  verification={i.demand.buyer.verification_status}
                  state={demandState(i.demand, today)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Page>
  );
}
