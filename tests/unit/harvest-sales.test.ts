import { describe, expect, it } from "vitest";

import { cropResult } from "@/features/harvest-sales/economics";
import { formatProduce } from "@/features/harvest-sales/format";
import { harvestFormValues, saleFormValues } from "@/features/harvest-sales/form-values";
import { fromKg, remainingToSell, soldKg, toKg } from "@/features/harvest-sales/quantities";
import type { Harvest, Sale } from "@/features/harvest-sales/repository";
import { canAddHarvest, canChangeHarvests } from "@/features/harvest-sales/rules";
import { harvestSchema, saleSchema } from "@/features/harvest-sales/schema";
import { fieldErrorsFrom } from "@/lib/forms";
import { en } from "@/lib/i18n/messages/en";

const TODAY = "2026-10-03";

function errors(result: { success: boolean; error?: Parameters<typeof fieldErrorsFrom>[0] }) {
  return result.success || !result.error ? {} : fieldErrorsFrom(result.error);
}

describe("quantities", () => {
  it("converts between kg, quintal and tonne", () => {
    expect(toKg(2.5, "quintal")).toBe(250);
    expect(toKg(1.2, "tonne")).toBe(1200);
    expect(fromKg(250, "quintal")).toBe(2.5);
    expect(fromKg(0.1 + 0.2, "kg")).toBe(0.3);
  });

  it("adds up sales in different units", () => {
    expect(soldKg([{ quantity: 2, quantity_unit: "quintal" }, { quantity: 50, quantity_unit: "kg" }])).toBe(250);
  });

  it("shows what is left in the harvest's unit, never below zero", () => {
    const harvest = { quantity: 10, quantity_unit: "quintal" };
    expect(remainingToSell(harvest, [{ quantity: 250, quantity_unit: "kg" }])).toBe(7.5);
    expect(remainingToSell(harvest, [{ quantity: 1, quantity_unit: "tonne" }])).toBe(0);
    expect(remainingToSell(harvest, [{ quantity: 2, quantity_unit: "tonne" }])).toBe(0);
  });

  it("formats produce in the farmer's language", () => {
    expect(formatProduce(12.5, "quintal", en, "en")).toBe("12.5 quintal");
  });
});

describe("harvestSchema", () => {
  const schema = harvestSchema(TODAY, "2026-07-01");

  it("accepts a harvest between sowing and today", () => {
    expect(schema.parse({ harvest_date: "2026-09-20", quantity: "12.5", quantity_unit: "quintal", quality_grade: "" })).toEqual({
      harvest_date: "2026-09-20",
      quantity: 12.5,
      quantity_unit: "quintal",
      quality_grade: undefined,
      notes: undefined,
    });
  });

  it("explains missing and wrong answers", () => {
    expect(errors(schema.safeParse({ harvest_date: "", quantity: "", quantity_unit: "" }))).toEqual({
      harvest_date: "required",
      quantity: "required",
      quantity_unit: "chooseUnit",
    });
    expect(errors(schema.safeParse({ harvest_date: "2026-06-30", quantity: "1", quantity_unit: "kg" }))).toEqual({
      harvest_date: "harvestBeforeSowing",
    });
    expect(errors(schema.safeParse({ harvest_date: "2026-10-04", quantity: "1", quantity_unit: "kg" }))).toEqual({
      harvest_date: "futureDate",
    });
  });

  it("cannot be made smaller than what was already sold", () => {
    const withSales = harvestSchema(TODAY, "2026-07-01", 500);
    expect(errors(withSales.safeParse({ harvest_date: "2026-09-20", quantity: "4", quantity_unit: "quintal" }))).toEqual({
      quantity: "harvestLessThanSold",
    });
    expect(errors(withSales.safeParse({ harvest_date: "2026-09-20", quantity: "5", quantity_unit: "quintal" }))).toEqual({});
  });
});

describe("saleSchema", () => {
  const schema = saleSchema(TODAY, "2026-09-20", 1000);
  const base = {
    buyer_type: "MANDI",
    buyer_name: "",
    sale_date: "2026-09-25",
    quantity: "8",
    quantity_unit: "quintal",
    price_per_unit: "2,300",
    transport_cost: "",
    other_cost: "",
    payment_status: "PAID",
    notes: "",
  };

  it("accepts a sale and reads rupees with commas", () => {
    expect(schema.parse({ ...base, transport_cost: "400" })).toMatchObject({
      buyer_type: "MANDI",
      quantity: 8,
      price_per_unit: 2300,
      transport_cost: 400,
      other_cost: undefined,
      payment_status: "PAID",
    });
  });

  it("cannot sell more than is left from the harvest", () => {
    expect(errors(schema.safeParse({ ...base, quantity: "10.01" }))).toEqual({ quantity: "moreThanHarvested" });
    expect(errors(schema.safeParse({ ...base, quantity: "1", quantity_unit: "tonne" }))).toEqual({});
  });

  it("cannot be before the harvest or in the future", () => {
    expect(errors(schema.safeParse({ ...base, sale_date: "2026-09-19" }))).toEqual({ sale_date: "saleBeforeHarvest" });
    expect(errors(schema.safeParse({ ...base, sale_date: "2026-10-04" }))).toEqual({ sale_date: "futureDate" });
  });

  it("needs a buyer type, price and payment status", () => {
    expect(errors(schema.safeParse({ ...base, buyer_type: "", price_per_unit: "", payment_status: "" }))).toEqual({
      buyer_type: "invalidChoice",
      price_per_unit: "required",
      payment_status: "invalidChoice",
    });
  });
});

describe("cropResult", () => {
  const sale = { gross_amount: 18400, transport_cost: 400, other_cost: 200, payment_status: "PAID" };

  it("is revenue minus production and selling costs", () => {
    expect(cropResult(9000, [sale])).toEqual({
      revenue: 18400,
      productionCosts: 9000,
      sellingCosts: 600,
      net: 8800,
      paymentPending: false,
    });
  });

  it("shows a loss as a negative result and notes unpaid sales", () => {
    const result = cropResult(20000, [{ ...sale, payment_status: "PARTIAL" }]);
    expect(result.net).toBe(-2200);
    expect(result.paymentPending).toBe(true);
  });

  it("is exact with paise", () => {
    expect(cropResult(0.1, [{ gross_amount: 0.3, transport_cost: 0.1, other_cost: 0, payment_status: "PAID" }]).net).toBe(0.1);
  });
});

describe("rules and form values", () => {
  it("allows harvests only once the crop is sown, and changes until the season is completed", () => {
    expect(["ACTIVE", "HARVESTED"].every(canAddHarvest)).toBe(true);
    expect(["PLANNED", "CANCELLED", "COMPLETED"].some(canAddHarvest)).toBe(false);
    expect(canChangeHarvests("CANCELLED")).toBe(true);
    expect(canChangeHarvests("COMPLETED")).toBe(false);
  });

  it("prefills the edit forms", () => {
    const harvest: Harvest = {
      id: "h",
      crop_cycle_id: "c",
      harvest_date: "2026-09-20",
      quantity: 12.5,
      quantity_unit: "quintal",
      quality_grade: null,
      notes: null,
      created_at: "",
    };
    expect(harvestFormValues(harvest)).toEqual({
      harvest_date: "2026-09-20",
      quantity: "12.5",
      quantity_unit: "quintal",
      quality_grade: "",
      notes: "",
    });
    const sale: Sale = {
      id: "s",
      harvest_id: "h",
      buyer_type: "MANDI",
      buyer_name: null,
      sale_date: "2026-09-25",
      quantity: 8,
      quantity_unit: "quintal",
      price_per_unit: 2300,
      transport_cost: 0,
      other_cost: 150,
      gross_amount: 18400,
      net_amount: 18250,
      payment_status: "PAID",
      notes: null,
      created_at: "",
    };
    expect(saleFormValues(sale)).toMatchObject({ price_per_unit: "2300", transport_cost: "", other_cost: "150", buyer_name: "" });
  });
});
