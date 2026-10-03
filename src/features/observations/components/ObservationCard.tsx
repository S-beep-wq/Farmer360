import Link from "next/link";

import { formatDate } from "@/features/crops/dates";
import { daysInField } from "@/features/season-review/summary";
import { format, type Locale, type Messages } from "@/lib/i18n";

import type { HealthStatus } from "../constants";
import type { Observation } from "../repository";

const HEALTH_STYLES: Record<HealthStatus, string> = {
  HEALTHY: "bg-green-100 text-green-900 border-green-300",
  PROBLEM: "bg-amber-100 text-amber-900 border-amber-300",
  SERIOUS: "bg-red-100 text-red-900 border-red-300",
  NOT_SURE: "bg-stone-100 text-stone-800 border-stone-300",
};

export function HealthBadge({ status, t }: { status: HealthStatus; t: Messages }) {
  return (
    <span data-testid="health-status" className={`inline-flex w-fit items-center rounded-full border-2 px-3 py-1 text-base font-semibold ${HEALTH_STYLES[status]}`}>
      {t.healthStatuses[status]}
    </span>
  );
}

type Props = {
  t: Messages;
  locale: Locale;
  observation: Observation;
  sowingDate: string | null;
  /** Signed links to the photos, by storage path. */
  photoLinks: Map<string, string>;
  href?: string;
  large?: boolean;
};

/** One entry of the crop health timeline: "Day 27", the photo, how the crop looked and the notes. */
export function ObservationCard({ t, locale, observation: o, sowingDate, photoLinks, href, large = false }: Props) {
  const day = daysInField(sowingDate, o.observation_date);
  const photo = o.photos[0];
  const link = photo ? photoLinks.get(photo.storage_path) : undefined;
  const date = formatDate(o.observation_date, locale);

  const body = (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-xl font-semibold">{day !== null ? format(t.observations.day, { day }) : date}</span>
        {day !== null ? <span className="text-base text-stone-600">{date}</span> : null}
      </span>
      {link ? (
        // Signed, short-lived link to a private photo; it cannot go through Next.js image optimisation.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={link}
          alt={format(t.observations.photoAlt, { date })}
          loading="lazy"
          className={`w-full rounded-xl bg-stone-100 object-cover ${large ? "max-h-[32rem]" : "h-56"}`}
          data-testid="observation-photo"
        />
      ) : null}
      <HealthBadge status={o.health_status} t={t} />
      {o.farmer_notes ? <span className="whitespace-pre-line text-lg text-stone-800">{o.farmer_notes}</span> : null}
      {o.health_status === "SERIOUS" ? <span className="rounded-lg bg-amber-50 p-3 text-base text-amber-950">{t.observations.expertHint}</span> : null}
    </>
  );

  const className = "flex flex-col gap-3 rounded-2xl border-2 border-stone-200 bg-white p-4 shadow-sm";
  return href ? (
    <Link href={href} className={`${className} hover:border-green-700 focus:outline-none focus:ring-4 focus:ring-green-300`} data-testid="observation-item">
      {body}
    </Link>
  ) : (
    <div className={className} data-testid="observation-item">
      {body}
    </div>
  );
}
