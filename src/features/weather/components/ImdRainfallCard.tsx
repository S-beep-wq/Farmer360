import { formatDate } from "@/features/crops/dates";
import { format, type Locale, type Messages } from "@/lib/i18n";

import type { ImdRainfall, ImdRainPeriod } from "../imd-rainfall";

function Row({ t, locale, label, period }: { t: Messages; locale: Locale; label: string; period: ImdRainPeriod }) {
  const n = new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", { maximumFractionDigits: 1 });
  const details = [
    period.normalMm !== null ? format(t.weather.imdRainNormal, { mm: n.format(period.normalMm) }) : null,
    period.category ? t.imdRainCategories[period.category] : null,
    period.departurePct !== null && period.category !== "NR"
      ? format(t.weather.imdRainDeparture, { pct: `${period.departurePct > 0 ? "+" : ""}${n.format(period.departurePct)}` })
      : null,
  ].filter(Boolean);
  return (
    <li className="flex flex-col gap-1 p-3" data-testid="imd-rain-period">
      <span className="text-base text-stone-700">{label}</span>
      <span className="text-lg font-semibold text-stone-900">{format(t.weather.imdRainAmount, { mm: n.format(period.actualMm) })}</span>
      {details.length > 0 ? <span className="text-base text-stone-800">{details.join(" · ")}</span> : null}
    </li>
  );
}

/** Rain measured by IMD for the district: the last day, week and season, each against normal. */
export function ImdRainfallCard({ t, locale, rainfall }: { t: Messages; locale: Locale; rainfall: ImdRainfall }) {
  const date = (d: string) => formatDate(d, locale);
  const { day, week, season } = rainfall;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border-2 border-sky-200 bg-sky-50 p-4" data-testid="imd-rainfall">
      <h3 className="text-xl font-semibold text-stone-900">{format(t.weather.imdRainTitle, { district: rainfall.district })}</h3>
      <ul className="flex flex-col divide-y divide-sky-200 rounded-xl bg-white">
        {day ? <Row t={t} locale={locale} period={day} label={format(t.weather.imdRainDay, { date: date(rainfall.date) })} /> : null}
        {week ? (
          <Row
            t={t}
            locale={locale}
            period={week}
            label={week.from && week.to ? format(t.weather.imdRainWeek, { from: date(week.from), to: date(week.to) }) : t.weather.imdRainWeekNoDates}
          />
        ) : null}
        {season ? (
          <Row t={t} locale={locale} period={season} label={season.from ? format(t.weather.imdRainSeason, { date: date(season.from) }) : t.weather.imdRainSeasonNoDate} />
        ) : null}
      </ul>
      <p className="text-base text-stone-700">{t.weather.imdRainNote}</p>
    </section>
  );
}
