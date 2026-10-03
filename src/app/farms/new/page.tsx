import { Page, PageTitle } from "@/components/ui/layout";
import { createFarmAction } from "@/features/farms/actions";
import { FarmForm } from "@/features/farms/components/FarmForm";
import { requireFarmer } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";

export default async function NewFarmPage() {
  const farmer = await requireFarmer();
  const { t } = await getServerMessages();

  return (
    <Page>
      <PageTitle backHref="/farms" backLabel={t.farms.allFarms}>
        {t.farms.newTitle}
      </PageTitle>
      <FarmForm t={t} action={createFarmAction} initialValues={{ village: farmer.village }} submitLabel={t.farms.create} />
    </Page>
  );
}
