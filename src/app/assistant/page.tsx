import { Page, PageTitle } from "@/components/ui/layout";
import { AssistantForm } from "@/features/farm-assistant/components/AssistantForm";
import { listAssistantCrops } from "@/features/farm-assistant/repository";
import { isAiEnabled } from "@/lib/ai";
import { requireFarmer } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/** The AI farm assistant (USER_WORKFLOWS.md section 17). */
export default async function AssistantPage({ searchParams }: PageProps<"/assistant">) {
  await requireFarmer();
  const { locale, t } = await getServerMessages();
  const enabled = isAiEnabled();
  const crops = enabled ? await listAssistantCrops(await createClient(), locale) : [];
  const { crop } = await searchParams;
  const defaultCrop = typeof crop === "string" && crops.some((c) => c.id === crop) ? crop : undefined;

  return (
    <Page>
      <PageTitle backHref="/farms" backLabel={t.farms.title}>
        {t.assistant.title}
      </PageTitle>
      {enabled ? (
        <>
          <p className="text-lg text-stone-700">{t.assistant.intro}</p>
          <AssistantForm t={t} crops={crops} defaultCrop={defaultCrop} />
        </>
      ) : (
        <p className="text-lg text-stone-700">{t.assistant.notEnabled}</p>
      )}
    </Page>
  );
}
