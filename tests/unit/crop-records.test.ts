import { describe, expect, it } from "vitest";

import { activityFormValues, expenseFormValues } from "@/features/crop-records/form-values";
import { spentSoFar, type Activity, type Expense } from "@/features/crop-records/repository";
import { canRecord } from "@/features/crop-records/rules";
import { activitySchema, expenseSchema } from "@/features/crop-records/schema";
import { formatRupees, parseRupees, sumRupees } from "@/features/shared/money";
import { fieldErrorsFrom } from "@/lib/forms";

const TODAY = "2026-10-03";

function errors(result: { success: boolean; error?: Parameters<typeof fieldErrorsFrom>[0] }) {
  return result.success || !result.error ? {} : fieldErrorsFrom(result.error);
}

describe("rupees", () => {
  it.each([
    ["2500", 2500],
    ["2,500", 2500],
    ["1,25,000", 125000],
    ["₹ 2,500.50", 2500.5],
    ["Rs. 300", 300],
    ["0.5", 0.5],
  ])("reads %s as %s", (input, expected) => {
    expect(parseRupees(input)).toBe(expected);
  });

  it.each(["", "abc", "2500.555", "-100", "1.2.3", "२५००"])("rejects %s", (input) => {
    expect(parseRupees(input)).toBeNull();
  });

  it("formats with Indian digit grouping", () => {
    expect(formatRupees(125000, "en")).toBe("₹1,25,000");
    expect(formatRupees(2500.5, "en")).toBe("₹2,500.50");
    expect(formatRupees(2500, "hi")).toContain("2,500");
  });

  it("adds amounts exactly", () => {
    expect(sumRupees([0.1, 0.2])).toBe(0.3);
    expect(sumRupees([1999.99, 0.01, null, undefined])).toBe(2000);
  });
});

describe("activitySchema", () => {
  const schema = activitySchema(TODAY);

  it("needs only the type and a date", () => {
    const result = schema.parse({ activity_type: "WEEDING", activity_date: TODAY, quantity: "", quantity_unit: "", cost: "", notes: "" });
    expect(result).toMatchObject({ activity_type: "WEEDING", activity_date: TODAY });
    expect([result.quantity, result.quantity_unit, result.cost, result.notes]).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("reads quantity, unit and a cost with commas", () => {
    const result = schema.parse({ activity_type: "LABOUR", activity_date: "2026-09-30", quantity: "3", quantity_unit: "day", cost: "1,200" });
    expect(result).toMatchObject({ quantity: 3, quantity_unit: "day", cost: 1200 });
  });

  it("needs a unit for a quantity, and drops a unit without a quantity", () => {
    expect(errors(schema.safeParse({ activity_type: "FERTILIZATION", activity_date: TODAY, quantity: "2" }))).toEqual({ quantity: "chooseUnit" });
    expect(schema.parse({ activity_type: "FERTILIZATION", activity_date: TODAY, quantity: "", quantity_unit: "bag" }).quantity_unit).toBeUndefined();
  });

  it("rejects future dates, wrong amounts and unknown types", () => {
    expect(errors(schema.safeParse({ activity_type: "WEEDING", activity_date: "2026-10-04" }))).toEqual({ activity_date: "futureDate" });
    expect(errors(schema.safeParse({ activity_type: "WEEDING", activity_date: TODAY, cost: "lots" }))).toEqual({ cost: "invalidAmount" });
    expect(errors(schema.safeParse({ activity_type: "WEEDING", activity_date: TODAY, cost: "0" }))).toEqual({ cost: "positiveNumber" });
    expect(errors(schema.safeParse({ activity_type: "DANCING", activity_date: "" }))).toEqual({
      activity_type: "invalidChoice",
      activity_date: "required",
    });
  });
});

describe("expenseSchema", () => {
  const schema = expenseSchema(TODAY);

  it("needs a category, an amount and a date", () => {
    expect(errors(schema.safeParse({ category: "", amount: "", expense_date: "" }))).toEqual({
      category: "invalidChoice",
      amount: "required",
      expense_date: "required",
    });
  });

  it("accepts a full expense", () => {
    expect(
      schema.parse({
        category: "FERTILIZER",
        amount: "1,350",
        expense_date: "2026-09-28",
        quantity: "2",
        quantity_unit: "bag",
        vendor: " Krishi Kendra ",
        notes: "DAP",
      }),
    ).toEqual({
      category: "FERTILIZER",
      amount: 1350,
      expense_date: "2026-09-28",
      quantity: 2,
      quantity_unit: "bag",
      vendor: "Krishi Kendra",
      notes: "DAP",
    });
  });
});

describe("canRecord", () => {
  it("allows recording until the season is completed", () => {
    expect(["PLANNED", "ACTIVE", "HARVESTED", "CANCELLED"].every(canRecord)).toBe(true);
    expect(canRecord("COMPLETED")).toBe(false);
  });
});

describe("spentSoFar and form values", () => {
  const activity: Activity = {
    id: "a",
    crop_cycle_id: "c",
    activity_type: "LABOUR",
    activity_date: "2026-09-30",
    quantity: 3,
    quantity_unit: "day",
    cost: 1200.5,
    notes: null,
    created_at: "",
  };
  const expense: Expense = {
    id: "e",
    crop_cycle_id: "c",
    category: "SEED",
    amount: 800,
    expense_date: "2026-09-20",
    quantity: null,
    quantity_unit: null,
    vendor: null,
    notes: null,
    created_at: "",
  };

  it("adds work costs and expenses", () => {
    expect(spentSoFar([activity, { ...activity, cost: null }], [expense, expense])).toEqual({
      workCosts: 1200.5,
      expenseTotal: 1600,
      total: 2800.5,
    });
    expect(spentSoFar([], [])).toEqual({ workCosts: 0, expenseTotal: 0, total: 0 });
  });

  it("prefills the edit forms", () => {
    expect(activityFormValues(activity)).toEqual({
      activity_type: "LABOUR",
      activity_date: "2026-09-30",
      quantity: "3",
      quantity_unit: "day",
      cost: "1200.5",
      notes: "",
    });
    expect(expenseFormValues(expense)).toMatchObject({ category: "SEED", amount: "800", quantity: "", vendor: "" });
  });
});
