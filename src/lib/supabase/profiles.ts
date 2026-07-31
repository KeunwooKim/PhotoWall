import type { SupabaseClient } from "@supabase/supabase-js";
import type { Friend, Profile } from "@/types/profile";
import { parseUserPlan } from "@/lib/auth/user-plan";
import {
  fetchPersonalWallIdForOwner,
  fetchPersonalWallMetaForOwner,
} from "@/lib/supabase/walls";
import { notifyNewUser } from "@/lib/discord/notify";
import {
  parseColorPalette,
  parseThemeMode,
  type ColorPaletteId,
  type ThemeMode,
} from "@/lib/settings-storage";

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
  plan?: string | null;
  theme_mode?: string | null;
  color_palette?: string | null;
  legal_consented_at?: string | null;
  legal_version?: string | null;
}): Omit<Profile, "wallId" | "wallTitle"> {
  return {
    id: row.id,
    displayName: row.display_name ?? "친구",
    avatarUrl: row.avatar_url,
    friendCode: row.friend_code,
    allowWallVisits: row.allow_wall_visits ?? false,
    plan: parseUserPlan(row.plan),
    themeMode: parseThemeMode(row.theme_mode),
    colorPalette: parseColorPalette(row.color_palette),
    legalConsentedAt: row.legal_consented_at ?? null,
    legalVersion: row.legal_version ?? null,
  };
}

async function withWallMeta(
  supabase: SupabaseClient,
  base: Omit<Profile, "wallId" | "wallTitle">,
): Promise<Profile> {
  const meta = await fetchPersonalWallMetaForOwner(supabase, base.id);
  return {
    ...base,
    wallId: meta?.id ?? null,
    wallTitle: meta?.title ?? null,
  };
}

const PROFILE_SELECT =
  "id, display_name, avatar_url, friend_code, allow_wall_visits, plan, theme_mode, color_palette, legal_consented_at, legal_version";

const PROFILE_SELECT_LEGACY =
  "id, display_name, avatar_url, friend_code, allow_wall_visits, plan, legal_consented_at, legal_version";

function isMissingColumnError(message: string | undefined, column: string): boolean {
  return !!message && message.includes(column);
}

export async function ensureProfile(
  supabase: SupabaseClient,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
): Promise<Profile | null> {
  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (
    existingError &&
    (isMissingColumnError(existingError.message, "theme_mode") ||
      isMissingColumnError(existingError.message, "color_palette") ||
      isMissingColumnError(existingError.message, "plan"))
  ) {
    if (isMissingColumnError(existingError.message, "plan")) {
      const legacy = await supabase
        .from("profiles")
        .select(
          "id, display_name, avatar_url, friend_code, allow_wall_visits, legal_consented_at, legal_version",
        )
        .eq("id", user.id)
        .maybeSingle();
      if (legacy.data) {
        return withWallMeta(supabase, mapProfile(legacy.data));
      }
    } else {
      const legacy = await supabase
        .from("profiles")
        .select(PROFILE_SELECT_LEGACY)
        .eq("id", user.id)
        .maybeSingle();
      if (legacy.data) {
        return withWallMeta(supabase, mapProfile(legacy.data));
      }
    }
  } else if (existing) {
    return withWallMeta(supabase, mapProfile(existing));
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
      .select(PROFILE_SELECT)
      .single();

    if (!error && data) {
      notifyNewUser({
        displayName: data.display_name ?? displayName,
        userId: data.id,
      });
      return withWallMeta(supabase, mapProfile(data));
    }

    if (
      error?.message?.includes("plan") ||
      error?.message?.includes("theme_mode") ||
      error?.message?.includes("color_palette")
    ) {
      const legacyInsert = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          display_name: displayName,
          avatar_url: (meta.avatar_url as string) ?? null,
          friend_code: generateFriendCode(),
        })
        .select(
          "id, display_name, avatar_url, friend_code, allow_wall_visits, legal_consented_at, legal_version",
        )
        .single();
      if (!legacyInsert.error && legacyInsert.data) {
        notifyNewUser({
          displayName: legacyInsert.data.display_name ?? displayName,
          userId: legacyInsert.data.id,
        });
        return withWallMeta(supabase, mapProfile(legacyInsert.data));
      }
    }
  }

  return null;
}

export async function saveLegalConsent(
  supabase: SupabaseClient,
  userId: string,
  input: { consentedAt: string; version: string },
): Promise<Profile | null> {
  await ensureProfile(supabase, { id: userId });

  // Keep the earliest consent time for this version; refresh version if newer policy
  const { data: current } = await supabase
    .from("profiles")
    .select("legal_consented_at, legal_version")
    .eq("id", userId)
    .maybeSingle();

  const sameVersion = current?.legal_version === input.version;
  const consentedAt =
    sameVersion && current?.legal_consented_at
      ? current.legal_consented_at
      : input.consentedAt;

  const { data, error } = await supabase
    .from("profiles")
    .update({
      legal_consented_at: consentedAt,
      legal_version: input.version,
    })
    .eq("id", userId)
    .select(PROFILE_SELECT)
    .single();

  if (error || !data) return null;

  return withWallMeta(supabase, mapProfile(data));
}

export async function getProfileByFriendCode(
  supabase: SupabaseClient,
  friendCode: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("friend_code", friendCode.toUpperCase())
    .maybeSingle();

  if (error || !data) return null;

  return withWallMeta(supabase, mapProfile(data));
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
    const mapped = mapProfile(p);
    friends.push({
      id: mapped.id,
      displayName: mapped.displayName,
      avatarUrl: mapped.avatarUrl,
      friendCode: mapped.friendCode,
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

export async function updateDisplayName(
  supabase: SupabaseClient,
  userId: string,
  displayName: string,
): Promise<boolean> {
  const trimmed = displayName.trim().slice(0, 40);
  if (!trimmed) return false;

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", userId);

  return !error;
}

export async function updateThemePreferences(
  supabase: SupabaseClient,
  userId: string,
  prefs: { themeMode?: ThemeMode; colorPalette?: ColorPaletteId },
): Promise<boolean> {
  const patch: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };
  if (prefs.themeMode) patch.theme_mode = prefs.themeMode;
  if (prefs.colorPalette) patch.color_palette = prefs.colorPalette;
  if (!prefs.themeMode && !prefs.colorPalette) return false;

  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  return !error;
}
