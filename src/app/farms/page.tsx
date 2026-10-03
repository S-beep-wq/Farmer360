import Link from "next/link";

import { Page, PageTitle, LinkButton } from "@/components/ui/layout";
import { listFarms } from "@/features/farms/repository";
import { formatArea } from "@/features/plots/format";
import { requireFarmer } from "@/lib/auth";
import { format } from "@/lib/i18n";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function FarmsPage() {
  const farmer = await requireFarmer();
  const [{ locale, t }, farms] = await Promise.all([getServerMessages(), listFarms(await createClient())]);

  return (
    <Page>
      <p className="text-xl text-stone-700">{format(t.farms.greeting, { name: farmer.full_name })}</p>
      <PageTitle>{t.farms.title}</PageTitle>

      {farms.length === 0 ? (
        <>
          <p className="text-lg text-stone-700">{t.farms.empty}</p>
          <LinkButton href="/farms/new">{t.farms.addFirstFarm}</LinkButton>
        </>
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {farms.map((farm) => (
              <li key={farm.id}>
                <Link
                  href={`/farms/${farm.id}`}
                  className="flex flex-col gap-1 rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm hover:border-green-700 focus:outline-none focus:ring-4 focus:ring-green-300"
                >
                  <span className="text-2xl font-semibold text-stone-900">{farm.name}</span>
                  <span className="text-lg text-stone-700">
                    {[farm.village, formatArea(farm.total_area, farm.area_unit, t, locale)].filter(Boolean).join(" · ")}
                  </span>
                  <span className="text-lg text-green-800">{format(t.farms.plotsCount, { count: farm.plotCount })}</span>
                </Link>
              </li>
            ))}
          </ul>
          <LinkButton href="/farms/new" variant="secondary">
            {t.farms.addFarm}
          </LinkButton>
        </>
      )}

      <LinkButton href="/market" variant="secondary">
        {t.market.link}
      </LinkButton>
      <LinkButton href="/schemes" variant="secondary">
        {t.schemes.link}
      </LinkButton>

      <Link
        href="/profile"
        className="mt-4 flex min-h-12 w-fit items-center rounded-lg px-1 text-lg font-medium text-green-800 underline underline-offset-4 focus:outline-none focus:ring-4 focus:ring-green-300"
      >
        {t.account.profileLink}
      </Link>
    </Page>
  );
}
