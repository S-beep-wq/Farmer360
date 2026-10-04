import type { ReactNode } from "react";

import { format, type Messages } from "@/lib/i18n";

import { NOTICE_VERSION } from "../constants";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-2xl font-bold text-stone-900">{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-6 text-lg text-stone-800">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * The full data-use notice. It describes what the app actually does; when that changes, update
 * this text and NOTICE_VERSION together. `contact` is who handles questions and complaints.
 */
export function PrivacyNotice({ t, contact }: { t: Messages; contact: string | undefined }) {
  const p = t.privacy;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-base text-stone-600">{format(p.version, { date: NOTICE_VERSION })}</p>
      <p className="text-lg text-stone-800">{p.intro}</p>
      <Section title={p.whoTitle}>
        <p className="text-lg text-stone-800">{p.whoText}</p>
        <p data-testid="privacy-contact" className="rounded-xl border-2 border-stone-200 bg-white p-4 text-lg font-medium text-stone-900">
          {contact || p.contactMissing}
        </p>
      </Section>
      <Section title={p.collectTitle}>
        <List items={[p.collectPhone, p.collectProfile, p.collectFarms, p.collectRecords, p.collectPhotos, p.collectBuyer, p.collectAi]} />
      </Section>
      <Section title={p.whyTitle}>
        <p className="text-lg text-stone-800">{p.whyText}</p>
      </Section>
      <Section title={p.seeTitle}>
        <List items={[p.seeYou, p.seeBuyer, p.seeFarmers, p.seeTeam]} />
      </Section>
      <Section title={p.servicesTitle}>
        <List items={[p.servicesSms, p.servicesAi, p.servicesWeather, p.servicesMap, p.servicesHosting]} />
      </Section>
      <Section title={p.keepTitle}>
        <p className="text-lg text-stone-800">{p.keepText}</p>
      </Section>
      <Section title={p.choicesTitle}>
        <List items={[p.choicesEdit, p.choicesAi, p.choicesDelete, p.choicesComplain]} />
      </Section>
      <Section title={p.changesTitle}>
        <p className="text-lg text-stone-800">{p.changesText}</p>
      </Section>
    </div>
  );
}
