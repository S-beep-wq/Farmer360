import Link from "next/link";
import { redirect } from "next/navigation";

import { Page, PageTitle } from "@/components/ui/layout";
import { createFarmerProfileAction } from "@/features/farmer/actions";
import { ProfileForm } from "@/features/farmer/components/ProfileForm";
import { getRoleHome, requireUser } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";

export default async function OnboardingPage() {
  const user = await requireUser();
  const home = await getRoleHome(user.id);
  if (home !== "/onboarding") redirect(home);
  const { locale, t } = await getServerMessages();

  return (
    <Page>
      <PageTitle>{t.onboarding.title}</PageTitle>
      <p className="text-lg text-stone-700">{t.onboarding.intro}</p>
      <ProfileForm t={t} locale={locale} action={createFarmerProfileAction} submitLabel={t.onboarding.submit} />
      <Link
        href="/onboarding/buyer"
        className="mt-4 flex min-h-12 w-fit items-center rounded-lg px-1 text-lg font-medium text-green-800 underline underline-offset-4 focus:outline-none focus:ring-4 focus:ring-green-300"
      >
        {t.buyerOnboarding.link}
      </Link>
    </Page>
  );
}
