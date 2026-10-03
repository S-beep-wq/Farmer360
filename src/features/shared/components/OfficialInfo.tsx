import type { ReactNode } from "react";

import { formatDate } from "@/features/crops/dates";
import { format, type Locale, type Messages } from "@/lib/i18n";

// Building blocks for pages showing official external information (schemes, insurance).

export function OfficialSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold text-stone-900">{title}</h2>
      {children}
    </section>
  );
}

/** Text from the official source, keeping its line breaks. */
export function OfficialText({ text }: { text: string }) {
  return <p className="whitespace-pre-line text-lg text-stone-800">{text}</p>;
}

/** A warning the farmer must see (eligibility, no guarantee). */
export function CautionNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-lg text-amber-900" data-testid="eligibility-note">
      {children}
    </p>
  );
}

export function StaleNote({ t }: { t: Messages }) {
  return (
    <p role="status" className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-lg text-red-900" data-testid="stale-note">
      {t.schemes.stale}
    </p>
  );
}

/** Opens the official website in a new tab. */
export function OfficialLinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-14 items-center justify-center rounded-xl bg-green-700 px-6 text-xl font-semibold text-white hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-300"
    >
      {label} ↗
    </a>
  );
}

/** Where the information comes from, and when it was checked. */
export function SourceFooter(props: { t: Messages; locale: Locale; sourceName: string; sourceUrl: string; lastVerifiedAt: string }) {
  const { t } = props;
  return (
    <footer className="flex flex-col gap-1 border-t-2 border-stone-200 pt-4 text-base text-stone-700" data-testid="scheme-source">
      <a href={props.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
        {format(t.schemes.source, { source: props.sourceName })}
      </a>
      <span>{format(t.schemes.checkedOn, { date: formatDate(props.lastVerifiedAt, props.locale) })}</span>
    </footer>
  );
}
