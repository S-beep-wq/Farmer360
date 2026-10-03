/** Splits a list into consecutive batches of at most `size` items. */
export function inChunks<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error("size must be at least 1");
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** The farmer must tick the confirmation box; anything else is not a confirmation. */
export function isDeletionConfirmed(formData: FormData) {
  return formData.get("confirm") === "yes";
}
