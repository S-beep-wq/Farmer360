import { describe, expect, it } from "vitest";

import { telHref } from "@/features/market/format";
import { demandState, ilikeExact, isDemandOpen } from "@/features/market/rules";
import { buyerProfileSchema, demandSchema, interestSchema, marketFilterSchema } from "@/features/market/schema";
import { fieldErrorsFrom } from "@/lib/forms";

const TODAY = "2026-10-03";
const CROP = "3f8e2b1c-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

describe("demandState", () => {
  it("is open only while active and its date has not passed", () => {
    expect(demandState({ demand_status: "ACTIVE", required_date: TODAY }, TODAY)).toBe("OPEN");
    expect(demandState({ demand_status: "ACTIVE", required_date: "2026-10-02" }, TODAY)).toBe("DATE_PASSED");
    expect(demandState({ demand_status: "FULFILLED", required_date: "2026-12-01" }, TODAY)).toBe("FULFILLED");
    expect(demandState({ demand_status: "CANCELLED", required_date: "2026-12-01" }, TODAY)).toBe("CANCELLED");
    expect(isDemandOpen({ demand_status: "ACTIVE", required_date: "2026-12-01" }, TODAY)).toBe(true);
    expect(isDemandOpen({ demand_status: "FULFILLED", required_date: "2026-12-01" }, TODAY)).toBe(false);
  });
});

describe("ilikeExact", () => {
  it("matches the value literally (no wildcards)", () => {
    expect(ilikeExact(" Patna ")).toBe("Patna");
    expect(ilikeExact("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("telHref", () => {
  it("makes a dialable link from a stored number", () => {
    expect(telHref("+919999900016")).toBe("tel:+919999900016");
    expect(telHref("+91 99999 00016")).toBe("tel:+919999900016");
  });
});

describe("buyerProfileSchema", () => {
  const valid = { name: "Suresh", organization_name: "", buyer_type: "LOCAL_TRADER", preferred_language: "hi", state: "Bihar", district: "Patna", location: "Bihta mandi" };

  it("accepts a buyer, with the organisation optional", () => {
    expect(buyerProfileSchema.parse(valid)).toMatchObject({ name: "Suresh", organization_name: undefined });
  });

  it("refuses buyer types that are not for registered buyers", () => {
    const r = buyerProfileSchema.safeParse({ ...valid, buyer_type: "CONSUMER" });
    expect(r.success ? {} : fieldErrorsFrom(r.error)).toEqual({ buyer_type: "invalidChoice" });
  });
});

describe("demandSchema", () => {
  const schema = demandSchema(TODAY);
  const valid = {
    crop_id: CROP,
    quantity: "20",
    quantity_unit: "quintal",
    demand_type: "INDICATIVE",
    quality_requirements: "",
    required_date: "2026-11-15",
    state: "Bihar",
    district: "Patna",
    location: "Bihta",
    pickup_available: "yes",
    payment_terms: " Cash ",
  };
  const errors = (input: Record<string, string>) => {
    const r = schema.safeParse(input);
    return r.success ? {} : fieldErrorsFrom(r.error);
  };

  it("accepts a complete demand", () => {
    expect(schema.parse(valid)).toMatchObject({ quantity: 20, pickup_available: true, payment_terms: "Cash", quality_requirements: undefined });
  });

  it("needs a commitment level, a future date, a quantity and a pickup answer", () => {
    expect(errors({ ...valid, demand_type: "" })).toEqual({ demand_type: "invalidChoice" });
    expect(errors({ ...valid, required_date: "2026-10-02" })).toEqual({ required_date: "pastDate" });
    expect(errors({ ...valid, quantity: "" })).toEqual({ quantity: "required" });
    expect(errors({ ...valid, pickup_available: "" })).toEqual({ pickup_available: "invalidChoice" });
    expect(errors({ ...valid, crop_id: "wheat" })).toEqual({ crop_id: "invalidChoice" });
  });

  it("accepts today as the required date", () => {
    expect(schema.safeParse({ ...valid, required_date: TODAY }).success).toBe(true);
  });
});

describe("interestSchema", () => {
  it("requires agreeing to share contact details", () => {
    expect(interestSchema.safeParse({ share_contact: "yes", note: "" }).success).toBe(true);
    const r = interestSchema.safeParse({ note: "10 quintal ready" });
    expect(r.success ? {} : fieldErrorsFrom(r.error)).toEqual({ share_contact: "confirmShareContact" });
  });
});

describe("marketFilterSchema", () => {
  it("keeps valid filters and ignores anything else", () => {
    expect(marketFilterSchema.parse({ crop: CROP, area: "district", have: "12,5", have_unit: "quintal" })).toEqual({
      crop: CROP,
      area: "district",
      have: 12.5,
      have_unit: "quintal",
    });
    expect(marketFilterSchema.parse({ crop: "x", area: "moon", have: "-3", have_unit: "sack" })).toEqual({
      crop: undefined,
      area: undefined,
      have: undefined,
      have_unit: undefined,
    });
  });
});
