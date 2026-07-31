import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/admin/service-client";
import { WALL_PHOTOS_BUCKET } from "@/lib/storage/wall-photos";

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

async function listAllStoragePaths(
  admin: SupabaseClient,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  const limit = 100;

  for (;;) {
    const { data, error } = await admin.storage.from(WALL_PHOTOS_BUCKET).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error || !data?.length) break;

    for (const item of data) {
      // Folders have id null in some API versions; files have metadata.
      if (item.id) {
        paths.push(`${prefix}/${item.name}`);
      } else if (item.name) {
        // Nested folder under user — list one level (photos are flat: userId/uuid.ext)
        const nested = await listAllStoragePaths(admin, `${prefix}/${item.name}`);
        paths.push(...nested);
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return paths;
}

async function deleteUserStorage(admin: SupabaseClient, userId: string) {
  const paths = await listAllStoragePaths(admin, userId);
  if (paths.length === 0) return;

  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    await admin.storage.from(WALL_PHOTOS_BUCKET).remove(chunk);
  }
}

/**
 * Wipe app content for a user but keep auth + profile (restricted).
 * Used by admin moderation — does not call auth.admin.deleteUser.
 */
export async function wipeUserContent(userId: string): Promise<DeleteAccountResult> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      status: 503,
      error: "Wipe requires SUPABASE_SERVICE_ROLE_KEY",
    };
  }

  await admin.from("wall_likes").delete().eq("user_id", userId);
  await admin.from("wall_guestbook").delete().eq("user_id", userId);
  await admin.from("wall_members").delete().eq("user_id", userId);
  await admin
    .from("friendships")
    .delete()
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);
  await admin
    .from("wall_member_invites")
    .delete()
    .or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`);
  await admin
    .from("wall_activity_notices")
    .delete()
    .or(`actor_id.eq.${userId},recipient_id.eq.${userId}`);

  await admin.from("walls").delete().eq("owner_id", userId);
  await deleteUserStorage(admin, userId);

  await admin
    .from("profiles")
    .update({
      restricted_at: new Date().toISOString(),
      restrict_reason: "관리자에 의한 콘텐츠 삭제",
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  return { ok: true };
}

/**
 * Permanently delete the signed-in user's account and associated app data.
 * Requires SUPABASE_SERVICE_ROLE_KEY for Auth admin delete + Storage cleanup.
 */
export async function deleteUserAccount(userId: string): Promise<DeleteAccountResult> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      status: 503,
      error: "Account deletion requires SUPABASE_SERVICE_ROLE_KEY",
    };
  }

  // Best-effort relational cleanup (order: dependents → walls → profile → auth).
  await admin.from("wall_likes").delete().eq("user_id", userId);
  await admin.from("wall_guestbook").delete().eq("user_id", userId);
  await admin.from("wall_members").delete().eq("user_id", userId);
  await admin
    .from("friendships")
    .delete()
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);
  await admin
    .from("wall_member_invites")
    .delete()
    .or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`);
  await admin
    .from("wall_activity_notices")
    .delete()
    .or(`actor_id.eq.${userId},recipient_id.eq.${userId}`);
  await admin.from("inquiries").delete().eq("user_id", userId);

  // Owned walls (personal + shared). Cascades may cover children depending on schema.
  await admin.from("walls").delete().eq("owner_id", userId);

  await deleteUserStorage(admin, userId);

  await admin.from("profiles").delete().eq("id", userId);
  await admin.from("app_admins").delete().eq("user_id", userId);

  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    return {
      ok: false,
      status: 500,
      error: authError.message || "Failed to delete auth user",
    };
  }

  return { ok: true };
}
