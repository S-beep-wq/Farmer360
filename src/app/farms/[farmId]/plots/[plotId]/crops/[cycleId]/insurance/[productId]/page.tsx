import { notFound } from "next/navigation";

import { Card, Page, PageTitle } from "@/components/ui/layout";
import { todayInIndia } from "@/features/crops/dates";
import { loadCropPage } from "@/features/crops/page-data";
import { isId } from "@/features/farms/schema";
import { enrollmentText } from "@/features/insurance/format";
import { getInsuranceProduct } from "@/features/insurance/repository";
import { isStale, matchInsurance } from "@/features/insurance/rules";
import {
  CautionNote,
  OfficialLinkButton,
  OfficialSection as Section,
  OfficialText as Official,
  SourceFooter,
  StaleNote,
} from "@/features/shared/components/OfficialInfo";
import { requireFarmer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function InsuranceProductPage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/insurance/[productId]">) {
  const { cycle, cropHref, locale, t } = await loadCropPage(params);
  const { productId } = await params;
  if (!isId(productId)) notFound();
  const farmer = await requireFarmer();
  const product = await getInsuranceProduct(await createClient(), productId, locale);
  if (!product) notFound();
  const today = todayInIndia();
  const match = matchInsurance(product, farmer, { crop_id: cycle.crop.id, season: cycle.season }, today);
  // Only information that covers this crop is shown on this crop's pages.
  if (!match.applies) notFound();
  const { text } = product;

  return (
    <Page>
      <PageTitle backHref={`${cropHref}/insurance`} backLabel={t.insurance.title}>
        {text.name}
      </PageTitle>
      <p className="text-lg text-stone-700">
        {t.insurance.provider}: {product.provider}
      </p>
      <CautionNote>{t.insurance.notGuaranteed}</CautionNote>
      {isStale(product.last_verified_at, today) ? <StaleNote t={t} /> : null}

      <Card>
        <div className="flex flex-col gap-6">
          <Section title={t.insurance.summaryTitle}>
            <Official text={text.summary} />
          </Section>
          <Section title={t.insurance.eligibilityTitle}>
            <Official text={text.eligibility} />
          </Section>
          <Section title={t.insurance.coverageTitle}>
            <Official text={text.coverage} />
          </Section>
          <Section title={t.insurance.premiumTitle}>
            <Official text={text.premium} />
          </Section>
          <Section title={t.insurance.datesTitle}>
            <p className="text-lg font-medium text-stone-900">{enrollmentText(product.enrollment_deadline, match.enrollmentClosed, t, locale)}</p>
            {text.important_dates ? <Official text={text.important_dates} /> : null}
          </Section>
        </div>
      </Card>

      <section className="flex flex-col gap-2 rounded-2xl border-2 border-red-200 bg-white p-5" data-testid="claim-process">
        <h2 className="text-xl font-semibold text-red-900">{t.insurance.claimTitle}</h2>
        <Official text={text.claim_process} />
      </section>

      {product.official_url ? <OfficialLinkButton href={product.official_url} label={t.insurance.officialLink} /> : null}
      <SourceFooter t={t} locale={locale} sourceName={product.source_name} sourceUrl={product.source_url} lastVerifiedAt={product.last_verified_at} />
    </Page>
  );
}
