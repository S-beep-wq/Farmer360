import { cropName } from "@/features/crops/format";
import type { Crop } from "@/features/crops/repository";
import { PRODUCE_UNITS } from "@/features/harvest-sales/constants";
import { format, type Locale, type Messages } from "@/lib/i18n";

const controlClass =
  "block min-h-14 w-full rounded-xl border-2 border-stone-300 bg-white px-4 text-lg text-stone-900 " +
  "focus:border-green-700 focus:outline-none focus:ring-4 focus:ring-green-200";

type Values = { crop?: unknown; area?: unknown; have?: unknown; have_unit?: unknown };
const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");

/** Filters by crop, place and quantity. A plain GET form, so results can be shared and reloaded. */
export function MarketFilterForm(props: { t: Messages; locale: Locale; crops: Crop[]; farmer: { state: string; district: string }; values: Values }) {
  const { t, locale, crops, farmer, values } = props;
  return (
    <form method="get" action="/market" className="flex flex-col gap-4 rounded-2xl border-2 border-stone-200 bg-stone-50 p-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="market-crop" className="text-lg font-semibold text-stone-900">
          {t.market.cropLabel}
        </label>
        <select id="market-crop" name="crop" defaultValue={str(values.crop)} className={controlClass}>
          <option value="">{t.market.anyCrop}</option>
          {crops.map((c) => (
            <option key={c.id} value={c.id}>
              {cropName(c, locale)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="market-area" className="text-lg font-semibold text-stone-900">
          {t.market.areaLabel}
        </label>
        <select id="market-area" name="area" defaultValue={str(values.area) || "anywhere"} className={controlClass}>
          <option value="district">{format(t.market.areaDistrict, { district: farmer.district })}</option>
          <option value="state">{format(t.market.areaState, { state: farmer.state })}</option>
          <option value="anywhere">{t.market.areaAnywhere}</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="market-have" className="text-lg font-semibold text-stone-900">
          {t.market.haveLabel} <span className="ml-1 text-base font-normal text-stone-500">({t.common.optional})</span>
        </label>
        <p id="market-have-hint" className="text-base text-stone-600">
          {t.market.haveHint}
        </p>
        <div className="flex gap-3">
          <input
            id="market-have"
            name="have"
            type="text"
            inputMode="decimal"
            defaultValue={str(values.have)}
            aria-describedby="market-have-hint"
            className={`${controlClass} min-w-0 flex-1`}
          />
          <select name="have_unit" aria-label={t.harvests.unitLabel} defaultValue={str(values.have_unit) || "quintal"} className={`${controlClass} w-40 shrink-0 px-3`}>
            {PRODUCE_UNITS.map((u) => (
              <option key={u} value={u}>
                {t.produceUnits[u]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="submit"
        className="min-h-14 w-full rounded-xl bg-green-700 px-6 text-xl font-semibold text-white shadow-sm hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-300"
      >
        {t.market.search}
      </button>
    </form>
  );
}
