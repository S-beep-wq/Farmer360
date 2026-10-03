import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ringAreaSqM, toEwktPolygon, type LngLat } from "@/features/plots/location/geo";
import type { Database } from "@/types/database";

import { anonClient, deleteTestUsers, signInWithTestPhone, TEST_PHONES } from "../support/supabase";

// Runs against the local Supabase stack with the real migrations, auth and Row Level Security.

type Client = SupabaseClient<Database>;

const PHONES = [TEST_PHONES.integrationA, TEST_PHONES.integrationB, TEST_PHONES.integrationNoProfile];

const SQUARE: LngLat[] = [
  [85.0, 25.5],
  [85.001, 25.5],
  [85.001, 25.501],
  [85.0, 25.501],
];

const PROFILE = { full_name: "Test Farmer", preferred_language: "hi", state: "Bihar", district: "Patna", village: "Bihta" };

let a: Client;
let b: Client;
let noProfile: Client;
let aUserId: string;
let aFarmerId: string;
let bFarmerId: string;
let aFarmId: string;
let aPlotId: string;

beforeAll(async () => {
  await deleteTestUsers(PHONES);
  ({ client: a, userId: aUserId } = await signInWithTestPhone(TEST_PHONES.integrationA));
  ({ client: b } = await signInWithTestPhone(TEST_PHONES.integrationB));
  ({ client: noProfile } = await signInWithTestPhone(TEST_PHONES.integrationNoProfile));
});

afterAll(async () => {
  await deleteTestUsers(PHONES);
});

describe("farmer profile", () => {
  it("is created for the signed-in user, with the phone taken from the verified login", async () => {
    const { data, error } = await a
      .from("farmers")
      // A client trying to set someone else's user id and a fake phone number.
      .insert({ ...PROFILE, phone: "+10000000000" })
      .select("id, user_id, phone")
      .single();
    expect(error).toBeNull();
    expect(data!.user_id).toBe(aUserId);
    expect(data!.phone).toBe(TEST_PHONES.integrationA);
    aFarmerId = data!.id;
  });

  it("cannot be created for another user", async () => {
    const { error } = await b.from("farmers").insert({ ...PROFILE, user_id: aUserId });
    expect(error?.code).toBe("42501"); // RLS violation
  });

  it("is unique per user", async () => {
    const { error } = await a.from("farmers").insert(PROFILE);
    expect(error?.code).toBe("23505");
  });

  it("keeps user_id and phone when updated", async () => {
    const { data: bFarmer } = await b.from("farmers").insert(PROFILE).select("id").single();
    bFarmerId = bFarmer!.id;
    const { data, error } = await a
      .from("farmers")
      .update({ phone: "+10000000000", full_name: "Renamed" })
      .eq("id", aFarmerId)
      .select("user_id, phone, full_name")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ user_id: aUserId, phone: TEST_PHONES.integrationA, full_name: "Renamed" });
  });

  it("is invisible to other farmers", async () => {
    const { data } = await b.from("farmers").select("id");
    expect(data!.map((f) => f.id)).toEqual([bFarmerId]);
  });
});

describe("farms", () => {
  it("are created for the signed-in farmer by default", async () => {
    const { data, error } = await a.from("farms").insert({ name: "Ghar wala khet" }).select("id, farmer_id").single();
    expect(error).toBeNull();
    expect(data!.farmer_id).toBe(aFarmerId);
    aFarmId = data!.id;
  });

  it("cannot be created for another farmer", async () => {
    const { error } = await b.from("farms").insert({ name: "Not mine", farmer_id: aFarmerId });
    expect(error?.code).toBe("42501");
  });

  it("cannot be created before the farmer has a profile", async () => {
    const { error } = await noProfile.from("farms").insert({ name: "No profile" });
    expect(error).not.toBeNull();
  });

  it("are invisible to other farmers, even by id", async () => {
    const { data } = await b.from("farms").select("id").eq("id", aFarmId);
    expect(data).toEqual([]);
  });

  it("cannot be changed by other farmers", async () => {
    const { data } = await b.from("farms").update({ name: "Hijacked" }).eq("id", aFarmId).select("id");
    expect(data).toEqual([]);
    const { data: farm } = await a.from("farms").select("name").eq("id", aFarmId).single();
    expect(farm!.name).toBe("Ghar wala khet");
  });

  it("cannot be moved to another farmer", async () => {
    const { error } = await a.from("farms").update({ farmer_id: bFarmerId }).eq("id", aFarmId);
    expect(error?.code).toBe("42501");
  });

  it("cannot be deleted (history is preserved)", async () => {
    const { error } = await a.from("farms").delete().eq("id", aFarmId);
    expect(error?.code).toBe("42501");
  });

  it("enforce valid values", async () => {
    const { error: badArea } = await a.from("farms").insert({ name: "X", total_area: -1, area_unit: "acre" });
    expect(badArea?.code).toBe("23514");
    const { error: unitWithoutArea } = await a.from("farms").insert({ name: "X", area_unit: "acre" });
    expect(unitWithoutArea?.code).toBe("23514");
    const { error: badSoil } = await a.from("farms").insert({ name: "X", soil_type: "moon_dust" });
    expect(badSoil?.code).toBe("23514");
  });
});

describe("plots", () => {
  it("store a boundary and calculate its area and centre in the database", async () => {
    const { data, error } = await a
      .from("plots")
      .insert({
        farm_id: aFarmId,
        name: "Plot 1",
        boundary: toEwktPolygon(SQUARE),
        // A client-supplied area is ignored: the database calculates it.
        boundary_area_sq_m: 1,
      })
      .select("id, latitude, longitude, location_source, boundary_area_sq_m, boundary_geojson")
      .single();
    expect(error).toBeNull();
    aPlotId = data!.id;

    expect(data!.boundary_area_sq_m).toBeCloseTo(11137.56, 0);
    expect(Math.abs(data!.boundary_area_sq_m! - ringAreaSqM(SQUARE)) / data!.boundary_area_sq_m!).toBeLessThan(0.01);
    expect(data!.location_source).toBe("boundary_centroid");
    expect(data!.latitude).toBeCloseTo(25.5005, 4);
    expect(data!.longitude).toBeCloseTo(85.0005, 4);
    expect(data!.boundary_geojson).toMatchObject({ type: "Polygon" });
  });

  it("keep a phone location and its accuracy", async () => {
    const { data, error } = await a
      .from("plots")
      .insert({
        farm_id: aFarmId,
        name: "Plot 2",
        area: 1.5,
        area_unit: "acre",
        latitude: 25.61,
        longitude: 85.14,
        location_source: "device_gps",
        location_accuracy_m: 12,
      })
      .select("latitude, longitude, location_source, location_accuracy_m, boundary_area_sq_m")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({
      latitude: 25.61,
      longitude: 85.14,
      location_source: "device_gps",
      location_accuracy_m: 12,
      boundary_area_sq_m: null,
    });
  });

  it("need an area or a boundary", async () => {
    const { error } = await a.from("plots").insert({ farm_id: aFarmId, name: "Empty" });
    expect(error?.code).toBe("23514");
  });

  it("reject a boundary that crosses itself", async () => {
    const bowtie: LngLat[] = [SQUARE[0], SQUARE[2], SQUARE[1], SQUARE[3]];
    const { error } = await a.from("plots").insert({ farm_id: aFarmId, name: "Bowtie", boundary: toEwktPolygon(bowtie) });
    expect(error?.code).toBe("23514");
  });

  it("reject a location without its source", async () => {
    const { error } = await a.from("plots").insert({ farm_id: aFarmId, name: "X", area: 1, area_unit: "acre", latitude: 25.6, longitude: 85.1 });
    expect(error?.code).toBe("23514");
  });

  it("are invisible to other farmers", async () => {
    const { data } = await b.from("plots").select("id").eq("id", aPlotId);
    expect(data).toEqual([]);
  });

  it("cannot be added to another farmer's farm", async () => {
    const { error } = await b.from("plots").insert({ farm_id: aFarmId, name: "Intruder", area: 1, area_unit: "acre" });
    expect(error?.code).toBe("42501");
  });

  it("cannot be moved to another farmer's farm", async () => {
    const { data: bFarm } = await b.from("farms").insert({ name: "B farm" }).select("id").single();
    const { error } = await a.from("plots").update({ farm_id: bFarm!.id }).eq("id", aPlotId);
    expect(error?.code).toBe("42501");
  });
});

describe("signed-out visitors", () => {
  it("cannot read or write any farm data", async () => {
    const anon = anonClient();
    for (const table of ["farmers", "farms", "plots"] as const) {
      const { error } = await anon.from(table).select("id");
      expect(error?.code, table).toBe("42501");
    }
    const { error } = await anon.from("farms").insert({ name: "Anon" });
    expect(error?.code).toBe("42501");
  });
});
