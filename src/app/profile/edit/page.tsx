import { Page, PageTitle } from "@/components/ui/layout";
import { updateFarmerProfileAction } from "@/features/farmer/actions";
import { ProfileForm } from "@/features/farmer/components/ProfileForm";
import { requireFarmer } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";

export default async function EditProfilePage() {
  const farmer = await requireFarmer();
  const { locale, t } = await getServerMessages();
  const { full_name, preferred_language, state, district, village } = farmer;

  return (
    <Page>
      <PageTitle backHref="/profile" backLabel={t.account.profileTitle}>
        {t.account.editTitle}
      </PageTitle>
      <p className="text-lg text-stone-700">{t.account.editHint}</p>
      <ProfileForm
        t={t}
        locale={locale}
        action={updateFarmerProfileAction}
        submitLabel={t.common.saveChanges}
        initialValues={{ full_name, preferred_language, state, district, village }}
      />
    </Page>
  );
}
