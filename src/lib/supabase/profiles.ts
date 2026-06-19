import type { SupabaseClient } from "@supabase/supabase-js";
import type { Friend, Profile } from "@/types/profile";
import { fetchPersonalWallIdForOwner } from "@/lib/supabase/walls";

function generateFriendCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function mapProfile(row: {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  friend_code: string;
  allow_wall_visits?: boolean;
}): Omit<Profile, "wallId"> {
  return {
    id: row.id,
    displayName: row.display_name ?? "친구",
    avatarUrl: row.avatar_url,
    friendCode: row.friend_code,
    allowWallVisits: row.allow_wall_visits ?? false,
  };
}

export async function ensureProfile(
  supabase: SupabaseClient,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
): Promise<Profile | null> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, friend_code, allow_wall_visits")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    const wallId = await fetchPersonalWallIdForOwner(supabase, user.id);
    return { ...mapProfile(existing), wallId };
  }

  const meta = user.user_metadata ?? {};
  const displayName =
    (meta.full_name as string) ??
    (meta.name as string) ??
    user.email?.split("@")[0] ??
    "친구";

  for (let i = 0; i < 5; i++) {
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        display_name: displayName,
        avatar_url: (meta.avatar_url as string) ?? null,
        friend_code: generateFriendCode(),
      })
      .select("id, display_name, avatar_url, friend_code, allow_wall_visits")
      .single();

    if (!error && data) {
      const wallId = await fetchPersonalWallIdForOwner(supabase, user.id);
      return { ...mapProfile(data), wallId };
    }
  }

  return null;
}

export async function getProfileByFriendCode(
  supabase: SupabaseClient,
  friendCode: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, friend_code, allow_wall_visits")
    .eq("friend_code", friendCode.toUpperCase())
    .maybeSingle();

  if (error || !data) return null;

  const wallId = await fetchPersonalWallIdForOwner(supabase, data.id);
  return { ...mapProfile(data), wallId };
}

export async function addFriendship(
  supabase: SupabaseClient,
  userId: string,
  friendId: string,
): Promise<boolean> {
  if (userId === friendId) return false;

  const userA = userId < friendId ? userId : friendId;
  const userB = userId < friendId ? friendId : userId;

  const { error } = await supabase.from("friendships").insert({
    user_a: userA,
    user_b: userB,
  });

  return !error;
}

export async function getFriends(
  supabase: SupabaseClient,
  userId: string,
): Promise<Friend[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("user_a, user_b")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);

  if (error || !data) return [];

  const friendIds = data.map((row) => (row.user_a === userId ? row.user_b : row.user_a));

  if (friendIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, friend_code, allow_wall_visits")
    .in("id", friendIds);

  if (!profiles) return [];

  const friends: Friend[] = [];
  for (const p of profiles) {
    const wallId = await fetchPersonalWallIdForOwner(supabase, p.id);
    const wallVisitable = !!p.allow_wall_visits && !!wallId;
    friends.push({
      ...mapProfile(p),
      wallId,
      wallVisitable,
    });
  }

  return friends;
}

export async function removeFriendship(
  supabase: SupabaseClient,
  userId: string,
  friendId: string,
): Promise<boolean> {
  const userA = userId < friendId ? userId : friendId;
  const userB = userId < friendId ? friendId : userId;

  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("user_a", userA)
    .eq("user_b", userB);

  return !error;
}

export async function updateAllowWallVisits(
  supabase: SupabaseClient,
  userId: string,
  allowWallVisits: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({ allow_wall_visits: allowWallVisits, updated_at: new Date().toISOString() })
    .eq("id", userId);

  return !error;
}
