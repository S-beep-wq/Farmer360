import { redirect } from "next/navigation";

import { Page, PageTitle } from "@/components/ui/layout";
import { createBuyerProfileAction } from "@/features/market/actions";
import { BuyerProfileForm } from "@/features/market/components/BuyerProfileForm";
import { getRoleHome, requireUser } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";

export default async function BuyerOnboardingPage() {
  const user = await requireUser();
  const home = await getRoleHome(user.id);
  if (home !== "/onboarding") redirect(home);
  const { locale, t } = await getServerMessages();

  return (
    <Page>
      <PageTitle backHref="/onboarding" backLabel={t.common.back}>
        {t.buyerOnboarding.title}
      </PageTitle>
      <p className="text-lg text-stone-700">{t.buyerOnboarding.intro}</p>
      <BuyerProfileForm t={t} locale={locale} action={createBuyerProfileAction} submitLabel={t.buyerOnboarding.submit} />
    </Page>
  );
}
