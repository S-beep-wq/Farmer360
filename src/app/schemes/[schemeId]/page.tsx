import { notFound } from "next/navigation";

import { Card, Page, PageTitle } from "@/components/ui/layout";
import { todayInIndia } from "@/features/crops/dates";
import { deadlineText, matchReasons } from "@/features/schemes/format";
import { getScheme, listCurrentCrops } from "@/features/schemes/repository";
import { isStale, matchScheme } from "@/features/schemes/rules";
import {
  CautionNote,
  OfficialLinkButton,
  OfficialSection as Section,
  OfficialText as Official,
  SourceFooter,
  StaleNote,
} from "@/features/shared/components/OfficialInfo";
import { requireFarmer } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SchemePage({ params }: PageProps<"/schemes/[schemeId]">) {
  const farmer = await requireFarmer();
  const { schemeId } = await params;
  if (!UUID.test(schemeId)) notFound();
  const { locale, t } = await getServerMessages();
  const supabase = await createClient();
  const [scheme, crops] = await Promise.all([getScheme(supabase, schemeId, locale), listCurrentCrops(supabase)]);
  if (!scheme) notFound();
  const today = todayInIndia();
  const match = matchScheme(scheme, farmer, crops, today);
  const reasons = matchReasons(match, farmer, crops, t, locale);
  const { text } = scheme;

  return (
    <Page>
      <PageTitle backHref="/schemes" backLabel={t.schemes.title}>
        {text.name}
      </PageTitle>
      <p className="text-lg text-stone-700">
        {t.schemes.department}: {scheme.department}
      </p>
      {match.area !== null ? (
        <ul className="flex flex-wrap gap-2" aria-label={t.schemes.whyTitle}>
          {reasons.map((r) => (
            <li key={r} className="inline-flex min-h-8 items-center rounded-full bg-green-50 px-3 text-base font-medium text-green-900">
              {r}
            </li>
          ))}
        </ul>
      ) : null}
      <CautionNote>{t.schemes.notEligibility}</CautionNote>
      {isStale(scheme.last_verified_at, today) ? <StaleNote t={t} /> : null}

      <Card>
        <div className="flex flex-col gap-6">
          <Section title={t.schemes.summaryTitle}>
            <Official text={text.summary} />
          </Section>
          <Section title={t.schemes.eligibilityTitle}>
            <Official text={text.eligibility} />
          </Section>
          <Section title={t.schemes.benefitTitle}>
            <Official text={text.benefit} />
          </Section>
          <Section title={t.schemes.documentsTitle}>
            {text.required_documents.length === 0 ? (
              <p className="text-lg text-stone-700">{t.schemes.noDocuments}</p>
            ) : (
              <ul className="list-disc pl-6 text-lg text-stone-800">
                {text.required_documents.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </Section>
          <Section title={t.schemes.howToApplyTitle}>
            <Official text={text.how_to_apply} />
          </Section>
          <Section title={t.schemes.deadlineTitle}>
            <p className="text-lg font-medium text-stone-900">{deadlineText(scheme.application_deadline, match.deadlinePassed, t, locale)}</p>
          </Section>
        </div>
      </Card>

      {scheme.official_url ? <OfficialLinkButton href={scheme.official_url} label={t.schemes.officialLink} /> : null}
      <SourceFooter t={t} locale={locale} sourceName={scheme.source_name} sourceUrl={scheme.source_url} lastVerifiedAt={scheme.last_verified_at} />
    </Page>
  );
}
