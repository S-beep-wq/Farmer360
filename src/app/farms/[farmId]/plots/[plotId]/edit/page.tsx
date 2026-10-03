import { notFound } from "next/navigation";

import { Page, PageTitle } from "@/components/ui/layout";
import { getFarm } from "@/features/farms/repository";
import { isId } from "@/features/farms/schema";
import { updatePlotAction } from "@/features/plots/actions";
import { PlotForm } from "@/features/plots/components/PlotForm";
import { plotFormValues, plotInitialLocation } from "@/features/plots/form-values";
import { BIHAR_VIEW } from "@/features/plots/location/leaflet";
import { getPlot } from "@/features/plots/repository";
import { requireFarmer } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function EditPlotPage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]/edit">) {
  await requireFarmer();
  const { farmId, plotId } = await params;
  if (!isId(farmId) || !isId(plotId)) notFound();

  const supabase = await createClient();
  // Row Level Security returns nothing for another farmer's farm or plot, which becomes a 404.
  const [farm, plot] = await Promise.all([getFarm(supabase, farmId), getPlot(supabase, farmId, plotId)]);
  if (!farm || !plot) notFound();

  const { locale, t } = await getServerMessages();

  return (
    <Page>
      <PageTitle backHref={`/farms/${farm.id}/plots/${plot.id}`} backLabel={plot.name}>
        {t.plots.editTitle}
      </PageTitle>
      <PlotForm
        t={t}
        locale={locale}
        action={updatePlotAction.bind(null, farm.id, plot.id)}
        // Used only when the plot has no saved location; otherwise the map starts on the plot.
        initialView={plot.latitude !== null && plot.longitude !== null ? { lat: plot.latitude, lng: plot.longitude, zoom: 16 } : BIHAR_VIEW}
        initialValues={plotFormValues(plot)}
        initialLocation={plotInitialLocation(plot)}
        submitLabel={t.common.saveChanges}
      />
    </Page>
  );
}
