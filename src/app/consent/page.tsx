import Link from "next/link";
import { redirect } from "next/navigation";

import { Page, PageTitle } from "@/components/ui/layout";
import { logoutAction } from "@/features/auth/actions";
import { ConsentForm } from "@/features/consent/components/ConsentForm";
import { hasAcceptedAnyNotice } from "@/features/consent/repository";
import { hasAcceptedCurrentNotice, requireUser } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function ConsentPage() {
  const user = await requireUser({ skipConsent: true });
  if (await hasAcceptedCurrentNotice(user.id)) redirect("/");
  const supabase = await createClient();
  const [{ t }, acceptedBefore] = await Promise.all([getServerMessages(), hasAcceptedAnyNotice(supabase, user.id)]);

  return (
    <Page>
      <PageTitle>{t.consent.title}</PageTitle>
      {acceptedBefore ? (
        <p role="status" className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-lg text-amber-900">
          {t.consent.updated}
        </p>
      ) : null}
      <p className="text-lg text-stone-800">{t.consent.intro}</p>
      <ul className="flex list-disc flex-col gap-2 pl-6 text-lg text-stone-800">
        <li>{t.consent.pointCollect}</li>
        <li>{t.consent.pointPrivate}</li>
        <li>{t.consent.pointServices}</li>
        <li>{t.consent.pointDelete}</li>
      </ul>
      <Link href="/privacy" className="w-fit text-lg font-semibold text-green-800 underline underline-offset-4">
        {t.consent.readFull}
      </Link>
      <ConsentForm t={t} />
      <section className="flex flex-col gap-3 border-t-2 border-stone-200 pt-4">
        <h2 className="text-xl font-bold text-stone-900">{t.consent.declineTitle}</h2>
        <p className="text-lg text-stone-700">{t.consent.declineText}</p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="min-h-14 w-full rounded-xl border-2 border-green-700 bg-white px-6 text-xl font-semibold text-green-800 hover:bg-green-50 focus:outline-none focus:ring-4 focus:ring-green-300"
          >
            {t.common.logout}
          </button>
        </form>
        <Link href="/profile/delete" className="w-fit text-lg font-semibold text-red-800 underline underline-offset-4">
          {t.account.deleteLink}
        </Link>
      </section>
    </Page>
  );
}
