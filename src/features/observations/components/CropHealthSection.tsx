import Link from "next/link";

import { LinkButton } from "@/components/ui/layout";
import { formatDate } from "@/features/crops/dates";
import { daysInField } from "@/features/season-review/summary";
import { format, type Locale, type Messages } from "@/lib/i18n";

import type { Observation } from "../repository";

import { HealthBadge, ObservationCard } from "./ObservationCard";

type Props = {
  t: Messages;
  locale: Locale;
  observations: Observation[];
  links: Map<string, string>;
  sowingDate: string | null;
  cropHref: string;
  canAdd: boolean;
};

/** The crop page's "Crop health" section: the latest observation and the way to add more. */
export function CropHealthSection({ t, locale, observations, links, sowingDate, cropHref, canAdd }: Props) {
  const latest = observations.at(-1);
  return (
    <section className="flex flex-col gap-3" aria-labelledby="health-title">
      <h2 id="health-title" className="text-2xl font-semibold">
        {t.observations.title}
      </h2>
      {latest ? (
        <ObservationCard
          t={t}
          locale={locale}
          observation={latest}
          sowingDate={sowingDate}
          photoLinks={links}
          href={`${cropHref}/observations/${latest.id}`}
        />
      ) : (
        <p className="text-lg text-stone-700">{t.observations.empty}</p>
      )}
      {canAdd ? <LinkButton href={`${cropHref}/observations/new`}>{t.observations.add}</LinkButton> : null}
      {observations.length > 0 ? (
        <LinkButton href={`${cropHref}/observations`} variant="secondary">
          {t.observations.seeAll} ({observations.length})
        </LinkButton>
      ) : null}
    </section>
  );
}

/** Compact crop health history for the season review: one line per observation, with a thumbnail. */
export function CropHealthHistory({ t, locale, observations, links, sowingDate, cropHref }: Omit<Props, "canAdd">) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="history-title">
      <h2 id="history-title" className="text-xl font-semibold">
        {t.observations.title}
      </h2>
      {observations.length === 0 ? <p className="text-base text-stone-700">{t.observations.empty}</p> : null}
      <ol className="flex flex-col gap-2" data-testid="health-history">
        {observations.map((o) => {
          const day = daysInField(sowingDate, o.observation_date);
          const link = o.photos[0] ? links.get(o.photos[0].storage_path) : undefined;
          return (
            <li key={o.id}>
              <Link
                href={`${cropHref}/observations/${o.id}`}
                className="flex items-center gap-3 rounded-xl border-2 border-stone-200 bg-white p-2 hover:border-green-700 focus:outline-none focus:ring-4 focus:ring-green-300"
              >
                {link ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={link} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="h-16 w-16 shrink-0 rounded-lg bg-stone-100" aria-hidden="true" />
                )}
                <span className="flex flex-col gap-1">
                  <span className="text-base font-semibold">
                    {day !== null ? `${format(t.observations.day, { day })} · ` : ""}
                    {formatDate(o.observation_date, locale)}
                  </span>
                  <HealthBadge status={o.health_status} t={t} />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
