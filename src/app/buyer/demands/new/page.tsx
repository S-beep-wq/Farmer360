import { Page, PageTitle } from "@/components/ui/layout";
import { todayInIndia } from "@/features/crops/dates";
import { listCrops } from "@/features/crops/repository";
import { createDemandAction } from "@/features/market/actions";
import { DemandForm } from "@/features/market/components/DemandForm";
import { requireBuyer } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function NewDemandPage() {
  const buyer = await requireBuyer();
  const [{ locale, t }, crops] = await Promise.all([getServerMessages(), listCrops(await createClient())]);

  return (
    <Page>
      <PageTitle backHref="/buyer" backLabel={t.buyer.homeTitle}>
        {t.buyer.newTitle}
      </PageTitle>
      <DemandForm
        t={t}
        locale={locale}
        crops={crops}
        today={todayInIndia()}
        action={createDemandAction}
        // Where the buyer works is the usual place to deliver to.
        initialValues={{ location: buyer.location, district: buyer.district, state: buyer.state, quantity_unit: "quintal" }}
      />
    </Page>
  );
}
