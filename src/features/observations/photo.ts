import type { ErrorKey } from "@/lib/i18n";

import { MAX_PHOTO_BYTES } from "./constants";

export type PhotoType = { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

/**
 * Works out the image type from the file's first bytes, not from its name or the type the
 * browser reports, so a file that is not really a JPEG, PNG or WebP image is refused.
 */
export function detectImageType(bytes: Uint8Array): PhotoType | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  // "RIFF" .... "WEBP"
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return { mime: "image/webp", ext: "webp" };
  return null;
}

/** Checks an uploaded photo. Returns its type, or the message key to show the farmer. */
export function checkPhoto(bytes: Uint8Array): { type: PhotoType } | { error: ErrorKey } {
  if (bytes.byteLength > MAX_PHOTO_BYTES) return { error: "photoTooLarge" };
  const type = detectImageType(bytes);
  return type ? { type } : { error: "photoType" };
}

/** A safe file name to keep for reference: no folders, at most 100 plain characters. */
export function safeFileName(name: string, ext: string): string {
  const base = name
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[^.]*$/, "")
    .replace(/[^\p{L}\p{N}_-]+/gu, "_")
    .slice(0, 100);
  return `${base || "photo"}.${ext}`;
}
