import { notFound } from "next/navigation";

import { Page, PageTitle } from "@/components/ui/layout";
import { updateFarmAction } from "@/features/farms/actions";
import { FarmForm } from "@/features/farms/components/FarmForm";
import { farmFormValues } from "@/features/farms/form-values";
import { getFarm } from "@/features/farms/repository";
import { isId } from "@/features/farms/schema";
import { requireFarmer } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function EditFarmPage({ params }: PageProps<"/farms/[farmId]/edit">) {
  await requireFarmer();
  const { farmId } = await params;
  if (!isId(farmId)) notFound();

  // Row Level Security returns nothing for another farmer's farm, which becomes a 404.
  const farm = await getFarm(await createClient(), farmId);
  if (!farm) notFound();

  const { t } = await getServerMessages();

  return (
    <Page>
      <PageTitle backHref={`/farms/${farm.id}`} backLabel={farm.name}>
        {t.farms.editTitle}
      </PageTitle>
      <FarmForm
        t={t}
        action={updateFarmAction.bind(null, farm.id)}
        initialValues={farmFormValues(farm)}
        submitLabel={t.common.saveChanges}
      />
    </Page>
  );
}
