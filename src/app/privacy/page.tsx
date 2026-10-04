import { Page, PageTitle } from "@/components/ui/layout";
import { PrivacyNotice } from "@/features/consent/components/PrivacyNotice";
import { getServerMessages } from "@/lib/i18n/server";

// Public: readable before logging in (linked from the login screen) and from the consent screen.
export default async function PrivacyPage() {
  const { t } = await getServerMessages();
  return (
    <Page>
      <PageTitle backHref="/" backLabel={t.common.back}>
        {t.privacy.title}
      </PageTitle>
      <PrivacyNotice t={t} contact={process.env.PRIVACY_CONTACT?.trim()} />
    </Page>
  );
}
