import type { SupabaseClient } from "@supabase/supabase-js";

export interface WallAccessResult {
  allowed: boolean;
  isOwner: boolean;
  isShared: boolean;
  canGuestbook: boolean;
  reason?: "private" | "not_found";
}

export async function areFriends(
  supabase: SupabaseClient,
  userA: string,
  userB: string,
): Promise<boolean> {
  const low = userA < userB ? userA : userB;
  const high = userA < userB ? userB : userA;

  const { data } = await supabase
    .from("friendships")
    .select("id")
    .eq("user_a", low)
    .eq("user_b", high)
    .maybeSingle();

  return !!data;
}

export async function checkWallAccess(
  supabase: SupabaseClient,
  wallId: string,
  visitorId?: string | null,
): Promise<WallAccessResult> {
  const { data: wall } = await supabase
    .from("walls")
    .select("id, owner_id, is_shared")
    .eq("id", wallId)
    .maybeSingle();

  if (!wall) {
    return { allowed: false, isOwner: false, isShared: false, canGuestbook: false, reason: "not_found" };
  }

  const isOwner = !!visitorId && wall.owner_id === visitorId;
  const isShared = !!wall.is_shared;

  if (isShared) {
    let canGuestbook = isOwner;
    if (visitorId && !isOwner) {
      const { data: member } = await supabase
        .from("wall_members")
        .select("role")
        .eq("wall_id", wallId)
        .eq("user_id", visitorId)
        .maybeSingle();
      canGuestbook = member?.role === "owner" || member?.role === "editor";
    }
    return { allowed: true, isOwner, isShared: true, canGuestbook };
  }

  if (isOwner) {
    return { allowed: true, isOwner: true, isShared: false, canGuestbook: true };
  }

  if (!visitorId || !wall.owner_id) {
    return { allowed: false, isOwner: false, isShared: false, canGuestbook: false, reason: "private" };
  }

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("allow_wall_visits")
    .eq("id", wall.owner_id)
    .maybeSingle();

  if (!ownerProfile?.allow_wall_visits) {
    return { allowed: false, isOwner: false, isShared: false, canGuestbook: false, reason: "private" };
  }

  const friends = await areFriends(supabase, visitorId, wall.owner_id);
  if (!friends) {
    return { allowed: false, isOwner: false, isShared: false, canGuestbook: false, reason: "private" };
  }

  return { allowed: true, isOwner: false, isShared: false, canGuestbook: false };
}
