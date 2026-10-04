import { describe, expect, it } from "vitest";

import { NOTICE_VERSION } from "@/features/consent/constants";
import { isAlreadyAccepted, isNoticeAgreed } from "@/features/consent/rules";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(entries)) data.set(k, v);
  return data;
}

describe("consent rules", () => {
  it("counts only a ticked box as agreement", () => {
    expect(isNoticeAgreed(form({ agree: "yes" }))).toBe(true);
    expect(isNoticeAgreed(form({}))).toBe(false);
    expect(isNoticeAgreed(form({ agree: "on" }))).toBe(false);
    expect(isNoticeAgreed(form({ agree: "" }))).toBe(false);
  });

  it("treats a duplicate acceptance as already done, and other errors as errors", () => {
    expect(isAlreadyAccepted({ code: "23505" })).toBe(true);
    expect(isAlreadyAccepted({ code: "42501" })).toBe(false);
    expect(isAlreadyAccepted(null)).toBe(false);
  });

  it("uses a notice version the database accepts", () => {
    expect(NOTICE_VERSION).toMatch(/^[0-9A-Za-z][0-9A-Za-z.-]{0,39}$/);
  });
});
