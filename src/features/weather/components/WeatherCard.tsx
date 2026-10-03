import { formatDate } from "@/features/crops/dates";
import { format, type Locale, type Messages } from "@/lib/i18n";

import { dayWarnings, rainCategory, type Forecast } from "../forecast";

const number = (locale: Locale) => new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", { maximumFractionDigits: 1 });

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
