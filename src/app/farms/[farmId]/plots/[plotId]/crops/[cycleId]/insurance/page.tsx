import Link from "next/link";

import { Page, PageTitle } from "@/components/ui/layout";
import { todayInIndia } from "@/features/crops/dates";
import { cropName, isSeason } from "@/features/crops/format";
import { loadCropPage } from "@/features/crops/page-data";
import { enrollmentText } from "@/features/insurance/format";
import { listInsuranceForCrop } from "@/features/insurance/repository";
import { matchInsurance } from "@/features/insurance/rules";
import { CautionNote } from "@/features/shared/components/OfficialInfo";
import { requireFarmer } from "@/lib/auth";
import { format } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

/** Crop insurance information for one crop (USER_WORKFLOWS.md section 11). */
export default async function CropInsurancePage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/insurance">) {
  const { cycle, cropHref, locale, t } = await loadCropPage(params);
  const farmer = await requireFarmer();
  const today = todayInIndia();
  const products = (await listInsuranceForCrop(await createClient(), cycle.crop.id, locale))
    .map((product) => ({ product, match: matchInsurance(product, farmer, { crop_id: cycle.crop.id, season: cycle.season }, today) }))
    .filter(({ match }) => match.applies)
    .sort((a, b) => Number(a.match.enrollmentClosed) - Number(b.match.enrollmentClosed) || a.product.text.name.localeCompare(b.product.text.name));
  const crop = cropName(cycle.crop, locale);
  const season = isSeason(cycle.season) ? t.seasons[cycle.season] : cycle.season;

  return (
    <Page>
      <PageTitle backHref={cropHref} backLabel={crop}>
        {t.insurance.title}
      </PageTitle>
      <p className="text-lg text-stone-700">{format(t.insurance.intro, { crop, season })}</p>
      <CautionNote>{t.insurance.notGuaranteed}</CautionNote>

      {products.length === 0 ? (
        <p className="text-lg text-stone-700">{format(t.insurance.none, { crop })}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {products.map(({ product, match }) => (
            <li key={product.id}>
              <Link
                href={`${cropHref}/insurance/${product.id}`}
                data-testid="insurance-item"
                className="flex flex-col gap-2 rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm hover:border-green-700 focus:outline-none focus:ring-4 focus:ring-green-300"
              >
                <span className="text-2xl font-semibold text-stone-900">{product.text.name}</span>
                <span className="text-lg text-stone-800">{product.text.summary}</span>
                <span className={`text-lg font-medium ${match.enrollmentClosed ? "text-stone-600" : "text-amber-800"}`}>
                  {enrollmentText(product.enrollment_deadline, match.enrollmentClosed, t, locale)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
