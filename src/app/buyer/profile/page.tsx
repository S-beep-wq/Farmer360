import Link from "next/link";

import { Card, DetailRow, LinkButton, Page, PageTitle } from "@/components/ui/layout";
import { displayPhone } from "@/features/auth/phone";
import { buyerTypeLabel } from "@/features/market/format";
import { requireBuyer } from "@/lib/auth";
import { isLocale } from "@/lib/i18n";
import { getServerMessages } from "@/lib/i18n/server";

export default async function BuyerProfilePage() {
  const buyer = await requireBuyer();
  const { t } = await getServerMessages();

  return (
    <Page>
      <PageTitle backHref="/buyer" backLabel={t.buyer.homeTitle}>
        {t.buyer.profileTitle}
      </PageTitle>
      <Card>
        <dl>
          <DetailRow label={t.buyerOnboarding.nameLabel} value={buyer.name} />
          {buyer.organization_name ? <DetailRow label={t.buyerOnboarding.organizationLabel} value={buyer.organization_name} /> : null}
          <DetailRow label={t.buyerOnboarding.buyerTypeLabel} value={buyerTypeLabel(buyer.buyer_type, t)} />
          <DetailRow label={t.login.phoneLabel} value={buyer.phone ? displayPhone(buyer.phone) : "—"} />
          <DetailRow label={t.buyerOnboarding.locationLabel} value={buyer.location} />
          <DetailRow label={t.onboarding.districtLabel} value={buyer.district} />
          <DetailRow label={t.onboarding.stateLabel} value={buyer.state} />
          <DetailRow
            label={t.common.language}
            value={isLocale(buyer.preferred_language) ? t.languages[buyer.preferred_language] : buyer.preferred_language}
          />
        </dl>
      </Card>
      <LinkButton href="/buyer/profile/edit" variant="secondary">
        {t.account.editLink}
      </LinkButton>
      <section className="flex flex-col gap-3 border-t-2 border-stone-200 pt-6">
        <h2 className="text-2xl font-semibold text-stone-900">{t.account.deleteTitle}</h2>
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
