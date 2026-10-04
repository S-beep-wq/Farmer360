import { formatDate } from "@/features/crops/dates";
import { format, type Locale, type Messages } from "@/lib/i18n";

import { dayWarnings, rainCategory, RAINY_DAY_MM, type Forecast, type RecentRain } from "../forecast";

const number = (locale: Locale) => new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", { maximumFractionDigits: 1 });

/** Estimated rain on the past days: total, rainy days and which days, clearly marked as an estimate. */
function RecentRainSection({ t, locale, recent }: { t: Messages; locale: Locale; recent: RecentRain }) {
  const n = number(locale);
  const rainy = recent.days.filter((d) => d.rainMm !== null && d.rainMm >= RAINY_DAY_MM);
  return (
    <section className="flex flex-col gap-2 rounded-2xl border-2 border-sky-200 bg-sky-50 p-4" data-testid="recent-rain">
      <h3 className="text-xl font-semibold text-stone-900">{t.weather.recentTitle}</h3>
      {recent.totalMm === null ? (
        <p className="text-lg text-stone-800">{t.weather.recentUnknown}</p>
      ) : recent.rainyDays === 0 ? (
        <p className="text-lg text-stone-800">{t.weather.recentNone}</p>
      ) : (
        <p className="text-lg text-stone-800">{format(t.weather.recentTotal, { mm: n.format(recent.totalMm), days: recent.rainyDays })}</p>
      )}
      {rainy.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-base text-stone-800">
          {rainy.map((d) => (
            <li key={d.date}>{format(t.weather.recentDay, { date: formatDate(d.date, locale), mm: n.format(d.rainMm ?? 0) })}</li>
          ))}
        </ul>
      ) : null}
      <p className="text-base text-stone-700">{t.weather.recentNote}</p>
    </section>
  );
}

/** The 7-day forecast for a plot, clearly marked as a forecast with its source and time. */
export function WeatherCard({ t, locale, forecast, today }: { t: Messages; locale: Locale; forecast: Forecast; today: string }) {
  const n = number(locale);
  const deg = (v: number | null) => (v === null ? "–" : `${n.format(v)}°C`);
  const updated = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(forecast.fetchedAt));

  return (
    <div className="flex flex-col gap-3" data-testid="weather">
      {forecast.recent ? <RecentRainSection t={t} locale={locale} recent={forecast.recent} /> : null}
      <h3 className="text-xl font-semibold text-stone-900">{t.weather.forecastTitle}</h3>
      {forecast.now ? (
        <p className="text-lg font-medium text-stone-900" data-testid="weather-now">
          {format(t.weather.now, { temperature: deg(forecast.now.temperatureC), kind: t.weatherKinds[forecast.now.kind] })}
        </p>
      ) : null}
      <ul className="flex flex-col divide-y divide-stone-200 rounded-2xl border-2 border-stone-200 bg-white">
        {forecast.days.map((d) => {
          const warnings = dayWarnings(d);
          const rain = rainCategory(d.rainMm);
          return (
            <li key={d.date} className="flex flex-col gap-1 p-3" data-testid="weather-day">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-lg font-semibold text-stone-900">{d.date === today ? t.weather.today : formatDate(d.date, locale)}</span>
                <span className="text-lg text-stone-800">{format(t.weather.temperatures, { min: deg(d.tMinC), max: deg(d.tMaxC) })}</span>
              </div>
              <span className="text-base text-stone-800">
                {t.weatherKinds[d.kind]} ·{" "}
                {rain === "NONE"
                  ? t.weather.noRain
                  : `${t.rainCategories[rain]} (${format(t.weather.rain, { mm: n.format(d.rainMm ?? 0) })})`}
                {d.rainChance !== null ? ` · ${format(t.weather.rainChance, { chance: d.rainChance })}` : ""}
              </span>
              {d.windMaxKmh !== null ? <span className="text-base text-stone-600">{format(t.weather.wind, { speed: n.format(d.windMaxKmh) })}</span> : null}
              {warnings.length > 0 ? (
                <span className="flex flex-wrap gap-2">
                  {warnings.map((w) => (
                    <span key={w} data-testid="weather-warning" className="inline-flex min-h-8 items-center rounded-full bg-red-100 px-3 text-base font-semibold text-red-900">
                      {w === "HEAVY_RAIN" ? t.weather.heavyRain : t.weather.veryHot}
                    </span>
                  ))}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="text-base text-stone-700" data-testid="weather-note">
        {format(t.weather.note, { time: updated })}{" "}
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          {t.weather.source}
        </a>
      </p>
    </div>
  );
}
