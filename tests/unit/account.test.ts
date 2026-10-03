import { describe, expect, it } from "vitest";

import { inChunks, isDeletionConfirmed } from "@/features/account/rules";

describe("inChunks", () => {
  it("splits into batches of at most the given size, keeping order", () => {
    expect(inChunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(inChunks([1, 2], 100)).toEqual([[1, 2]]);
    expect(inChunks([], 100)).toEqual([]);
  });

  it("refuses a batch size below 1", () => {
    expect(() => inChunks([1], 0)).toThrow();
  });
});

describe("isDeletionConfirmed", () => {
  const form = (entries: Record<string, string>) => {
    const data = new FormData();
    for (const [k, v] of Object.entries(entries)) data.set(k, v);
    return data;
  };

  it("needs the confirmation box to be ticked", () => {
    expect(isDeletionConfirmed(form({ confirm: "yes" }))).toBe(true);
    expect(isDeletionConfirmed(form({}))).toBe(false);
    expect(isDeletionConfirmed(form({ confirm: "on" }))).toBe(false);
    expect(isDeletionConfirmed(form({ confirm: "" }))).toBe(false);
  });
});
