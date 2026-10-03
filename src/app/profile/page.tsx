import Link from "next/link";

import { Card, DetailRow, LinkButton, Page, PageTitle } from "@/components/ui/layout";
import { displayPhone } from "@/features/auth/phone";
import { requireFarmer } from "@/lib/auth";
import { isLocale } from "@/lib/i18n";
import { getServerMessages } from "@/lib/i18n/server";

export default async function ProfilePage() {
  const farmer = await requireFarmer();
  const { t } = await getServerMessages();

  return (
    <Page>
      <PageTitle backHref="/farms" backLabel={t.farms.title}>
        {t.account.profileTitle}
      </PageTitle>
      <Card>
        <dl>
          <DetailRow label={t.onboarding.nameLabel} value={farmer.full_name} />
          <DetailRow label={t.login.phoneLabel} value={farmer.phone ? displayPhone(farmer.phone) : "—"} />
          <DetailRow label={t.onboarding.villageLabel} value={farmer.village} />
          <DetailRow label={t.onboarding.districtLabel} value={farmer.district} />
          <DetailRow label={t.onboarding.stateLabel} value={farmer.state} />
          <DetailRow
            label={t.common.language}
            value={isLocale(farmer.preferred_language) ? t.languages[farmer.preferred_language] : farmer.preferred_language}
          />
        </dl>
      </Card>
      <LinkButton href="/profile/edit" variant="secondary">
        {t.account.editLink}
      </LinkButton>
      <section className="flex flex-col gap-3 border-t-2 border-stone-200 pt-6">
        <h2 className="text-2xl font-semibold text-stone-900">{t.account.deleteTitle}</h2>
        <p className="text-lg text-stone-700">{t.account.deleteIntro}</p>
        <Link
          href="/profile/delete"
          className="flex min-h-14 w-full items-center justify-center rounded-xl border-2 border-red-700 bg-white px-6 text-xl font-semibold text-red-800 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-300"
        >
          {t.account.deleteLink}
        </Link>
      </section>
    </Page>
  );
}
