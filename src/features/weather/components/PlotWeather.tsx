import { todayInIndia } from "@/features/crops/dates";
import type { Locale, Messages } from "@/lib/i18n";

import { fetchImdWarnings } from "../imd-provider";
import type { WeatherPoint } from "../location";
import { fetchForecast } from "../provider";

import { ImdLink, ImdWarningsCard } from "./ImdWarningsCard";
import { WeatherCard } from "./WeatherCard";

/**
 * Loads and shows a plot's weather: IMD's official district warnings when available, the recent
 * rain and forecast from weather models, and where to find IMD's own forecast. Streamed in, so a
 * slow provider does not hold up the page.
 */
export async function PlotWeather({
  t,
  locale,
  point,
  place,
}: {
  t: Messages;
  locale: Locale;
  point: WeatherPoint | null;
  place: { district: string; state: string };
}) {
  const today = todayInIndia();
  const [forecast, imd] = await Promise.all([point ? fetchForecast(point) : null, fetchImdWarnings(place)]);
  return (
    <div className="flex flex-col gap-4">
      {imd ? <ImdWarningsCard t={t} locale={locale} warnings={imd} today={today} /> : null}
      {!point ? (
        <p className="text-lg text-stone-700">{t.weather.noLocation}</p>
      ) : forecast ? (
        <WeatherCard t={t} locale={locale} forecast={forecast} today={today} />
      ) : (
        <p className="text-lg text-stone-700">{t.weather.unavailable}</p>
      )}
      <ImdLink t={t} />
    </div>
  );
}
