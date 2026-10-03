import { formatRupees } from "@/features/shared/money";
import { format, type Locale, type Messages } from "@/lib/i18n";

import type { CropTotals } from "../repository";
import { seasonSummary } from "../summary";

/** "Profit: ₹21,900" for a closed season, shown in the plot's crop history. */
export function PastResult({ t, locale, totals }: { t: Messages; locale: Locale; totals: CropTotals }) {
  const { net } = seasonSummary(totals, null);
  const profit = net >= 0;
  return (
    <span className={`text-lg font-semibold ${profit ? "text-green-800" : "text-red-700"}`} data-testid="past-result">
      {format(t.review.resultLine, { result: profit ? t.result.profit : t.result.loss, amount: formatRupees(Math.abs(net), locale) })}
    </span>
  );
}
