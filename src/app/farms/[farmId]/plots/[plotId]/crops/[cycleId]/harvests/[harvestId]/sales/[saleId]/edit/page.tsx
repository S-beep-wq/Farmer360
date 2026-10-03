import { notFound } from "next/navigation";

import { Page, PageTitle } from "@/components/ui/layout";
import { RemoveEntry } from "@/features/crop-records/components/RecordForms";
import { cropName } from "@/features/crops/format";
import { removeSaleAction, updateSaleAction } from "@/features/harvest-sales/actions";
import { SaleForm } from "@/features/harvest-sales/components/HarvestSaleForms";
import { saleFormValues } from "@/features/harvest-sales/form-values";
import { loadHarvestPage } from "@/features/harvest-sales/page-data";

export default async function EditSalePage({
  params,
}: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/harvests/[harvestId]/sales/[saleId]/edit">) {
  const { saleId } = await params;
  const { cycle, harvest, harvestIds, harvestLabel, availableText, cropHref, locale, t, today } = await loadHarvestPage(params);
  const sale = harvest.sales.find((s) => s.id === saleId);
  if (!sale) notFound();
  const saleIds = { ...harvestIds, saleId: sale.id };

  return (
    <Page>
      <PageTitle backHref={cropHref} backLabel={cropName(cycle.crop, locale)}>
        {t.sales.editTitle}
      </PageTitle>
      <p className="text-lg text-stone-700">{harvestLabel}</p>
      <SaleForm
        t={t}
        action={updateSaleAction.bind(null, saleIds)}
        today={today}
        minDate={harvest.harvest_date}
        availableText={availableText(sale.id)}
        initialValues={saleFormValues(sale)}
      />
      <RemoveEntry t={t} action={removeSaleAction.bind(null, saleIds)} />
    </Page>
  );
}
