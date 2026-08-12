import { createClient } from "@/lib/supabase/client";
import { putGuestPhoto } from "@/lib/storage/guest-photos";
import { toWallPhotoRef, WALL_PHOTOS_BUCKET } from "@/lib/storage/wall-photos";
import {
  assertAccountStorageAllowed,
  assertPhotoUploadAllowed,
  PhotoUploadError,
  type UserPlan,
} from "@/lib/wall-quotas";
import { authFetch } from "@/lib/auth/api-fetch";
import { extensionForImageMime, sniffImageMime } from "@/lib/storage/image-magic";

async function assertStorageRoom(additionalBytes: number, plan: UserPlan): Promise<void> {
  const res = await authFetch("/api/storage/usage");
  if (!res.ok) {
    // Don't block upload if usage API flaps — per-file limit still applies
    return;
  }
  const body = (await res.json()) as { usedBytes?: number };
  const used = typeof body.usedBytes === "number" ? body.usedBytes : 0;
  assertAccountStorageAllowed(used, additionalBytes, plan);
}

async function normalizeImageFile(
  file: File | Blob,
  plan: UserPlan,
  fileNameHint?: string,
): Promise<File> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImageMime(buf);
  if (!sniffed) {
    throw new PhotoUploadError("invalid_type", plan);
  }

  const asFile = new File([buf], fileNameHint || `photo.${extensionForImageMime(sniffed)}`, {
    type: sniffed,
  });
  assertPhotoUploadAllowed(asFile, plan);
  return asFile;
}

export async function uploadWallPhoto(
  file: File | Blob,
  userId: string,
  plan: UserPlan = "free",
  fileNameHint?: string,
): Promise<string> {
  const asFile = await normalizeImageFile(file, plan, fileNameHint);
  await assertStorageRoom(asFile.size, plan);

  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("restricted_at")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.restricted_at) {
    throw new Error("활동이 제한된 계정이에요. 문의하기에서 도움을 요청해 주세요");
  }

  const ext = extensionForImageMime(
    asFile.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
  );
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
  const asFile = await normalizeImageFile(file, plan, file.name);

  if (userId) {
    return uploadWallPhoto(asFile, userId, plan, asFile.name);
  }
  return putGuestPhoto(asFile, asFile.type);
}
