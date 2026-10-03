import { notFound, redirect } from "next/navigation";

import { Page, PageTitle } from "@/components/ui/layout";
import { cropName } from "@/features/crops/format";
import { loadCropPage } from "@/features/crops/page-data";
import { isId } from "@/features/farms/schema";
import { getHarvestWithSales } from "@/features/harvest-sales/repository";
import { updateSalePaymentAction } from "@/features/season-review/actions";
import { SalePaymentForm } from "@/features/season-review/components/SeasonForms";
import { createClient } from "@/lib/supabase/server";

/** After the season is closed, only a sale's payment status can be updated. */
export default async function SalePaymentPage({
  params,
}: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/harvests/[harvestId]/sales/[saleId]/payment">) {
  const { harvestId, saleId } = await params;
  const { cycle, ids, cropHref, locale, t } = await loadCropPage(params);
  if (cycle.status !== "COMPLETED") redirect(cropHref);

  const harvest = isId(harvestId) ? await getHarvestWithSales(await createClient(), cycle.id, harvestId) : null;
  const sale = harvest?.sales.find((s) => s.id === saleId);
  if (!harvest || !sale) notFound();

  return (
    <Page>
      <PageTitle backHref={cropHref} backLabel={cropName(cycle.crop, locale)}>
        {t.review.paymentTitle}
      </PageTitle>
      <SalePaymentForm
        t={t}
        action={updateSalePaymentAction.bind(null, { ...ids, harvestId: harvest.id, saleId: sale.id })}
        current={sale.payment_status}
      />
    </Page>
  );
}
