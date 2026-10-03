import { Page, PageTitle } from "@/components/ui/layout";
import { DeleteAccountForm } from "@/features/account/components/DeleteAccountForm";
import { getFarmerForUser } from "@/features/farmer/repository";
import { getBuyerForUser } from "@/features/market/repository";
import { requireUser } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// Uses requireUser, not requireFarmer: this page must also work after deletion was started
// (requireFarmer sends such farmers here) and for someone who never finished their profile.
export default async function DeleteAccountPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ t }, farmer, buyer] = await Promise.all([getServerMessages(), getFarmerForUser(supabase, user.id), getBuyerForUser(supabase, user.id)]);
  const unfinished = Boolean(farmer?.deletion_requested_at);
  const backHref = unfinished ? undefined : farmer ? "/profile" : buyer ? "/buyer/profile" : "/onboarding";

  return (
    <Page>
      <PageTitle backHref={backHref} backLabel={t.common.back}>
        {t.account.deleteTitle}
      </PageTitle>
      {unfinished ? (
        <p role="status" className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-lg text-amber-900">
          {t.account.deletionUnfinished}
        </p>
      ) : null}
      <p className="text-lg text-stone-800">{t.account.deleteExplain}</p>
      <ul className="list-disc pl-6 text-lg text-stone-800">
        <li>{t.account.deleteWhatProfile}</li>
        {buyer ? (
          <li>{t.account.deleteWhatDemand}</li>
        ) : (
          <>
            <li>{t.account.deleteWhatFarms}</li>
            <li>{t.account.deleteWhatRecords}</li>
            <li>{t.account.deleteWhatPhotos}</li>
          </>
        )}
      </ul>
      <p className="text-lg font-semibold text-red-800">{t.account.deleteCannotUndo}</p>
      {unfinished ? null : <p className="text-lg text-stone-700">{t.account.deleteAlternative}</p>}
      <DeleteAccountForm t={t} keepHref={backHref} />
    </Page>
  );
}
