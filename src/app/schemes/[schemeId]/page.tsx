import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Card, Page, PageTitle } from "@/components/ui/layout";
import { formatDate, todayInIndia } from "@/features/crops/dates";
import { deadlineText, matchReasons } from "@/features/schemes/format";
import { getScheme, listCurrentCrops } from "@/features/schemes/repository";
import { isStale, matchScheme } from "@/features/schemes/rules";
import { requireFarmer } from "@/lib/auth";
import { format } from "@/lib/i18n";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold text-stone-900">{title}</h2>
      {children}
    </section>
  );
}

/** Text from the official source, keeping its line breaks. */
function Official({ text }: { text: string }) {
  return <p className="whitespace-pre-line text-lg text-stone-800">{text}</p>;
}

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
      <p className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-lg text-amber-900" data-testid="eligibility-note">
        {t.schemes.notEligibility}
      </p>
      {isStale(scheme.last_verified_at, today) ? (
        <p role="status" className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-lg text-red-900" data-testid="stale-note">
          {t.schemes.stale}
        </p>
      ) : null}

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

      {scheme.official_url ? (
        <a
          href={scheme.official_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-14 items-center justify-center rounded-xl bg-green-700 px-6 text-xl font-semibold text-white hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-300"
        >
          {t.schemes.officialLink} ↗
        </a>
      ) : null}

      <footer className="flex flex-col gap-1 border-t-2 border-stone-200 pt-4 text-base text-stone-700" data-testid="scheme-source">
        <a href={scheme.source_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          {format(t.schemes.source, { source: scheme.source_name })}
        </a>
        <span>{format(t.schemes.checkedOn, { date: formatDate(scheme.last_verified_at, locale) })}</span>
      </footer>
    </Page>
  );
}
