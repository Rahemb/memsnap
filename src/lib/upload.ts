import { supabase } from "@/integrations/supabase/client";

export type UploadStage = "uploading" | "analyzing" | "organizing" | "ready" | "failed";

export type PreparedImage = {
  blob: Blob;
  width: number;
  height: number;
};

const MAX_FULL_EDGE = 1600;
const MAX_THUMB_EDGE = 480;

async function loadBitmap(file: File) {
  if ("createImageBitmap" in window) {
    return await createImageBitmap(file);
  }
  // Fallback for browsers without createImageBitmap
  const url = URL.createObjectURL(file);
  try {
    const img = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawToBlob(
  source: ImageBitmap | HTMLImageElement,
  maxEdge: number,
  quality: number,
): Promise<PreparedImage> {
  const sw = "width" in source ? source.width : 0;
  const sh = "height" in source ? source.height : 0;
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Could not compress image"));
        resolve({ blob, width, height });
      },
      "image/webp",
      quality,
    );
  });
}

/** Compresses a picked screenshot into a display image plus a light thumbnail. */
export async function prepareImage(file: File) {
  const bitmap = await loadBitmap(file);
  const full = await drawToBlob(bitmap, MAX_FULL_EDGE, 0.86);
  const thumb = await drawToBlob(bitmap, MAX_THUMB_EDGE, 0.72);
  if ("close" in bitmap) bitmap.close();
  return { full, thumb };
}

/**
 * Cheap perceptual-ish hash used to spot near-duplicate uploads.
 * 16x16 greyscale average -> 256-bit signature.
 */
export async function imageFingerprint(file: File): Promise<string> {
  try {
    const bitmap = await loadBitmap(file);
    const size = 16;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const grey: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      grey.push((data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114) | 0);
    }
    const avg = grey.reduce((a, b) => a + b, 0) / grey.length;
    let bits = "";
    for (const g of grey) bits += g > avg ? "1" : "0";
    if ("close" in bitmap) bitmap.close();
    return bits
      .match(/.{1,4}/g)!
      .map((chunk) => parseInt(chunk, 2).toString(16))
      .join("");
  } catch {
    return "";
  }
}

export async function findDuplicate(userId: string, fingerprint: string) {
  if (!fingerprint) return null;
  const { data } = await supabase
    .from("screenshots")
    .select("id, title, thumbnail_path, storage_path, created_at")
    .eq("user_id", userId)
    .eq("image_hash", fingerprint)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export type UploadResult = { id: string; storagePath: string };

/** Uploads one screenshot: storage first, then the database row. */
export async function uploadScreenshot(
  userId: string,
  file: File,
  fingerprint: string,
): Promise<UploadResult> {
  const { full, thumb } = await prepareImage(file);
  const id = crypto.randomUUID();
  const base = `${userId}/${id}`;
  const fullPath = `${base}/full.webp`;
  const thumbPath = `${base}/thumb.webp`;

  const up1 = await supabase.storage
    .from("screenshots")
    .upload(fullPath, full.blob, { contentType: "image/webp", upsert: true });
  if (up1.error) throw up1.error;

  const up2 = await supabase.storage
    .from("screenshots")
    .upload(thumbPath, thumb.blob, { contentType: "image/webp", upsert: true });
  if (up2.error) throw up2.error;

  const { error } = await supabase.from("screenshots").insert({
    id,
    user_id: userId,
    storage_path: fullPath,
    thumbnail_path: thumbPath,
    original_filename: file.name,
    file_size: full.blob.size,
    width: full.width,
    height: full.height,
    image_hash: fingerprint || null,
    status: "analyzing",
    captured_at: file.lastModified ? new Date(file.lastModified).toISOString() : null,
  });
  if (error) throw error;

  return { id, storagePath: fullPath };
}
