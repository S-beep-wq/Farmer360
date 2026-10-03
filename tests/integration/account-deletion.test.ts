import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { deleteAccount, removeAllPhotos, requestAccountDeletion } from "@/features/account/repository";
import { savePhoto } from "@/features/observations/repository";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { adminClient, anonClient, deleteTestUsers, signInWithTestPhone, TEST_PHONES } from "../support/supabase";

// Account deletion with photo cleanup against the local Supabase stack. The admin client is used
// only to check from outside that everything is really gone.

type Client = SupabaseClient<Database>;

const PHONES = [TEST_PHONES.integrationA, TEST_PHONES.integrationB, TEST_PHONES.integrationNoProfile];
const PROFILE = { full_name: "Test Farmer", preferred_language: "hi", state: "Bihar", district: "Patna", village: "Bihta" };
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const JPEG_TYPE = { mime: "image/jpeg", ext: "jpg" } as const;
const BUCKET = "crop-photos";

type Owner = { client: Client; userId: string; farmerId: string; paths: string[] };
let a: Owner;
let b: Owner;

const server = (client: Client) => client as unknown as ServerSupabaseClient;

/** A farmer with a farm, plot, crop in the field and one observation with `photos` photos. */
async function setUp(phone: string, photos: number): Promise<Owner> {
  const { client, userId } = await signInWithTestPhone(phone);
  const { data: farmer } = await client.from("farmers").insert(PROFILE).select("id").single().throwOnError();
  const { data: farm } = await client.from("farms").insert({ name: "Farm" }).select("id").single().throwOnError();
  const { data: plot } = await client
    .from("plots")
    .insert({ farm_id: farm.id, name: "Plot", area: 1, area_unit: "acre" })
    .select("id")
    .single()
    .throwOnError();
  const { data: crop } = await client.from("crop_catalog").select("id").eq("name", "Maize").single().throwOnError();
  const { data: cycle } = await client
    .from("crop_cycles")
    .insert({ plot_id: plot.id, crop_id: crop.id, season: "kharif", status: "ACTIVE", actual_sowing_date: "2026-07-01" })
    .select("id")
    .single()
    .throwOnError();
  const { data: obs } = await client
    .from("crop_observations")
    .insert({ crop_cycle_id: cycle.id, observation_date: "2026-08-01", health_status: "HEALTHY" })
    .select("id")
    .single()
    .throwOnError();
  const paths: string[] = [];
  for (let i = 1; i <= photos; i++) {
    const path = `${farmer.id}/${farm.id}/${plot.id}/${cycle.id}/${obs.id}/photo-${i}.jpg`;
    const { error } = await savePhoto(server(client), obs.id, path, JPEG, JPEG_TYPE, `IMG_${i}.jpg`);
    if (error) throw error;
    paths.push(path);
  }
  return { client, userId, farmerId: farmer.id, paths };
}

/** The files left in the owner's observation folder, seen from outside (admin). */
async function filesLeft(o: Owner) {
  const folder = o.paths[0].slice(0, o.paths[0].lastIndexOf("/"));
  const { data, error } = await adminClient().storage.from(BUCKET).list(folder);
  if (error) throw error;
  return data.map((f) => `${folder}/${f.name}`).sort();
}

beforeAll(async () => {
  await deleteTestUsers(PHONES);
  a = await setUp(TEST_PHONES.integrationA, 3);
  b = await setUp(TEST_PHONES.integrationB, 1);
});

afterAll(async () => {
  await deleteTestUsers(PHONES);
});

describe("before deletion is requested", () => {
  it("photos cannot be removed and the account cannot be deleted", async () => {
    await a.client.storage.from(BUCKET).remove(a.paths);
    expect(await filesLeft(a)).toHaveLength(3);
    const { error } = await deleteAccount(server(a.client));
    expect(error?.code).toBe("23514");
  });

  it("a farmer sees only their own photo paths", async () => {
    const { data } = await a.client.rpc("account_photo_paths");
    expect(data).toEqual([...a.paths].sort());
  });
});

describe("requesting deletion", () => {
  it("is recorded by the database, cannot be backdated, and cannot be withdrawn", async () => {
    expect((await requestAccountDeletion(server(a.client), a.userId)).error).toBeNull();
    const { data: first } = await a.client.from("farmers").select("deletion_requested_at").single().throwOnError();
    expect(first.deletion_requested_at).not.toBeNull();
    expect(Date.now() - new Date(first.deletion_requested_at!).getTime()).toBeLessThan(60_000);

    await a.client.from("farmers").update({ deletion_requested_at: null }).eq("user_id", a.userId).throwOnError();
    await a.client.from("farmers").update({ deletion_requested_at: "2000-01-01T00:00:00Z" }).eq("user_id", a.userId).throwOnError();
    const { data: after } = await a.client.from("farmers").select("deletion_requested_at").single().throwOnError();
    expect(after.deletion_requested_at).toBe(first.deletion_requested_at);
  });

  it("cannot be set when creating a profile", async () => {
    const { client } = await signInWithTestPhone(TEST_PHONES.integrationNoProfile);
    const { data } = await client
      .from("farmers")
      .insert({ ...PROFILE, deletion_requested_at: new Date().toISOString() })
      .select("deletion_requested_at")
      .single()
      .throwOnError();
    expect(data.deletion_requested_at).toBeNull();
    await deleteTestUsers([TEST_PHONES.integrationNoProfile]);
  });

  it("does not let the farmer remove another farmer's photos", async () => {
    await a.client.storage.from(BUCKET).remove(b.paths);
    expect(await filesLeft(b)).toEqual(b.paths);
  });

  it("still refuses to delete the account while photos are left", async () => {
    const { error } = await deleteAccount(server(a.client));
    expect(error?.code).toBe("23514");
  });

});

describe("deleting the account", () => {
  it("removes all the farmer's photos from storage, in batches", async () => {
    expect((await removeAllPhotos(server(a.client))).error).toBeNull();
    expect(await filesLeft(a)).toEqual([]);
    // Running it again is harmless.
    expect((await removeAllPhotos(server(a.client))).error).toBeNull();
  });

  it("deletes the user and, by cascade, all their farmer data", async () => {
    expect((await deleteAccount(server(a.client))).error).toBeNull();

    const admin = adminClient();
    const { data: user } = await admin.auth.admin.getUserById(a.userId);
    expect(user.user).toBeNull();
    for (const table of ["farmers", "farms"] as const) {
      const column = table === "farmers" ? "id" : "farmer_id";
      const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq(column, a.farmerId);
      expect(count).toBe(0);
    }
    const { count: photoRows } = await admin.from("crop_photos").select("*", { count: "exact", head: true }).in("storage_path", a.paths);
    expect(photoRows).toBe(0);
  });

  it("leaves other farmers untouched", async () => {
    expect(await filesLeft(b)).toEqual(b.paths);
    const { data } = await b.client.from("farmers").select("id").single().throwOnError();
    expect(data.id).toBe(b.farmerId);
  });

  it("is allowed without a profile, and signing in again starts a new, empty account", async () => {
    const { client, userId } = await signInWithTestPhone(TEST_PHONES.integrationA);
    expect(userId).not.toBe(a.userId);
    expect((await client.from("farmers").select("id")).data).toEqual([]);
    expect((await deleteAccount(server(client))).error).toBeNull();
    expect((await adminClient().auth.admin.getUserById(userId)).data.user).toBeNull();
  });

  it("is refused when signed out", async () => {
    const { error } = await anonClient().rpc("delete_my_account");
    expect(error).not.toBeNull();
  });
});
