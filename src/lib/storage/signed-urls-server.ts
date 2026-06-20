import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/admin/service-client";
import { WALL_PHOTOS_BUCKET } from "@/lib/storage/wall-photos";

const SIGNED_URL_TTL_SEC = 3600;

export async function createWallPhotoSignedUrls(
  paths: string[],
  userSupabase?: SupabaseClient | null,
  userId?: string | null,
): Promise<Record<string, string>> {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (uniquePaths.length === 0) return {};

  const signed: Record<string, string> = {};
  const admin = createAdminClient();

  if (admin) {
    await Promise.all(
      uniquePaths.map(async (path) => {
        const { data, error } = await admin.storage
          .from(WALL_PHOTOS_BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL_SEC);

        if (!error && data?.signedUrl) {
          signed[path] = data.signedUrl;
        }
      }),
    );

    return signed;
  }

  if (!userSupabase || !userId) return signed;

  await Promise.all(
    uniquePaths.map(async (path) => {
      if (path.split("/")[0] !== userId) return;

      const { data, error } = await userSupabase.storage
        .from(WALL_PHOTOS_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SEC);

      if (!error && data?.signedUrl) {
        signed[path] = data.signedUrl;
      }
    }),
  );

  return signed;
}
