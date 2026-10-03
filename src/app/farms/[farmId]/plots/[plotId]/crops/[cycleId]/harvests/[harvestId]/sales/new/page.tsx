import { redirect } from "next/navigation";

import { Page, PageTitle } from "@/components/ui/layout";
import { cropName } from "@/features/crops/format";
import { createSaleAction } from "@/features/harvest-sales/actions";
import { SaleForm } from "@/features/harvest-sales/components/HarvestSaleForms";
import { loadHarvestPage } from "@/features/harvest-sales/page-data";
import { remainingToSell } from "@/features/harvest-sales/quantities";

export default async function NewSalePage({
  params,
}: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/harvests/[harvestId]/sales/new">) {
  const { cycle, harvest, harvestIds, harvestLabel, availableText, cropHref, locale, t, today } = await loadHarvestPage(params);
  // Nothing left to sell from this harvest.
  if (remainingToSell(harvest, harvest.sales) <= 0) redirect(cropHref);

  return (
    <Page>
      <PageTitle backHref={cropHref} backLabel={cropName(cycle.crop, locale)}>
        {t.sales.newTitle}
      </PageTitle>
      <p className="text-lg text-stone-700">{harvestLabel}</p>
      <SaleForm
        t={t}
        action={createSaleAction.bind(null, harvestIds)}
        today={today}
        minDate={harvest.harvest_date}
        availableText={availableText()}
        initialValues={{ sale_date: today, quantity_unit: harvest.quantity_unit }}
      />
    </Page>
  );
}
