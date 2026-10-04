import { formatDate } from "@/features/crops/dates";
import { format, type Locale, type Messages } from "@/lib/i18n";

import type { ImdLevel, ImdWarnings } from "../imd";

/** Official IMD website, linked from every plot's weather. */
export const IMD_WEBSITE = "https://mausam.imd.gov.in/";

const LEVEL_STYLES: Record<ImdLevel, string> = {
  GREEN: "border-green-300 bg-green-50 text-green-900",
  YELLOW: "border-yellow-400 bg-yellow-50 text-yellow-900",
  ORANGE: "border-orange-400 bg-orange-50 text-orange-900",
  RED: "border-red-500 bg-red-50 text-red-900",
};

/** IMD's colour-coded warnings for the district, day by day. The colour is always also written out. */
export function ImdWarningsCard({ t, locale, warnings, today }: { t: Messages; locale: Locale; warnings: ImdWarnings; today: string }) {
  return (
    <section className="flex flex-col gap-2" data-testid="imd-warnings">
      <h3 className="text-xl font-semibold text-stone-900">{format(t.weather.imdTitle, { district: warnings.district })}</h3>
      <ul className="flex flex-col gap-2">
        {warnings.days.map((d) => (
          <li key={d.date} className={`flex flex-col gap-1 rounded-xl border-2 p-3 ${LEVEL_STYLES[d.level]}`} data-testid="imd-day">
            <span className="text-lg font-semibold">
              {d.date === today ? t.weather.today : formatDate(d.date, locale)} · {t.imdLevels[d.level]}
            </span>
            <span className="text-base">{d.hazards.length > 0 ? d.hazards.map((h) => t.imdHazards[h]).join(", ") : t.weather.imdNoWarning}</span>
          </li>
        ))}
      </ul>
      <p className="text-base text-stone-700">{format(t.weather.imdIssued, { date: formatDate(warnings.issuedOn, locale) })}</p>
    </section>
  );
}

/** Where to find IMD's own forecast, shown whether or not IMD data is in the app. */
export function ImdLink({ t }: { t: Messages }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border-2 border-stone-200 bg-white p-4" data-testid="imd-link">
      <h3 className="text-xl font-semibold text-stone-900">{t.weather.imdLinkTitle}</h3>
      <p className="text-base text-stone-800">{t.weather.imdLinkText}</p>
      <a href={IMD_WEBSITE} target="_blank" rel="noopener noreferrer" className="w-fit text-lg font-semibold text-green-800 underline underline-offset-4">
        {t.weather.imdLink}
      </a>
    </section>
  );
}
