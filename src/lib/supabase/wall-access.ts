import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserWallRole } from "./wall-role";

export interface WallAccessResult {
  allowed: boolean;
  isOwner: boolean;
  isShared: boolean;
  canGuestbook: boolean;
  reason?: "private" | "not_found" | "members_only" | "not_member";
}

interface WallAccessMeta {
  exists: boolean;
  is_shared?: boolean;
  owner_id?: string | null;
  is_member?: boolean;
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

async function loadWallAccessMeta(
  supabase: SupabaseClient,
  wallId: string,
  visitorId?: string | null,
): Promise<WallAccessMeta | null> {
  const { data, error } = await supabase.rpc("get_wall_access_meta", {
    p_wall_id: wallId,
    p_user_id: visitorId ?? null,
  });

  if (!error && data && typeof data === "object") {
    return data as WallAccessMeta;
  }

  // Migration 미적용 환경 fallback
  const { data: wall } = await supabase
    .from("walls")
    .select("id, owner_id, is_shared")
    .eq("id", wallId)
    .maybeSingle();

  if (!wall) {
    return { exists: false };
  }

  let isMember = false;
  if (visitorId) {
    if (wall.owner_id === visitorId) {
      isMember = true;
    } else {
      const { data: member } = await supabase
        .from("wall_members")
        .select("id")
        .eq("wall_id", wallId)
        .eq("user_id", visitorId)
        .maybeSingle();
      isMember = !!member;
    }
  }

  return {
    exists: true,
    is_shared: !!wall.is_shared,
    owner_id: wall.owner_id,
    is_member: isMember,
  };
}

export async function checkWallAccess(
  supabase: SupabaseClient,
  wallId: string,
  visitorId?: string | null,
): Promise<WallAccessResult> {
  const meta = await loadWallAccessMeta(supabase, wallId, visitorId);

  if (!meta?.exists) {
    return { allowed: false, isOwner: false, isShared: false, canGuestbook: false, reason: "not_found" };
  }

  const ownerId = meta.owner_id ?? null;
  const isOwner = !!visitorId && ownerId === visitorId;
  const isShared = !!meta.is_shared;

  if (isShared) {
    if (!visitorId) {
      return {
        allowed: false,
        isOwner: false,
        isShared: true,
        canGuestbook: false,
        reason: "members_only",
      };
    }

    if (!meta.is_member) {
      return {
        allowed: false,
        isOwner: false,
        isShared: true,
        canGuestbook: false,
        reason: "not_member",
      };
    }

    const role = await getUserWallRole(supabase, wallId, visitorId);
    const canGuestbook = role === "owner" || role === "editor";
    return {
      allowed: true,
      isOwner: role === "owner",
      isShared: true,
      canGuestbook,
    };
  }

  if (isOwner) {
    return { allowed: true, isOwner: true, isShared: false, canGuestbook: true };
  }

  if (!visitorId || !ownerId) {
    return { allowed: false, isOwner: false, isShared: false, canGuestbook: false, reason: "private" };
  }

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("allow_wall_visits")
    .eq("id", ownerId)
    .maybeSingle();

  if (!ownerProfile?.allow_wall_visits) {
    return { allowed: false, isOwner: false, isShared: false, canGuestbook: false, reason: "private" };
  }

  const friends = await areFriends(supabase, visitorId, ownerId);
  if (!friends) {
    return { allowed: false, isOwner: false, isShared: false, canGuestbook: false, reason: "private" };
  }

  return { allowed: true, isOwner: false, isShared: false, canGuestbook: false };
}
