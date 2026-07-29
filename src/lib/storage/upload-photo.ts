import { createClient } from "@/lib/supabase/client";
import { toWallPhotoRef, WALL_PHOTOS_BUCKET } from "@/lib/storage/wall-photos";
import { assertPhotoUploadAllowed, type UserPlan } from "@/lib/wall-quotas";

// ─── 클라이언트 측 리사이즈 ────────────────────────────────────────────────
// 이 블록을 제거하면 리사이즈 없이 원본 업로드로 되돌아갑니다.
const RESIZE_MAX_PX = 1200;  // 긴 변 최대 픽셀
const RESIZE_QUALITY = 0.85; // JPEG/WebP 품질 (0~1)
const RESIZE_MIME = "image/jpeg";

async function resizeIfNeeded(file: File): Promise<File> {
  // GIF는 리사이즈 시 애니메이션이 깨지므로 원본 유지
  if (file.type === "image/gif") return file;

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  if (width <= RESIZE_MAX_PX && height <= RESIZE_MAX_PX) {
    bitmap.close();
    return file;
  }

  const scale = RESIZE_MAX_PX / Math.max(width, height);
  const canvas = new OffscreenCanvas(Math.round(width * scale), Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) { bitmap.close(); return file; }

  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: RESIZE_MIME, quality: RESIZE_QUALITY });
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: RESIZE_MIME });
}
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadWallPhoto(
  file: File,
  userId: string,
  plan: UserPlan = "free",
): Promise<string> {
  assertPhotoUploadAllowed(file, plan);

  const resized = await resizeIfNeeded(file);

  const supabase = createClient();
  const ext = resized.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(WALL_PHOTOS_BUCKET).upload(path, resized, {
    contentType: resized.type,
    upsert: false,
  });

  if (error) throw error;

  return toWallPhotoRef(path);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function resolvePhotoUrl(
  file: File,
  userId?: string,
  plan: UserPlan = "free",
): Promise<string> {
  assertPhotoUploadAllowed(file, plan);

  if (userId) {
    try {
      return await uploadWallPhoto(file, userId, plan);
    } catch (err) {
      if (err instanceof Error && err.name === "PhotoUploadError") throw err;
      // Storage 미설정·private 전환 전 fallback
    }
  }
  return readFileAsDataUrl(file);
}
