import { createClient } from "@/lib/supabase/client";
import { putGuestPhoto } from "@/lib/storage/guest-photos";
import { toWallPhotoRef, WALL_PHOTOS_BUCKET } from "@/lib/storage/wall-photos";
import { assertPhotoUploadAllowed, type UserPlan } from "@/lib/wall-quotas";

export async function uploadWallPhoto(
  file: File | Blob,
  userId: string,
  plan: UserPlan = "free",
  fileNameHint?: string,
): Promise<string> {
  const asFile =
    file instanceof File
      ? file
      : new File([file], fileNameHint || "photo.jpg", {
          type: file.type || "image/jpeg",
        });

  assertPhotoUploadAllowed(asFile, plan);

  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("restricted_at")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.restricted_at) {
    throw new Error("활동이 제한된 계정이에요. 문의하기에서 도움을 요청해 주세요");
  }

  const ext = asFile.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(WALL_PHOTOS_BUCKET).upload(path, asFile, {
    contentType: asFile.type,
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

/** Logged-in → Storage ref; guest → IndexedDB guest-photo:// ref. */
export async function resolvePhotoUrl(
  file: File,
  userId?: string,
  plan: UserPlan = "free",
): Promise<string> {
  assertPhotoUploadAllowed(file, plan);

  if (userId) {
    return uploadWallPhoto(file, userId, plan);
  }
  return putGuestPhoto(file, file.type);
}
