import { describe, expect, it } from "vitest";

import { displayPhone, isOtpCode, normalizeIndianMobile } from "@/features/auth/phone";

describe("normalizeIndianMobile", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["98765-43210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["6000000000", "+916000000000"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each([
    ["", "empty"],
    ["12345", "too short"],
    ["5876543210", "not a mobile prefix"],
    ["98765432101", "too long"],
    ["+1 4155550100", "another country"],
    ["98765abcde", "letters"],
  ])("rejects %s (%s)", (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
  });
});

describe("displayPhone", () => {
  it("groups an Indian number for reading", () => {
    expect(displayPhone("+919876543210")).toBe("+91 98765 43210");
  });

  it("leaves other formats untouched", () => {
    expect(displayPhone("+14155550100")).toBe("+14155550100");
  });
});

describe("isOtpCode", () => {
  it("accepts exactly six digits", () => {
    expect(isOtpCode("123456")).toBe(true);
    expect(isOtpCode("12345")).toBe(false);
    expect(isOtpCode("1234567")).toBe(false);
    expect(isOtpCode("12345a")).toBe(false);
  });
});
