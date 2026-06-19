import type { SupabaseClient } from "@supabase/supabase-js";
import type { SharedWall, SharedWallMember, WallMemberInvite, WallMemberRole } from "@/types/shared-wall";
import { isWallThemeId } from "@/lib/wall-themes";
import type { PublishedWall } from "@/types/wall";

export async function getUserWallRole(
  supabase: SupabaseClient,
  wallId: string,
  userId: string,
): Promise<WallMemberRole | null> {
  const { data: wall } = await supabase
    .from("walls")
    .select("owner_id")
    .eq("id", wallId)
    .maybeSingle();

  if (wall?.owner_id === userId) return "owner";

  const { data: member } = await supabase
    .from("wall_members")
    .select("role")
    .eq("wall_id", wallId)
    .eq("user_id", userId)
    .maybeSingle();

  return (member?.role as WallMemberRole) ?? null;
}

export async function canEditWall(
  supabase: SupabaseClient,
  wallId: string,
  userId: string,
): Promise<boolean> {
  const role = await getUserWallRole(supabase, wallId, userId);
  return role === "owner" || role === "editor";
}

export async function createSharedWall(
  supabase: SupabaseClient,
  userId: string,
  title: string,
): Promise<{ wall: SharedWall | null; error?: string }> {
  const trimmedTitle = title.trim() || "우리 인생네컷";

  const { data: rpcData, error: rpcError } = await supabase.rpc("create_shared_wall", {
    p_title: trimmedTitle,
  });

  if (!rpcError && rpcData) {
    const row = rpcData as {
      id: string;
      title: string;
      theme_id: string;
      updated_at: string;
    };

    return {
      wall: {
        id: row.id,
        title: row.title ?? trimmedTitle,
        themeId: isWallThemeId(row.theme_id) ? row.theme_id : "white",
        updatedAt: row.updated_at,
        myRole: "owner",
        memberCount: 1,
      },
    };
  }

  const { data: wall, error: wallError } = await supabase
    .from("walls")
    .insert({
      owner_id: userId,
      title: trimmedTitle,
      is_shared: true,
      theme_id: "white",
      canvas_json: { version: "6.0.0", objects: [] },
    })
    .select("id, title, theme_id, updated_at")
    .single();

  if (wallError || !wall) {
    return {
      wall: null,
      error: wallError?.message ?? rpcError?.message ?? "wall insert failed",
    };
  }

  const { error: memberError } = await supabase.from("wall_members").insert({
    wall_id: wall.id,
    user_id: userId,
    role: "owner",
  });

  if (memberError) {
    await supabase.from("walls").delete().eq("id", wall.id);
    return { wall: null, error: memberError.message };
  }

  return {
    wall: {
      id: wall.id,
      title: wall.title ?? trimmedTitle,
      themeId: isWallThemeId(wall.theme_id) ? wall.theme_id : "white",
      updatedAt: wall.updated_at,
      myRole: "owner",
      memberCount: 1,
    },
  };
}

export async function inviteFriendToWall(
  supabase: SupabaseClient,
  wallId: string,
  ownerId: string,
  friendId: string,
): Promise<{ ok: boolean; error?: string }> {
  const role = await getUserWallRole(supabase, wallId, ownerId);
  if (role !== "owner") return { ok: false, error: "not_owner" };
  if (ownerId === friendId) return { ok: false, error: "self" };

  const { data: existingMember } = await supabase
    .from("wall_members")
    .select("id")
    .eq("wall_id", wallId)
    .eq("user_id", friendId)
    .maybeSingle();

  if (existingMember) return { ok: false, error: "already_member" };

  const { data: existingInvite } = await supabase
    .from("wall_member_invites")
    .select("id, status")
    .eq("wall_id", wallId)
    .eq("invitee_id", friendId)
    .maybeSingle();

  if (existingInvite?.status === "pending") {
    return { ok: false, error: "already_invited" };
  }

  if (existingInvite?.status === "declined") {
    const { error } = await supabase
      .from("wall_member_invites")
      .update({ status: "pending", inviter_id: ownerId })
      .eq("id", existingInvite.id);

    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const { error } = await supabase.from("wall_member_invites").insert({
    wall_id: wallId,
    invitee_id: friendId,
    inviter_id: ownerId,
    status: "pending",
  });

  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function getPendingWallInvites(
  supabase: SupabaseClient,
  userId: string,
): Promise<WallMemberInvite[]> {
  const { data: invites, error } = await supabase
    .from("wall_member_invites")
    .select("id, wall_id, inviter_id, created_at")
    .eq("invitee_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !invites?.length) return [];

  const wallIds = [...new Set(invites.map((i) => i.wall_id))];
  const inviterIds = [...new Set(invites.map((i) => i.inviter_id))];

  const [{ data: walls }, { data: profiles }] = await Promise.all([
    supabase.from("walls").select("id, title").in("id", wallIds),
    supabase.from("profiles").select("id, display_name, avatar_url").in("id", inviterIds),
  ]);

  const titleByWall = new Map((walls ?? []).map((w) => [w.id, w.title ?? "우리 인생네컷"]));
  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, { displayName: p.display_name ?? "친구", avatarUrl: p.avatar_url }]),
  );

  return invites.map((inv) => {
    const profile = profileById.get(inv.inviter_id);
    return {
      id: inv.id,
      wallId: inv.wall_id,
      wallTitle: titleByWall.get(inv.wall_id) ?? "우리 인생네컷",
      inviterName: profile?.displayName ?? "친구",
      inviterAvatarUrl: profile?.avatarUrl ?? null,
      createdAt: inv.created_at,
    };
  });
}

export async function acceptWallInvite(
  supabase: SupabaseClient,
  inviteId: string,
  userId: string,
): Promise<{ wallId: string | null; error?: string }> {
  const { data: invite } = await supabase
    .from("wall_member_invites")
    .select("id, invitee_id, status")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite || invite.invitee_id !== userId || invite.status !== "pending") {
    return { wallId: null, error: "not_found" };
  }

  const { data, error } = await supabase.rpc("accept_wall_member_invite", {
    p_invite_id: inviteId,
  });

  if (error) {
    return { wallId: null, error: error.message };
  }

  const row = data as { wallId?: string; wall_id?: string } | null;
  return { wallId: row?.wallId ?? row?.wall_id ?? null };
}

export async function declineWallInvite(
  supabase: SupabaseClient,
  inviteId: string,
  userId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("wall_member_invites")
    .update({ status: "declined" })
    .eq("id", inviteId)
    .eq("invitee_id", userId)
    .eq("status", "pending");

  return !error;
}

export async function getSharedWallsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<SharedWall[]> {
  const { data: memberships, error } = await supabase
    .from("wall_members")
    .select("wall_id, role")
    .eq("user_id", userId);

  if (error || !memberships?.length) return [];

  const wallIds = memberships.map((m) => m.wall_id);
  const roleByWall = new Map(memberships.map((m) => [m.wall_id, m.role as WallMemberRole]));

  const { data: walls } = await supabase
    .from("walls")
    .select("id, title, theme_id, updated_at, is_shared")
    .in("id", wallIds)
    .eq("is_shared", true)
    .order("updated_at", { ascending: false });

  if (!walls) return [];

  const { data: memberCounts } = await supabase
    .from("wall_members")
    .select("wall_id")
    .in("wall_id", wallIds);

  const countByWall = new Map<string, number>();
  for (const row of memberCounts ?? []) {
    countByWall.set(row.wall_id, (countByWall.get(row.wall_id) ?? 0) + 1);
  }

  return walls.map((wall) => ({
    id: wall.id,
    title: wall.title ?? "우리 인생네컷",
    themeId: isWallThemeId(wall.theme_id) ? wall.theme_id : "white",
    updatedAt: wall.updated_at,
    myRole: roleByWall.get(wall.id) ?? "viewer",
    memberCount: countByWall.get(wall.id) ?? 1,
  }));
}

export async function getSharedWallMembers(
  supabase: SupabaseClient,
  wallId: string,
  userId: string,
): Promise<SharedWallMember[]> {
  const role = await getUserWallRole(supabase, wallId, userId);
  if (!role) return [];

  const { data: members } = await supabase
    .from("wall_members")
    .select("id, user_id, role")
    .eq("wall_id", wallId);

  if (!members?.length) return [];

  const userIds = members.map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, { displayName: p.display_name ?? "친구", avatarUrl: p.avatar_url }]),
  );

  return members.map((m) => {
    const profile = profileById.get(m.user_id);
    return {
      id: m.id,
      userId: m.user_id,
      displayName: profile?.displayName ?? "친구",
      avatarUrl: profile?.avatarUrl ?? null,
      role: m.role as WallMemberRole,
    };
  });
}

export async function fetchSharedWallForEdit(
  supabase: SupabaseClient,
  wallId: string,
  userId: string,
): Promise<(PublishedWall & { title: string; myRole: WallMemberRole }) | null> {
  const role = await getUserWallRole(supabase, wallId, userId);
  if (!role || role === "viewer") return null;

  const { data, error } = await supabase
    .from("walls")
    .select("id, title, theme_id, canvas_json, updated_at, is_shared")
    .eq("id", wallId)
    .eq("is_shared", true)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    title: data.title ?? "우리 인생네컷",
    themeId: isWallThemeId(data.theme_id) ? data.theme_id : "white",
    canvasJson: data.canvas_json,
    updatedAt: data.updated_at,
    myRole: role,
  };
}
