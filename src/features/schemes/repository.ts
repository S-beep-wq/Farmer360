import type { Locale } from "@/lib/i18n";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

import type { CurrentCrop } from "./rules";

// Read-only access to official scheme information (loaded by the Kisan 360 team, see
// docs/SCHEMES.md). Row Level Security shows signed-in users published schemes only.

export type SchemeText = {
  locale: string;
  name: string;
  summary: string;
  eligibility: string;
  benefit: string;
  required_documents: string[];
  how_to_apply: string;
};

type SchemeRow = {
  id: string;
  department: string;
  state: string | null;
  districts: string[];
  seasons: string[];
  application_deadline: string | null;
  official_url: string | null;
  source_name: string;
  source_url: string;
  last_verified_at: string;
  texts: SchemeText[];
  crops: { crop_id: string }[];
};

export type Scheme = Omit<SchemeRow, "texts" | "crops"> & { text: SchemeText; cropIds: string[] };

const COLUMNS =
  "id, department, state, districts, seasons, application_deadline, official_url, source_name, source_url, last_verified_at, " +
  "texts:scheme_texts(locale, name, summary, eligibility, benefit, required_documents, how_to_apply), crops:scheme_crops(crop_id)";

/** The farmer's language, or the other one if a text is missing (the import requires both). */
function toScheme({ texts, crops, ...row }: SchemeRow, locale: Locale): Scheme | null {
  const text = texts.find((t) => t.locale === locale) ?? texts[0];
  return text ? { ...row, text, cropIds: crops.map((c) => c.crop_id) } : null;
}

export async function listSchemes(supabase: ServerSupabaseClient, locale: Locale): Promise<Scheme[]> {
  const { data, error } = await supabase.from("government_schemes").select(COLUMNS).overrideTypes<SchemeRow[], { merge: false }>();
  if (error) throw error;
  return data.map((row) => toScheme(row, locale)).filter((s): s is Scheme => s !== null);
}

export async function getScheme(supabase: ServerSupabaseClient, schemeId: string, locale: Locale): Promise<Scheme | null> {
  const { data, error } = await supabase
    .from("government_schemes")
    .select(COLUMNS)
    .eq("id", schemeId)
    .overrideTypes<SchemeRow[], { merge: false }>();
  if (error) throw error;
  return data[0] ? toScheme(data[0], locale) : null;
}

export type FarmerCrop = CurrentCrop & { crop: { name: string; name_hi: string } };

/** The farmer's crops that are planned, in the field or just harvested (not closed or cancelled). */
export async function listCurrentCrops(supabase: ServerSupabaseClient): Promise<FarmerCrop[]> {
  const { data, error } = await supabase
    .from("crop_cycles")
    .select("crop_id, season, crop:crop_catalog(name, name_hi)")
    .in("status", ["PLANNED", "ACTIVE", "HARVESTED"])
    .overrideTypes<FarmerCrop[], { merge: false }>();
  if (error) throw error;
  return data;
}
