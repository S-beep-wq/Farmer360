import { Page, PageTitle } from "@/components/ui/layout";
import { updateBuyerProfileAction } from "@/features/market/actions";
import { BuyerProfileForm } from "@/features/market/components/BuyerProfileForm";
import { requireBuyer } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";

export default async function EditBuyerProfilePage() {
  const buyer = await requireBuyer();
  const { locale, t } = await getServerMessages();
  const { name, organization_name, buyer_type, preferred_language, state, district, location } = buyer;

  return (
    <Page>
      <PageTitle backHref="/buyer/profile" backLabel={t.buyer.profileTitle}>
        {t.buyer.editTitle}
      </PageTitle>
      <BuyerProfileForm
        t={t}
        locale={locale}
        action={updateBuyerProfileAction}
        submitLabel={t.common.saveChanges}
        initialValues={{ name, organization_name: organization_name ?? "", buyer_type, preferred_language, state, district, location }}
      />
    </Page>
  );
}
