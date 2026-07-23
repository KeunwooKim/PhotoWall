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
