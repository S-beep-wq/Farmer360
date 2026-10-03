import Link from "next/link";

import { LinkButton, Page, PageTitle } from "@/components/ui/layout";
import { todayInIndia } from "@/features/crops/dates";
import { DemandCardLink } from "@/features/market/components/DemandDisplay";
import { listOwnDemands } from "@/features/market/repository";
import { demandState } from "@/features/market/rules";
import { requireBuyer } from "@/lib/auth";
import { format } from "@/lib/i18n";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function BuyerHomePage() {
  const buyer = await requireBuyer();
  const [{ locale, t }, demands] = await Promise.all([getServerMessages(), listOwnDemands(await createClient(), buyer.id)]);
  const today = todayInIndia();

  return (
    <Page>
      <p className="text-xl text-stone-700">{format(t.buyer.greeting, { name: buyer.name })}</p>
      <PageTitle>{t.buyer.homeTitle}</PageTitle>
      <p className={`rounded-xl border-2 p-4 text-lg ${buyer.verification_status === "VERIFIED" ? "border-blue-200 bg-blue-50 text-blue-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        {buyer.verification_status === "VERIFIED" ? t.buyer.verified : t.buyer.notVerified}
      </p>
      <LinkButton href="/buyer/demands/new">{t.buyer.addDemand}</LinkButton>

      {demands.length === 0 ? (
        <p className="text-lg text-stone-700">{t.buyer.empty}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {demands.map((d) => (
            <li key={d.id}>
              <DemandCardLink
                t={t}
                locale={locale}
                demand={d}
                href={`/buyer/demands/${d.id}`}
                state={demandState(d, today)}
                extra={format(t.buyer.interestedCount, { count: d.interestCount })}
              />
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/buyer/profile"
        className="mt-4 flex min-h-12 w-fit items-center rounded-lg px-1 text-lg font-medium text-green-800 underline underline-offset-4 focus:outline-none focus:ring-4 focus:ring-green-300"
      >
        {t.buyer.profileLink}
      </Link>
    </Page>
  );
}
