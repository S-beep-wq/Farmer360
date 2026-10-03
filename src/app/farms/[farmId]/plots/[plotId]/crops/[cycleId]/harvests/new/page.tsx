import { Page, PageTitle } from "@/components/ui/layout";
import { cropName } from "@/features/crops/format";
import { createHarvestAction } from "@/features/harvest-sales/actions";
import { HarvestForm } from "@/features/harvest-sales/components/HarvestSaleForms";
import { loadNewHarvestPage } from "@/features/harvest-sales/page-data";

export default async function NewHarvestPage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/harvests/new">) {
  const { cycle, ids, cropHref, locale, t, today, sowingDate } = await loadNewHarvestPage(params);
  return (
    <Page>
      <PageTitle backHref={cropHref} backLabel={cropName(cycle.crop, locale)}>
        {t.harvests.newTitle}
      </PageTitle>
      <HarvestForm t={t} action={createHarvestAction.bind(null, ids)} today={today} minDate={sowingDate} initialValues={{ harvest_date: today }} />
    </Page>
  );
}
