import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { NOTICE_VERSION } from "@/features/consent/constants";
import { hasAcceptedAnyNotice, hasAcceptedNotice, recordConsent } from "@/features/consent/repository";
import { isAlreadyAccepted } from "@/features/consent/rules";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { adminClient, anonClient, deleteTestUsers, signInWithTestPhone, TEST_PHONES } from "../support/supabase";

// Data-use consent records against the local Supabase stack (DATABASE.md section 21a).

type Client = SupabaseClient<Database>;

const PHONES = [TEST_PHONES.integrationA, TEST_PHONES.integrationB];
const server = (client: Client) => client as unknown as ServerSupabaseClient;

let a: { client: Client; userId: string };
let b: { client: Client; userId: string };

beforeAll(async () => {
  await deleteTestUsers(PHONES);
  a = await signInWithTestPhone(TEST_PHONES.integrationA);
  b = await signInWithTestPhone(TEST_PHONES.integrationB);
});

afterAll(async () => {
  await deleteTestUsers(PHONES);
});

describe("user_consents", () => {
  it("records acceptance of a notice version for the signed-in user, with the time set by the database", async () => {
    expect(await hasAcceptedNotice(server(a.client), a.userId, NOTICE_VERSION)).toBe(false);
    expect(await hasAcceptedAnyNotice(server(a.client), a.userId)).toBe(false);

    const before = Date.now();
    const { error } = await recordConsent(server(a.client), NOTICE_VERSION, "hi");
    expect(error).toBeNull();

    expect(await hasAcceptedNotice(server(a.client), a.userId, NOTICE_VERSION)).toBe(true);
    expect(await hasAcceptedNotice(server(a.client), a.userId, "2099-01-01")).toBe(false);
    expect(await hasAcceptedAnyNotice(server(a.client), a.userId)).toBe(true);
    const { data } = await a.client.from("user_consents").select("user_id, notice_version, locale, accepted_at").single().throwOnError();
    expect(data).toMatchObject({ user_id: a.userId, notice_version: NOTICE_VERSION, locale: "hi" });
    expect(Math.abs(new Date(data.accepted_at).getTime() - before)).toBeLessThan(60_000);
  });

  it("treats accepting the same version again as already done", async () => {
    const { error } = await recordConsent(server(a.client), NOTICE_VERSION, "en");
    expect(error?.code).toBe("23505");
    expect(isAlreadyAccepted(error)).toBe(true);
  });

  it("does not let the user choose who accepted or when", async () => {
    const forgedTime = await a.client.from("user_consents").insert({ notice_version: "old-1", locale: "en", accepted_at: "2020-01-01T00:00:00Z" });
    expect(forgedTime.error?.code).toBe("42501");
    const forUser = await a.client.from("user_consents").insert({ notice_version: "old-2", locale: "en", user_id: b.userId });
    expect(forUser.error?.code).toBe("42501");
    expect(await hasAcceptedNotice(server(b.client), b.userId, "old-2")).toBe(false);
  });

  it("does not let the user change or remove a recorded acceptance", async () => {
    const update = await a.client.from("user_consents").update({ notice_version: "2099-01-01" }).eq("user_id", a.userId);
    expect(update.error?.code).toBe("42501");
    const remove = await a.client.from("user_consents").delete().eq("user_id", a.userId);
    expect(remove.error?.code).toBe("42501");
    expect(await hasAcceptedNotice(server(a.client), a.userId, NOTICE_VERSION)).toBe(true);
  });

  it("rejects an unknown language or a malformed version", async () => {
    expect((await recordConsent(server(a.client), "2026-11-01", "fr" as "hi")).error?.code).toBe("23514");
    expect((await recordConsent(server(a.client), "", "en")).error?.code).toBe("23514");
    expect((await recordConsent(server(a.client), "v 1; drop", "en")).error?.code).toBe("23514");
  });

  it("keeps each person's consent private", async () => {
    expect(await hasAcceptedNotice(server(b.client), a.userId, NOTICE_VERSION)).toBe(false);
    const { data } = await b.client.from("user_consents").select("id").throwOnError();
    expect(data).toEqual([]);
    const anon = await anonClient().from("user_consents").select("id");
    expect(anon.error?.code).toBe("42501");
  });

  it("is removed with the account", async () => {
    const admin = adminClient();
    const { error } = await admin.auth.admin.deleteUser(a.userId);
    expect(error).toBeNull();
    const { count } = await admin.from("user_consents").select("id", { count: "exact", head: true }).eq("user_id", a.userId);
    expect(count).toBe(0);
  });
});
