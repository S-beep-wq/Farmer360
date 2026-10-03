import type { Locale } from "@/lib/i18n";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

// Read-only access to official crop insurance information (loaded by the Kisan 360 team, see
// docs/INSURANCE.md). Row Level Security shows signed-in users published products only.

export type InsuranceText = {
  locale: string;
  name: string;
  summary: string;
  eligibility: string;
  coverage: string;
  premium: string;
  important_dates: string | null;
  claim_process: string;
};

type ProductRow = {
  id: string;
  provider: string;
  state: string | null;
  districts: string[];
  seasons: string[];
  enrollment_deadline: string | null;
  official_url: string | null;
  source_name: string;
  source_url: string;
  last_verified_at: string;
  texts: InsuranceText[];
  crops: { crop_id: string }[];
};

export type InsuranceProduct = Omit<ProductRow, "texts" | "crops"> & { text: InsuranceText; cropIds: string[] };

const COLUMNS =
  "id, provider, state, districts, seasons, enrollment_deadline, official_url, source_name, source_url, last_verified_at, " +
  "texts:insurance_texts(locale, name, summary, eligibility, coverage, premium, important_dates, claim_process), crops:insurance_crops(crop_id)";

function toProduct({ texts, crops, ...row }: ProductRow, locale: Locale): InsuranceProduct | null {
  const text = texts.find((t) => t.locale === locale) ?? texts[0];
  return text ? { ...row, text, cropIds: crops.map((c) => c.crop_id) } : null;
}

/** Published products that cover this crop (place and season are checked by matchInsurance). */
export async function listInsuranceForCrop(supabase: ServerSupabaseClient, cropId: string, locale: Locale): Promise<InsuranceProduct[]> {
  const { data: covering, error: coverError } = await supabase.from("insurance_crops").select("product_id").eq("crop_id", cropId);
  if (coverError) throw coverError;
  if (covering.length === 0) return [];
  const { data, error } = await supabase
    .from("insurance_products")
    .select(COLUMNS)
    .in("id", covering.map((c) => c.product_id))
    .overrideTypes<ProductRow[], { merge: false }>();
  if (error) throw error;
  return data.map((row) => toProduct(row, locale)).filter((p): p is InsuranceProduct => p !== null);
}

export async function getInsuranceProduct(supabase: ServerSupabaseClient, productId: string, locale: Locale): Promise<InsuranceProduct | null> {
  const { data, error } = await supabase
    .from("insurance_products")
    .select(COLUMNS)
    .eq("id", productId)
    .overrideTypes<ProductRow[], { merge: false }>();
  if (error) throw error;
  return data[0] ? toProduct(data[0], locale) : null;
}
