import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/admin/service-client";

/**
 * Sum bytes used by a user's wall-photos objects (path prefix `{userId}/`).
 * Uses security-definer RPC `get_user_wall_photo_bytes`.
 */
export async function getUserWallPhotoBytes(
  userId: string,
  client?: SupabaseClient | null,
): Promise<number> {
  const db = createAdminClient() ?? client;
  if (!db) return 0;

  const { data, error } = await db.rpc("get_user_wall_photo_bytes", {
    p_user_id: userId,
  });

  if (error) {
    console.warn("[storage-usage]", error.message);
    return 0;
  }

  const n = typeof data === "number" ? data : Number(data);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
