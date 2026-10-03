import { notFound } from "next/navigation";

import { Page, PageTitle } from "@/components/ui/layout";
import { getFarm } from "@/features/farms/repository";
import { isId } from "@/features/farms/schema";
import { createPlotAction } from "@/features/plots/actions";
import { PlotForm } from "@/features/plots/components/PlotForm";
import { BIHAR_VIEW } from "@/features/plots/location/leaflet";
import { listPlots } from "@/features/plots/repository";
import { requireFarmer } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function NewPlotPage({ params }: PageProps<"/farms/[farmId]/plots/new">) {
  await requireFarmer();
  const { farmId } = await params;
  if (!isId(farmId)) notFound();

  const supabase = await createClient();
  const farm = await getFarm(supabase, farmId);
  if (!farm) notFound();

  const [{ locale, t }, plots] = await Promise.all([getServerMessages(), listPlots(supabase, farmId)]);

  // Start the map near this farm's other plots when there are any.
  const known = plots.find((p) => p.latitude !== null && p.longitude !== null);
  const initialView =
    known && known.latitude !== null && known.longitude !== null
      ? { lat: known.latitude, lng: known.longitude, zoom: 16 }
      : BIHAR_VIEW;

  return (
    <Page>
      <PageTitle backHref={`/farms/${farm.id}`} backLabel={farm.name}>
        {t.plots.newTitle}
      </PageTitle>
      <PlotForm t={t} locale={locale} action={createPlotAction.bind(null, farm.id)} initialView={initialView} />
    </Page>
  );
}
