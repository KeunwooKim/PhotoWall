import { createClient } from "@/lib/supabase/client";
import { toWallPhotoRef, WALL_PHOTOS_BUCKET } from "@/lib/storage/wall-photos";
import { assertPhotoUploadAllowed, type UserPlan } from "@/lib/wall-quotas";

export async function uploadWallPhoto(
  file: File,
  userId: string,
  plan: UserPlan = "free",
): Promise<string> {
  assertPhotoUploadAllowed(file, plan);

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
  plan: UserPlan = "free",
): Promise<string> {
  assertPhotoUploadAllowed(file, plan);

  if (userId) {
    return uploadWallPhoto(file, userId, plan);
  }
  return readFileAsDataUrl(file);
}
