import { createClient } from "@/lib/supabase/client";

const BUCKET = "wall-photos";

export async function uploadWallPhoto(file: File, userId: string): Promise<string> {
  const supabase = createClient();
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
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
      // Storage 미설정 시 data URL fallback
    }
  }
  return readFileAsDataUrl(file);
}
