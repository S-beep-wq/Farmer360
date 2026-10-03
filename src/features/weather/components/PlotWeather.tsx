import { todayInIndia } from "@/features/crops/dates";
import type { Locale, Messages } from "@/lib/i18n";

import type { WeatherPoint } from "../location";
import { fetchForecast } from "../provider";

import { WeatherCard } from "./WeatherCard";

/** Loads and shows a plot's forecast (streamed in, so a slow provider does not hold up the page). */
export async function PlotWeather({ t, locale, point }: { t: Messages; locale: Locale; point: WeatherPoint }) {
  const forecast = await fetchForecast(point);
  if (!forecast) return <p className="text-lg text-stone-700">{t.weather.unavailable}</p>;
  return <WeatherCard t={t} locale={locale} forecast={forecast} today={todayInIndia()} />;
}
