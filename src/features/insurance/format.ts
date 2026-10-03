import { formatDate } from "@/features/crops/dates";
import { format, type Locale, type Messages } from "@/lib/i18n";

export function enrollmentText(deadline: string | null, closed: boolean, t: Messages, locale: Locale): string {
  if (!deadline) return t.insurance.noDeadline;
  return format(closed ? t.insurance.enrollmentClosed : t.insurance.enrollBy, { date: formatDate(deadline, locale) });
}
