import { Page } from "@/components/ui/layout";
import { getServerMessages } from "@/lib/i18n/server";

/** Shown while the next screen loads, so farmers on slow networks know their tap worked. */
export default async function Loading() {
  const { t } = await getServerMessages();
  return (
    <Page>
      <p role="status" aria-live="polite" className="flex items-center gap-3 text-xl text-stone-700">
        <span aria-hidden="true" className="inline-block size-6 animate-spin rounded-full border-4 border-green-700 border-t-transparent" />
        {t.common.loading}
      </p>
    </Page>
  );
}
