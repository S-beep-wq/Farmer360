import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listObservations, photoLinks, savePhoto } from "@/features/observations/repository";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { anonClient, deleteTestUsers, signInWithTestPhone, supabaseUrl, TEST_PHONES } from "../support/supabase";

// Crop observations and photo storage against the local Supabase stack (migrations, storage
// policies, auth and RLS).

type Client = SupabaseClient<Database>;

const PHONES = [TEST_PHONES.integrationA, TEST_PHONES.integrationB];
const PROFILE = { full_name: "Test Farmer", preferred_language: "hi", state: "Bihar", district: "Patna", village: "Bihta" };
// A tiny but real JPEG header; the storage service only checks the declared type and size.
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const JPEG_TYPE = { mime: "image/jpeg", ext: "jpg" } as const;

type Owner = { client: Client; farmerId: string; farmId: string; plotId: string; activeId: string; plannedId: string };
let a: Owner;
let b: Owner;
let aObservationId: string;
let aPhotoPath: string;

const server = (client: Client) => client as unknown as ServerSupabaseClient;

async function setUp(phone: string): Promise<Owner> {
  const { client } = await signInWithTestPhone(phone);
  const { data: farmer } = await client.from("farmers").insert(PROFILE).select("id").single().throwOnError();
  const { data: farm } = await client.from("farms").insert({ name: "Farm" }).select("id").single().throwOnError();
  const { data: plot } = await client
    .from("plots")
    .insert({ farm_id: farm.id, name: "Plot", area: 1, area_unit: "acre" })
    .select("id")
    .single()
    .throwOnError();
  const { data: crop } = await client.from("crop_catalog").select("id").eq("name", "Maize").single().throwOnError();
  const cycle = async (fields: Partial<Database["public"]["Tables"]["crop_cycles"]["Insert"]>) =>
    (await client.from("crop_cycles").insert({ plot_id: plot.id, crop_id: crop.id, season: "rabi", ...fields }).select("id").single().throwOnError()).data.id;
  return {
    client,
    farmerId: farmer.id,
    farmId: farm.id,
    plotId: plot.id,
    activeId: await cycle({ status: "ACTIVE", actual_sowing_date: "2026-07-01" }),
    plannedId: await cycle({ planned_sowing_date: "2026-11-15" }),
  };
}

function folder(o: Owner, cycleId: string, observationId: string) {
  return `${o.farmerId}/${o.farmId}/${o.plotId}/${cycleId}/${observationId}`;
}

beforeAll(async () => {
  await deleteTestUsers(PHONES);
  a = await setUp(TEST_PHONES.integrationA);
  b = await setUp(TEST_PHONES.integrationB);
});

afterAll(async () => {
  await deleteTestUsers(PHONES);
});

describe("observations", () => {
  it("are recorded for a crop in the field", async () => {
    const { data, error } = await a.client
      .from("crop_observations")
      .insert({ crop_cycle_id: a.activeId, observation_date: "2026-08-01", health_status: "PROBLEM", farmer_notes: "Yellow leaves" })
      .select("id, created_by, ai_analysis")
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ created_by: "FARMER", ai_analysis: null });
    aObservationId = data!.id;
  });

  it("are refused for a crop not in the field, before sowing, or with an unknown status", async () => {
    const planned = await a.client.from("crop_observations").insert({ crop_cycle_id: a.plannedId, observation_date: "2026-11-20", health_status: "HEALTHY" });
    expect(planned.error?.code).toBe("23514");
    const early = await a.client.from("crop_observations").insert({ crop_cycle_id: a.activeId, observation_date: "2026-06-30", health_status: "HEALTHY" });
    expect(early.error?.code).toBe("23514");
    const status = await a.client.from("crop_observations").insert({ crop_cycle_id: a.activeId, observation_date: "2026-08-01", health_status: "GREAT" });
    expect(status.error?.code).toBe("23514");
  });

  it("cannot carry AI output or be rewritten by the farmer; only removal is allowed", async () => {
    const forgedAi = await a.client
      .from("crop_observations")
      .insert({ crop_cycle_id: a.activeId, observation_date: "2026-08-01", health_status: "HEALTHY", ai_analysis: { disease: "none" }, ai_confidence: 0.99 } as never);
    expect(forgedAi.error?.code).toBe("42501");
    const forgedCreator = await a.client
      .from("crop_observations")
      .insert({ crop_cycle_id: a.activeId, observation_date: "2026-08-01", health_status: "HEALTHY", created_by: "SYSTEM" } as never);
    expect(forgedCreator.error?.code).toBe("42501");
    const rewrite = await a.client.from("crop_observations").update({ farmer_notes: "changed" }).eq("id", aObservationId);
    expect(rewrite.error?.code).toBe("42501");
    expect((await a.client.from("crop_observations").delete().eq("id", aObservationId)).error?.code).toBe("42501");
  });

  it("are private to the farmer", async () => {
    expect((await b.client.from("crop_observations").select("id").eq("id", aObservationId)).data).toEqual([]);
    const intrusion = await b.client.from("crop_observations").insert({ crop_cycle_id: a.activeId, observation_date: "2026-08-01", health_status: "HEALTHY" });
    expect(intrusion.error?.code).toBe("42501");
  });
});

describe("photos", () => {
  it("are uploaded into the observation's own folder and recorded", async () => {
    aPhotoPath = `${folder(a, a.activeId, aObservationId)}/photo-1.jpg`;
    const { error } = await savePhoto(server(a.client), aObservationId, aPhotoPath, JPEG, JPEG_TYPE, "IMG_1.jpg");
    expect(error).toBeNull();
    const [observation] = await listObservations(server(a.client), a.activeId);
    expect(observation.photos.map((p) => p.storage_path)).toEqual([aPhotoPath]);
  });

  it("can be shown to their owner through a signed link", async () => {
    const links = await photoLinks(server(a.client), [aPhotoPath]);
    const response = await fetch(links.get(aPhotoPath)!);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG);
  });

  it("cannot be read by another farmer or anyone signed out, and the bucket is not public", async () => {
    const other = await b.client.storage.from("crop-photos").createSignedUrl(aPhotoPath, 60);
    expect(other.data).toBeNull();
    const signedOut = await anonClient().storage.from("crop-photos").download(aPhotoPath);
    expect(signedOut.data).toBeNull();
    const publicUrl = `${supabaseUrl()}/storage/v1/object/public/crop-photos/${aPhotoPath}`;
    expect((await fetch(publicUrl)).status).not.toBe(200);
    expect((await b.client.from("crop_photos").select("id").eq("observation_id", aObservationId)).data).toEqual([]);
  });

  it("cannot be uploaded into another farmer's folders or a made-up path", async () => {
    const { data: bObs } = await b.client
      .from("crop_observations")
      .insert({ crop_cycle_id: b.activeId, observation_date: "2026-08-01", health_status: "HEALTHY" })
      .select("id")
      .single()
      .throwOnError();
    const bucket = a.client.storage.from("crop-photos");
    const intoOthers = await bucket.upload(`${folder(b, b.activeId, bObs.id)}/x.jpg`, JPEG, { contentType: "image/jpeg" });
    expect(intoOthers.error).not.toBeNull();
    // A's own farmer id with B's farm, plot, crop and observation.
    const mixed = await bucket.upload(`${a.farmerId}/${b.farmId}/${b.plotId}/${b.activeId}/${bObs.id}/x.jpg`, JPEG, { contentType: "image/jpeg" });
    expect(mixed.error).not.toBeNull();
    const madeUp = await bucket.upload(`${a.farmerId}/anything.jpg`, JPEG, { contentType: "image/jpeg" });
    expect(madeUp.error).not.toBeNull();
  });

  it("must be images within the size limit", async () => {
    const bucket = a.client.storage.from("crop-photos");
    const svg = await bucket.upload(`${folder(a, a.activeId, aObservationId)}/x.svg`, new TextEncoder().encode("<svg/>"), {
      contentType: "image/svg+xml",
    });
    expect(svg.error).not.toBeNull();
  });

  it("are kept: they cannot be replaced or deleted", async () => {
    const bucket = a.client.storage.from("crop-photos");
    const replace = await bucket.upload(aPhotoPath, JPEG, { contentType: "image/jpeg", upsert: true });
    expect(replace.error).not.toBeNull();
    await bucket.remove([aPhotoPath]);
    const still = await photoLinks(server(a.client), [aPhotoPath]);
    expect(still.get(aPhotoPath)).toBeTruthy();
  });

  it("must be recorded against the observation whose folder they are in", async () => {
    const { data: second } = await a.client
      .from("crop_observations")
      .insert({ crop_cycle_id: a.activeId, observation_date: "2026-08-08", health_status: "HEALTHY" })
      .select("id")
      .single()
      .throwOnError();
    const mismatch = await a.client.from("crop_photos").insert({
      observation_id: second.id,
      storage_path: aPhotoPath.replace("photo-1", "photo-2"),
      file_name: "x.jpg",
      mime_type: "image/jpeg",
      file_size: 10,
    });
    expect(mismatch.error?.code).toBe("23514");
  });

  it("are listed in time order, and a removed observation disappears", async () => {
    const before = await listObservations(server(a.client), a.activeId);
    expect(before.map((o) => o.observation_date)).toEqual(["2026-08-01", "2026-08-08"]);
    await a.client.from("crop_observations").update({ deleted_at: new Date().toISOString() }).eq("id", before[1].id).throwOnError();
    expect((await listObservations(server(a.client), a.activeId)).map((o) => o.id)).toEqual([aObservationId]);
  });
});
