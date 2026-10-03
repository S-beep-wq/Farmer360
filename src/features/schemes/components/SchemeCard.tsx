import Link from "next/link";

import type { Messages } from "@/lib/i18n";

/** One scheme in a list: name, summary, why it is shown and its deadline. */
export function SchemeCard(props: { t: Messages; href: string; name: string; summary: string; reasons: string[]; deadline: string; deadlinePassed: boolean }) {
  return (
    <Link
      href={props.href}
      data-testid="scheme-item"
      className="flex flex-col gap-2 rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm hover:border-green-700 focus:outline-none focus:ring-4 focus:ring-green-300"
    >
      <span className="text-2xl font-semibold text-stone-900">{props.name}</span>
      <span className="text-lg text-stone-800">{props.summary}</span>
      <ul className="flex flex-wrap gap-2" aria-label={props.t.schemes.whyTitle}>
        {props.reasons.map((r) => (
          <li key={r} className="inline-flex min-h-8 items-center rounded-full bg-green-50 px-3 text-base font-medium text-green-900">
            {r}
          </li>
        ))}
      </ul>
      <span className={`text-lg font-medium ${props.deadlinePassed ? "text-stone-600" : "text-amber-800"}`}>{props.deadline}</span>
    </Link>
  );
}
