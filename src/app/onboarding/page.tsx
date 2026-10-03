import { redirect } from "next/navigation";

import { Page, PageTitle } from "@/components/ui/layout";
import { ProfileForm } from "@/features/farmer/components/ProfileForm";
import { getFarmerForUser } from "@/features/farmer/repository";
import { requireUser } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (await getFarmerForUser(await createClient(), user.id)) redirect("/farms");
  const { locale, t } = await getServerMessages();

  return (
    <Page>
      <PageTitle>{t.onboarding.title}</PageTitle>
      <p className="text-lg text-stone-700">{t.onboarding.intro}</p>
      <ProfileForm t={t} locale={locale} />
    </Page>
  );
}
