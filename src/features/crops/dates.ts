// Calendar dates (no time of day) as ISO "YYYY-MM-DD" strings, the format of <input type="date">
// and of Postgres `date` columns. "Today" is the farmer's day in India, not the server's.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date between 2000 and 2100. */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 2000 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Today's date in India (Asia/Kolkata). */
export function todayInIndia(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "12 Nov 2026" / "12 नव॰ 2026". */
export function formatDate(isoDate: string, locale: "hi" | "en"): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
