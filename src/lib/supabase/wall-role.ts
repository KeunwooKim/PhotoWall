import type { SupabaseClient } from "@supabase/supabase-js";
import type { WallMemberRole } from "@/types/shared-wall";

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

/** Owner + wall_members — used to sign peer uploads before autosave lands in canvas_json. */
export async function listWallCollaboratorUserIds(
  supabase: SupabaseClient,
  wallId: string,
): Promise<Set<string>> {
  const ids = new Set<string>();

  const { data: wall } = await supabase
    .from("walls")
    .select("owner_id")
    .eq("id", wallId)
    .maybeSingle();

  if (wall?.owner_id) ids.add(wall.owner_id);

  const { data: members } = await supabase
    .from("wall_members")
    .select("user_id")
    .eq("wall_id", wallId);

  for (const row of members ?? []) {
    if (row.user_id) ids.add(row.user_id);
  }

  return ids;
}
