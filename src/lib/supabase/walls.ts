import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublishedWall } from "@/types/wall";
import { DEFAULT_WALL_THEME_ID, resolveWallThemeId } from "@/lib/wall-themes";
import { getSupabaseEnv } from "./env";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { canEditWall } from "./wall-role";

export function getSupabaseServer(): SupabaseClient | null {
  const { url, key } = getSupabaseEnv();
  if (!url || !key) return null;
  return createSupabaseClient(url, key);
}

export async function fetchWallFromDb(
  id: string,
  supabase: SupabaseClient | null = getSupabaseServer(),
): Promise<PublishedWall | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("walls")
    .select("id, theme_id, canvas_json, updated_at")
    .eq("id", id)
    .eq("is_hidden", false)
    .single();

  if (error || !data) return null;

  const themeId = resolveWallThemeId(data.theme_id);

  return {
    id: data.id,
    themeId,
    canvasJson: data.canvas_json,
    updatedAt: data.updated_at,
  };
}

/** 개인 벽만 조회 (공동 벽 제외) */
export async function fetchPersonalWallForOwner(
  ownerId: string,
  supabase: SupabaseClient,
): Promise<PublishedWall | null> {
  const { data, error } = await supabase
    .from("walls")
    .select("id, theme_id, canvas_json, updated_at")
    .eq("owner_id", ownerId)
    .eq("is_shared", false)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data);
}

/** 개인 벽 ID만 (친구 벽 방문용) */
export async function fetchPersonalWallIdForOwner(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("walls")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("is_shared", false)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

/** 개인 벽 저장 — is_shared=false 벽만 생성·수정 */
export async function savePersonalWallToDb(
  wall: {
    id?: string;
    themeId: string;
    canvasJson: object;
    ownerId?: string;
  },
  supabase: SupabaseClient | null = getSupabaseServer(),
): Promise<PublishedWall | null> {
  if (!supabase || !wall.ownerId) return null;

  const payload: Record<string, unknown> = {
    theme_id: wall.themeId,
    canvas_json: wall.canvasJson,
    owner_id: wall.ownerId,
    is_shared: false,
    updated_at: new Date().toISOString(),
  };

  if (wall.id) {
    const { data: existing } = await supabase
      .from("walls")
      .select("id, is_shared, owner_id")
      .eq("id", wall.id)
      .maybeSingle();

    if (existing?.is_shared) {
      return null;
    }

    if (existing) {
      const { data, error } = await supabase
        .from("walls")
        .update(payload)
        .eq("id", wall.id)
        .eq("is_shared", false)
        .select("id, theme_id, canvas_json, updated_at")
        .single();

      if (!error && data) return mapRow(data);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("walls")
      .insert(payload)
      .select("id, theme_id, canvas_json, updated_at")
      .single();

    if (!insertError && inserted) return mapRow(inserted);
    return null;
  }

  const { data, error } = await supabase
    .from("walls")
    .insert(payload)
    .select("id, theme_id, canvas_json, updated_at")
    .single();

  if (error || !data) return null;
  return mapRow(data);
}

/** 공동 벽 저장 — wall_members 권한 있는 is_shared=true 벽만 수정 */
export async function saveSharedWallToDb(
  wallId: string,
  wall: {
    themeId: string;
    canvasJson: object;
    userId: string;
  },
  supabase: SupabaseClient | null = getSupabaseServer(),
): Promise<PublishedWall | null> {
  if (!supabase) return null;

  const allowed = await canEditWall(supabase, wallId, wall.userId);
  if (!allowed) return null;

  const { data: existing } = await supabase
    .from("walls")
    .select("id, is_shared")
    .eq("id", wallId)
    .maybeSingle();

  if (!existing?.is_shared) return null;

  const { data, error } = await supabase
    .from("walls")
    .update({
      theme_id: wall.themeId,
      canvas_json: wall.canvasJson,
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallId)
    .eq("is_shared", true)
    .select("id, theme_id, canvas_json, updated_at")
    .single();

  if (error || !data) return null;
  return mapRow(data);
}

function mapRow(data: {
  id: string;
  theme_id: string;
  canvas_json: object;
  updated_at: string;
}): PublishedWall {
  return {
    id: data.id,
    themeId: resolveWallThemeId(data.theme_id),
    canvasJson: data.canvas_json,
    updatedAt: data.updated_at,
  };
}
