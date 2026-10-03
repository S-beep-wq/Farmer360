import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

// Test helpers for the LOCAL Supabase stack only. Test phone numbers and their OTP code
// are configured in supabase/config.toml ([auth.sms.test_otp]); they never send a real SMS.

export const TEST_OTP = "123456";

export const TEST_PHONES = {
  integrationA: "+919999900001",
  integrationB: "+919999900002",
  integrationNoProfile: "+919999900003",
  e2e: "+919999900004",
  e2eWrongCode: "+919999900005",
  e2eEdit: "+919999900006",
  e2eCrops: "+919999900007",
  e2eRecords: "+919999900008",
  e2eHarvest: "+919999900009",
  e2eSeason: "+919999900010",
  e2eHealth: "+919999900011",
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

/** Admin client for test cleanup only. Never used by the application. */
function adminClient() {
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
