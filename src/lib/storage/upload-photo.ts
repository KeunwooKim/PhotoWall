import { createClient } from "@/lib/supabase/client";
import { toWallPhotoRef, WALL_PHOTOS_BUCKET } from "@/lib/storage/wall-photos";

export async function uploadWallPhoto(file: File, userId: string): Promise<string> {
  const supabase = createClient();
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(WALL_PHOTOS_BUCKET).upload(path, file, {
    contentType: file.type,
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
): Promise<string> {
  if (userId) {
    try {
      return await uploadWallPhoto(file, userId);
    } catch {
      // Storage 미설정·private 전환 전 fallback
    }
  }
  return readFileAsDataUrl(file);
}
