import type { SupabaseClient } from "@supabase/supabase-js";
import type { WallActivityNotice } from "@/types/wall-activity-notice";

/** Quiet period after last successful save before the notice becomes visible. */
export const WALL_ACTIVITY_NOTICE_DELAY_MS = 3 * 60 * 1000;

type NoticeRow = {
  id: string;
  wall_id: string;
  wall_title: string;
  actor_name: string;
  actor_avatar_url: string | null;
  updated_at: string;
  visible_at: string;
};

function mapNotice(row: NoticeRow): WallActivityNotice {
  return {
    id: row.id,
    wallId: row.wall_id,
    wallTitle: row.wall_title || "공동 벽",
    actorName: row.actor_name || "친구",
    actorAvatarUrl: row.actor_avatar_url,
    updatedAt: row.updated_at,
    visibleAt: row.visible_at,
  };
}

/**
 * After a successful shared-wall canvas save, schedule (or refresh) inbox
 * notices for other members. Resets visible_at to now + delay so continuous
 * editing coalesces into one notice.
 */
export async function scheduleWallActivityNotices(
  supabase: SupabaseClient,
  wallId: string,
  actorId: string,
): Promise<void> {
  const [{ data: wall }, { data: members }, { data: actorProfile }] = await Promise.all([
    supabase.from("walls").select("id, title, is_shared").eq("id", wallId).maybeSingle(),
    supabase.from("wall_members").select("user_id").eq("wall_id", wallId),
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", actorId)
      .maybeSingle(),
  ]);

  if (!wall?.is_shared || !members?.length) return;

  const recipientIds = members
    .map((m) => m.user_id as string)
    .filter((id) => id !== actorId);
  if (recipientIds.length === 0) return;

  const now = Date.now();
  const visibleAt = new Date(now + WALL_ACTIVITY_NOTICE_DELAY_MS).toISOString();
  const updatedAt = new Date(now).toISOString();
  const wallTitle = (wall.title as string | null)?.trim() || "공동 벽";
  const actorName = actorProfile?.display_name?.trim() || "친구";
  const actorAvatarUrl = actorProfile?.avatar_url ?? null;

  const rows = recipientIds.map((recipientId) => ({
    wall_id: wallId,
    actor_id: actorId,
    recipient_id: recipientId,
    wall_title: wallTitle.slice(0, 80),
    actor_name: actorName.slice(0, 80),
    actor_avatar_url: actorAvatarUrl,
    visible_at: visibleAt,
    dismissed_at: null,
    updated_at: updatedAt,
  }));

  const { error } = await supabase.rpc("upsert_wall_activity_notices", {
    p_rows: rows,
  });

  if (error) {
    console.warn("[wall-activity-notices] schedule failed:", error.message);
  }
}

export async function listVisibleWallActivityNotices(
  supabase: SupabaseClient,
  recipientId: string,
  limit = 20,
): Promise<WallActivityNotice[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("wall_activity_notices")
    .select(
      "id, wall_id, wall_title, actor_name, actor_avatar_url, updated_at, visible_at",
    )
    .eq("recipient_id", recipientId)
    .is("dismissed_at", null)
    .lte("visible_at", nowIso)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (error && !/wall_activity_notices/.test(error.message)) {
      console.warn("[wall-activity-notices] list failed:", error.message);
    }
    return [];
  }

  return data.map((row) => mapNotice(row as NoticeRow));
}

export async function dismissWallActivityNotices(
  supabase: SupabaseClient,
  recipientId: string,
  ids?: string[],
): Promise<boolean> {
  const dismissedAt = new Date().toISOString();
  let query = supabase
    .from("wall_activity_notices")
    .update({ dismissed_at: dismissedAt, updated_at: dismissedAt })
    .eq("recipient_id", recipientId)
    .is("dismissed_at", null);

  if (ids?.length) {
    query = query.in("id", ids);
  }

  const { error } = await query;
  if (error) {
    console.warn("[wall-activity-notices] dismiss failed:", error.message);
    return false;
  }
  return true;
}
