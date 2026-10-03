import { Page, PageTitle } from "@/components/ui/layout";
import { todayInIndia } from "@/features/crops/dates";
import { SchemeCard } from "@/features/schemes/components/SchemeCard";
import { deadlineText, matchReasons } from "@/features/schemes/format";
import { listCurrentCrops, listSchemes } from "@/features/schemes/repository";
import { byDeadline, matchScheme, mayBeRelevant } from "@/features/schemes/rules";
import { requireFarmer } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/** Government schemes that may be relevant to the farmer (USER_WORKFLOWS.md section 10). */
export default async function SchemesPage() {
  const farmer = await requireFarmer();
  const { locale, t } = await getServerMessages();
  const supabase = await createClient();
  const [schemes, crops] = await Promise.all([listSchemes(supabase, locale), listCurrentCrops(supabase)]);
  const today = todayInIndia();

  const inArea = schemes
    .map((scheme) => ({ scheme, match: matchScheme(scheme, farmer, crops, today) }))
    .filter(({ match }) => match.area !== null)
    .sort((a, b) => byDeadline(a.scheme, b.scheme) || a.scheme.text.name.localeCompare(b.scheme.text.name));
  const relevant = inArea.filter(({ match }) => mayBeRelevant(match));
  const other = inArea.filter(({ match }) => !mayBeRelevant(match));

  const card = ({ scheme, match }: (typeof inArea)[number]) => (
    <li key={scheme.id}>
      <SchemeCard
        t={t}
        href={`/schemes/${scheme.id}`}
        name={scheme.text.name}
        summary={scheme.text.summary}
        reasons={matchReasons(match, farmer, crops, t, locale)}
        deadline={deadlineText(scheme.application_deadline, match.deadlinePassed, t, locale)}
        deadlinePassed={match.deadlinePassed}
      />
    </li>
  );

  return (
    <Page>
      <PageTitle backHref="/farms" backLabel={t.farms.title}>
        {t.schemes.title}
      </PageTitle>
      <p className="text-lg text-stone-700">{t.schemes.intro}</p>
      <p className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-lg text-amber-900" data-testid="eligibility-note">
        {t.schemes.notEligibility}
      </p>

      {inArea.length === 0 ? (
        <p className="text-lg text-stone-700">{t.schemes.none}</p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold text-stone-900">{t.schemes.relevantTitle}</h2>
            {relevant.length === 0 ? <p className="text-lg text-stone-700">{t.schemes.relevantEmpty}</p> : <ul className="flex flex-col gap-4">{relevant.map(card)}</ul>}
          </section>
          {other.length > 0 ? (
            <section className="flex flex-col gap-3" data-testid="other-schemes">
              <h2 className="text-2xl font-semibold text-stone-900">{t.schemes.otherTitle}</h2>
              <p className="text-lg text-stone-700">{t.schemes.otherHint}</p>
              <ul className="flex flex-col gap-4">{other.map(card)}</ul>
            </section>
          ) : null}
        </>
      )}
    </Page>
  );
}
