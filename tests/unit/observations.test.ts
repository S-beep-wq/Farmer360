import { describe, expect, it } from "vitest";

import { MAX_PHOTO_BYTES } from "@/features/observations/constants";
import { checkPhoto, detectImageType, safeFileName } from "@/features/observations/photo";
import { canAddObservation, canRemoveObservation } from "@/features/observations/rules";
import { observationSchema } from "@/features/observations/schema";
import { fieldErrorsFrom } from "@/lib/forms";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);

describe("detectImageType", () => {
  it("recognises JPEG, PNG and WebP from their first bytes", () => {
    expect(detectImageType(JPEG)).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(detectImageType(PNG)).toEqual({ mime: "image/png", ext: "png" });
    expect(detectImageType(WEBP)).toEqual({ mime: "image/webp", ext: "webp" });
  });

  it("refuses anything else, whatever its name says", () => {
    expect(detectImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
    expect(detectImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20]))).toBeNull(); // AVI
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});

describe("checkPhoto", () => {
  it("accepts a valid photo within the size limit", () => {
    expect(checkPhoto(JPEG)).toEqual({ type: { mime: "image/jpeg", ext: "jpg" } });
  });

  it("refuses photos that are too large or not images", () => {
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
    big.set(JPEG);
    expect(checkPhoto(big)).toEqual({ error: "photoTooLarge" });
    expect(checkPhoto(new TextEncoder().encode("hello"))).toEqual({ error: "photoType" });
  });
});

describe("safeFileName", () => {
  it("keeps a readable name without folders or odd characters", () => {
    expect(safeFileName("IMG_2026 10 03.HEIC", "jpg")).toBe("IMG_2026_10_03.jpg");
    expect(safeFileName("../../etc/passwd", "png")).toBe("passwd.png");
    expect(safeFileName("खेत की फ़ोटो.jpeg", "jpg")).toMatch(/\.jpg$/);
    expect(safeFileName("", "webp")).toBe("photo.webp");
  });
});

describe("observationSchema", () => {
  const schema = observationSchema("2026-10-03", "2026-07-01");
  const errors = (input: Record<string, string>) => {
    const r = schema.safeParse(input);
    return r.success ? {} : fieldErrorsFrom(r.error);
  };

  it("accepts a dated observation with a health status", () => {
    expect(schema.parse({ observation_date: "2026-09-01", health_status: "PROBLEM", farmer_notes: " Yellow leaves " })).toEqual({
      observation_date: "2026-09-01",
      health_status: "PROBLEM",
      farmer_notes: "Yellow leaves",
    });
  });

  it("explains wrong dates and a missing health status", () => {
    expect(errors({ observation_date: "2026-06-30", health_status: "HEALTHY" })).toEqual({ observation_date: "observationBeforeSowing" });
    expect(errors({ observation_date: "2026-10-04", health_status: "HEALTHY" })).toEqual({ observation_date: "futureDate" });
    expect(errors({ observation_date: "2026-09-01", health_status: "" })).toEqual({ health_status: "invalidChoice" });
  });
});

describe("rules", () => {
  it("adds observations only for a crop in the field, and removes them until the season is closed", () => {
    expect(canAddObservation("ACTIVE")).toBe(true);
    expect(["PLANNED", "HARVESTED", "CANCELLED", "COMPLETED"].some(canAddObservation)).toBe(false);
    expect(canRemoveObservation("HARVESTED")).toBe(true);
    expect(canRemoveObservation("COMPLETED")).toBe(false);
  });
});
