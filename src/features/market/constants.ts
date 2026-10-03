// Values must match supabase/migrations/20261003090045_slice11_buyer_discovery.sql (DATABASE.md 14, 15).

/** Kinds of buyer who can register (labels are shared with the sale form's buyer types). */
export const MARKET_BUYER_TYPES = ["LOCAL_TRADER", "MANDI", "FPO", "COMPANY", "OTHER"] as const;
export type MarketBuyerType = (typeof MARKET_BUYER_TYPES)[number];

/** CONFIRMED: the buyer commits to buy. INDICATIVE: interest only, no commitment (PRODUCT_SPEC.md 15). */
export const DEMAND_TYPES = ["CONFIRMED", "INDICATIVE"] as const;
export type DemandType = (typeof DEMAND_TYPES)[number];

/** How a buyer closes a demand. */
export const CLOSED_DEMAND_STATUSES = ["FULFILLED", "CANCELLED"] as const;
export type ClosedDemandStatus = (typeof CLOSED_DEMAND_STATUSES)[number];

/** Where to look for buyers, relative to the farmer's profile. */
export const MARKET_AREAS = ["district", "state", "anywhere"] as const;
export type MarketArea = (typeof MARKET_AREAS)[number];
