import { getSupabaseServer } from "@/lib/supabase/walls";
import { appendGuestbookPhoto } from "@/lib/guestbook";
import type { WallComment, WallInvite, WallLikesSummary } from "@/types/social";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function getWallLikes(
  wallId: string,
  visitorId: string,
  userId?: string | null,
): Promise<WallLikesSummary | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { count, error } = await supabase
    .from("wall_likes")
    .select("*", { count: "exact", head: true })
    .eq("wall_id", wallId);

  if (error) return null;

  let likedByMe = false;

  if (userId) {
    const { data: myLike } = await supabase
      .from("wall_likes")
      .select("id")
      .eq("wall_id", wallId)
      .eq("user_id", userId)
      .maybeSingle();
    likedByMe = !!myLike;
  } else {
    const { data: myLike } = await supabase
      .from("wall_likes")
      .select("id")
      .eq("wall_id", wallId)
      .eq("visitor_id", visitorId)
      .maybeSingle();
    likedByMe = !!myLike;
  }

  return {
    count: count ?? 0,
    likedByMe,
  };
}

export async function toggleWallLike(
  wallId: string,
  visitorId: string,
  userId?: string | null,
): Promise<WallLikesSummary | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  if (userId) {
    const { data: existing } = await supabase
      .from("wall_likes")
      .select("id")
      .eq("wall_id", wallId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase.from("wall_likes").delete().eq("id", existing.id);
    } else {
      await supabase.from("wall_likes").insert({
        wall_id: wallId,
        visitor_id: visitorId,
        user_id: userId,
      });
    }
  } else {
    const { data: existing } = await supabase
      .from("wall_likes")
      .select("id")
      .eq("wall_id", wallId)
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (existing) {
      await supabase.from("wall_likes").delete().eq("id", existing.id);
    } else {
      await supabase.from("wall_likes").insert({ wall_id: wallId, visitor_id: visitorId });
    }
  }

  return getWallLikes(wallId, visitorId, userId);
}

export async function getWallComments(wallId: string): Promise<WallComment[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("wall_comments")
    .select("id, wall_id, author_name, body, created_at")
    .eq("wall_id", wallId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    wallId: row.wall_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  }));
}

export async function addWallComment(
  wallId: string,
  authorName: string,
  body: string,
  userId?: string | null,
): Promise<WallComment | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const trimmed = body.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from("wall_comments")
    .insert({
      wall_id: wallId,
      author_name: authorName.trim() || "익명",
      body: trimmed.slice(0, 500),
      ...(userId ? { user_id: userId } : {}),
    })
    .select("id, wall_id, author_name, body, created_at")
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    wallId: data.wall_id,
    authorName: data.author_name,
    body: data.body,
    createdAt: data.created_at,
  };
}

export async function addGuestbookPhoto(
  wallId: string,
  authorName: string,
  imageDataUrl: string,
  imageWidth: number,
  imageHeight: number,
  userId?: string | null,
): Promise<{ canvasJson: object } | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { data: wall, error: fetchError } = await supabase
    .from("walls")
    .select("canvas_json")
    .eq("id", wallId)
    .single();

  if (fetchError || !wall) return null;

  const updatedCanvas = appendGuestbookPhoto(
    wall.canvas_json as object,
    imageDataUrl,
    imageWidth,
    imageHeight,
  );

  const { error: updateError } = await supabase
    .from("walls")
    .update({
      canvas_json: updatedCanvas,
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallId);

  if (updateError) return null;

  await supabase.from("wall_guestbook").insert({
    wall_id: wallId,
    author_name: authorName.trim() || "익명",
    ...(userId ? { user_id: userId } : {}),
  });

  return { canvasJson: updatedCanvas };
}

export async function createInvite(wallId: string): Promise<WallInvite | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const { data, error } = await supabase
      .from("wall_invites")
      .insert({ wall_id: wallId, code })
      .select("id, wall_id, code, created_at")
      .single();

    if (!error && data) {
      return {
        id: data.id,
        wallId: data.wall_id,
        code: data.code,
        createdAt: data.created_at,
      };
    }
  }

  return null;
}

export async function getInviteByCode(code: string): Promise<WallInvite | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("wall_invites")
    .select("id, wall_id, code, created_at")
    .eq("code", code.toUpperCase())
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    wallId: data.wall_id,
    code: data.code,
    createdAt: data.created_at,
  };
}
