// Runs in the browser. Makes a phone photo smaller before upload: at most 1600 px on the long
// side, re-encoded as JPEG. That keeps uploads small on slow rural connections, and re-encoding
// drops the file's metadata (EXIF), including the GPS position some phones store in photos.

const MAX_SIDE = 1600;
const QUALITY = 0.8;

export async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob) return file;
    const name = `${file.name.replace(/\.[^.]*$/, "") || "photo"}.jpg`;
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    // The browser could not read this image (for example an unusual format): send it as it is,
    // and the server decides whether it is acceptable.
    return file;
  }
}
