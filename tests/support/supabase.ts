import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

// Test helpers for the LOCAL Supabase stack only. Test phone numbers and their OTP code
// are configured in supabase/config.toml ([auth.sms.test_otp]); they never send a real SMS.

export const TEST_OTP = "123456";

export const TEST_PHONES = {
  integrationA: "+919999900001",
  integrationB: "+919999900002",
  integrationNoProfile: "+919999900003",
  integrationBuyer: "+919999900014",
  integrationBuyer2: "+919999900015",
  e2e: "+919999900004",
  e2eWrongCode: "+919999900005",
  e2eEdit: "+919999900006",
  e2eCrops: "+919999900007",
  e2eRecords: "+919999900008",
  e2eHarvest: "+919999900009",
  e2eSeason: "+919999900010",
  e2eHealth: "+919999900011",
  e2eDelete: "+919999900012",
  e2eProfile: "+919999900013",
  e2eBuyer: "+919999900016",
  e2eMarket: "+919999900017",
  e2eSchemes: "+919999900018",
  e2eInsurance: "+919999900019",
  e2ePlanning: "+919999900020",
  e2eAi: "+919999900021",
  e2eAssistant: "+919999900022",
  e2eWeather: "+919999900023",
  e2eReferences: "+919999900024",
  e2eA11yFarmer: "+919999900025",
  e2eA11yBuyer: "+919999900026",
  perfFarmer: "+919999900027",
  e2eConsent: "+919999900028",
  e2eConsentDelete: "+919999900029",
} as const;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env.local (see README).`);
  return value;
}

function assertLocal(url: string) {
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Refusing to run tests against non-local Supabase at ${host}.`);
  }
}

export function supabaseUrl() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  assertLocal(url);
  return url;
}

export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(supabaseUrl(), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Admin client for test cleanup and checks only. Never used by the application. */
export function adminClient() {
  return createClient(supabaseUrl(), env("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Deletes the auth users for these test phones; their farmer data is removed by ON DELETE CASCADE. */
export async function deleteTestUsers(phones: string[]) {
  const admin = adminClient();
  const wanted = new Set(phones.map((p) => p.replace(/^\+/, "")));
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  for (const user of data.users) {
    if (user.phone && wanted.has(user.phone)) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
      if (deleteError) throw deleteError;
    }
  }
}

/** Signs in through the real phone-OTP flow and returns a client acting as that user. */
export async function signInWithTestPhone(phone: string) {
  const client = anonClient();
  const { error: otpError } = await client.auth.signInWithOtp({ phone });
  if (otpError) throw otpError;
  const { data, error } = await client.auth.verifyOtp({ phone, token: TEST_OTP, type: "sms" });
  if (error || !data.user) throw error ?? new Error("No user after verifyOtp");
  return { client, userId: data.user.id };
}
