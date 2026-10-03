import { toKg } from "@/features/harvest-sales/quantities";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

import type { ClosedDemandStatus } from "./constants";
import { ilikeExact } from "./rules";
import type { BuyerProfileInput, DemandInput, MarketFilters } from "./schema";

// Data access for buyers, their demand and farmers' interest. Row Level Security decides who
// sees what: buyers see their own demand; farmers see open demand and the buyers behind it.

const BUYER_COLUMNS = "id, name, organization_name, phone, buyer_type, preferred_language, state, district, location, verification_status";

const DEMAND_COLUMNS =
  "id, crop_id, quantity, quantity_unit, demand_type, quality_requirements, required_date, state, district, location, " +
  "pickup_available, payment_terms, demand_status, closed_at, created_at, crop:crop_catalog(id, name, name_hi)";

export type Buyer = {
  id: string;
  name: string;
  organization_name: string | null;
  phone: string | null;
  buyer_type: string;
  preferred_language: string;
  state: string;
  district: string;
  location: string;
  verification_status: string;
};

export type Demand = {
  id: string;
  crop_id: string;
  quantity: number;
  quantity_unit: string;
  demand_type: string;
  quality_requirements: string | null;
  required_date: string;
  state: string;
  district: string;
  location: string;
  pickup_available: boolean;
  payment_terms: string | null;
  demand_status: string;
  closed_at: string | null;
  created_at: string;
  crop: { id: string; name: string; name_hi: string };
};

// ---------------------------------------------------------------------------
// Buyers
// ---------------------------------------------------------------------------

export async function getBuyerForUser(supabase: ServerSupabaseClient, userId: string): Promise<Buyer | null> {
  const { data, error } = await supabase.from("buyers").select(BUYER_COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertBuyer(supabase: ServerSupabaseClient, input: BuyerProfileInput) {
  const { error } = await supabase.from("buyers").insert({ ...input, organization_name: input.organization_name ?? null });
  return { error };
}

export async function updateBuyer(supabase: ServerSupabaseClient, userId: string, input: BuyerProfileInput) {
  const { error } = await supabase
    .from("buyers")
    .update({ ...input, organization_name: input.organization_name ?? null })
    .eq("user_id", userId);
  return { error };
}

export async function updateBuyerLanguage(supabase: ServerSupabaseClient, userId: string, locale: string) {
  const { error } = await supabase.from("buyers").update({ preferred_language: locale }).eq("user_id", userId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// A buyer's own demand
// ---------------------------------------------------------------------------

export type OwnDemand = Demand & { interestCount: number };

export async function listOwnDemands(supabase: ServerSupabaseClient, buyerId: string): Promise<OwnDemand[]> {
  const { data, error } = await supabase
    .from("buyer_demands")
    .select(`${DEMAND_COLUMNS}, interests:demand_interests(count)`)
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false })
    .overrideTypes<(Demand & { interests: { count: number }[] })[], { merge: false }>();
  if (error) throw error;
  return data.map(({ interests, ...d }) => ({ ...d, interestCount: interests[0]?.count ?? 0 }));
}

export async function getOwnDemand(supabase: ServerSupabaseClient, buyerId: string, demandId: string): Promise<Demand | null> {
  const { data, error } = await supabase
    .from("buyer_demands")
    .select(DEMAND_COLUMNS)
    .eq("buyer_id", buyerId)
    .eq("id", demandId)
    .overrideTypes<Demand[], { merge: false }>();
  if (error) throw error;
  return data[0] ?? null;
}

export async function insertDemand(supabase: ServerSupabaseClient, input: DemandInput) {
  const { data, error } = await supabase
    .from("buyer_demands")
    .insert({
      ...input,
      quality_requirements: input.quality_requirements ?? null,
      payment_terms: input.payment_terms ?? null,
    })
    .select("id")
    .single();
  return { id: data?.id, error };
}

/** Closes an open demand. Returns false when it was not open any more (changed meanwhile). */
export async function closeDemand(supabase: ServerSupabaseClient, buyerId: string, demandId: string, status: ClosedDemandStatus) {
  const { data, error } = await supabase
    .from("buyer_demands")
    .update({ demand_status: status })
    .eq("buyer_id", buyerId)
    .eq("id", demandId)
    .eq("demand_status", "ACTIVE")
    .select("id");
  return { closed: (data ?? []).length === 1, error };
}

export type InterestedFarmer = {
  interest_id: string;
  created_at: string;
  note: string | null;
  full_name: string;
  village: string;
  district: string;
  phone: string | null;
};

/** The farmers interested in the buyer's demand, with the contact details they agreed to share. */
export async function listInterestedFarmers(supabase: ServerSupabaseClient, demandId: string): Promise<InterestedFarmer[]> {
  const { data, error } = await supabase.rpc("demand_interested_farmers", { p_demand_id: demandId });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// The market, for farmers
// ---------------------------------------------------------------------------

export type MarketDemand = Demand & { buyer: Pick<Buyer, "id" | "name" | "organization_name" | "buyer_type" | "district" | "location" | "verification_status"> };

const MARKET_COLUMNS = `${DEMAND_COLUMNS}, buyer:buyers(id, name, organization_name, buyer_type, district, location, verification_status)`;

/** Open demand (published and its date not passed), soonest first. */
export async function listOpenDemands(
  supabase: ServerSupabaseClient,
  today: string,
  filters: MarketFilters,
  farmer: { state: string; district: string },
): Promise<MarketDemand[]> {
  let query = supabase.from("buyer_demands").select(MARKET_COLUMNS).eq("demand_status", "ACTIVE").gte("required_date", today);
  if (filters.crop) query = query.eq("crop_id", filters.crop);
  if (filters.area === "district") query = query.ilike("district", ilikeExact(farmer.district)).ilike("state", ilikeExact(farmer.state));
  if (filters.area === "state") query = query.ilike("state", ilikeExact(farmer.state));
  if (filters.have !== undefined && filters.have_unit) query = query.lte("quantity_kg", toKg(filters.have, filters.have_unit));
  const { data, error } = await query
    .order("required_date")
    .order("created_at")
    .overrideTypes<MarketDemand[], { merge: false }>();
  if (error) throw error;
  return data;
}

export type DemandForFarmer = MarketDemand & { buyer: MarketDemand["buyer"] & { phone: string | null } };

export async function getDemandForFarmer(supabase: ServerSupabaseClient, demandId: string): Promise<DemandForFarmer | null> {
  const { data, error } = await supabase
    .from("buyer_demands")
    .select(`${DEMAND_COLUMNS}, buyer:buyers(id, name, organization_name, buyer_type, district, location, verification_status, phone)`)
    .eq("id", demandId)
    .overrideTypes<DemandForFarmer[], { merge: false }>();
  if (error) throw error;
  return data[0] ?? null;
}

export type Interest = { id: string; demand_id: string; note: string | null; created_at: string };

export async function getOwnInterest(supabase: ServerSupabaseClient, farmerId: string, demandId: string): Promise<Interest | null> {
  const { data, error } = await supabase
    .from("demand_interests")
    .select("id, demand_id, note, created_at")
    .eq("farmer_id", farmerId)
    .eq("demand_id", demandId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertInterest(supabase: ServerSupabaseClient, demandId: string, note: string | undefined) {
  const { error } = await supabase.from("demand_interests").insert({ demand_id: demandId, note: note ?? null });
  return { error };
}

export type OwnInterest = Interest & { demand: MarketDemand };

/** Demand the farmer said they are interested in, newest first (including closed demand). */
export async function listOwnInterests(supabase: ServerSupabaseClient, farmerId: string): Promise<OwnInterest[]> {
  const { data, error } = await supabase
    .from("demand_interests")
    .select(`id, demand_id, note, created_at, demand:buyer_demands(${MARKET_COLUMNS})`)
    .eq("farmer_id", farmerId)
    .order("created_at", { ascending: false })
    .overrideTypes<OwnInterest[], { merge: false }>();
  if (error) throw error;
  return data;
}
