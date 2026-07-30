import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublishedWall } from "@/types/wall";
import { DEFAULT_WALL_THEME_ID, resolveWallThemeId } from "@/lib/wall-themes";
import { sceneRevisionFromJson } from "@/lib/wall-scene/scene-revision";
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
    .select("id, theme_id, canvas_json, updated_at, preview_path")
    .eq("id", id)
    .eq("is_hidden", false)
    .single();

  if (error || !data) {
    // preview_path 마이그레이션 전 fallback
    if (error?.message?.includes("preview_path")) {
      const legacy = await supabase
        .from("walls")
        .select("id, theme_id, canvas_json, updated_at")
        .eq("id", id)
        .eq("is_hidden", false)
        .single();
      if (legacy.error || !legacy.data) return null;
      return mapRow(legacy.data);
    }
    return null;
  }

  return mapRow(data);
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

/** 개인 벽 저장 — 소유자당 is_shared=false 벽 하나만 upsert */
export type SaveWallResult =
  | { status: "ok"; wall: PublishedWall }
  | { status: "conflict"; currentRevision: number; wall: PublishedWall }
  | { status: "error" };

export async function savePersonalWallToDb(
  wall: {
    id?: string;
    themeId: string;
    canvasJson: object;
    ownerId?: string;
    /** Last known server revision; mismatch → conflict */
    baseRevision?: number;
  },
  supabase: SupabaseClient | null = getSupabaseServer(),
): Promise<SaveWallResult> {
  if (!supabase || !wall.ownerId) return { status: "error" };

  const payload: Record<string, unknown> = {
    theme_id: wall.themeId,
    canvas_json: wall.canvasJson,
    owner_id: wall.ownerId,
    is_shared: false,
    updated_at: new Date().toISOString(),
  };

  const checkConflict = async (
    id: string,
  ): Promise<SaveWallResult | null> => {
    if (typeof wall.baseRevision !== "number") return null;
    const { data: row } = await supabase
      .from("walls")
      .select("id, theme_id, canvas_json, updated_at, preview_path")
      .eq("id", id)
      .eq("owner_id", wall.ownerId!)
      .eq("is_shared", false)
      .maybeSingle();
    if (!row) return null;
    const currentRevision = sceneRevisionFromJson(row.canvas_json);
    if (currentRevision !== wall.baseRevision) {
      return {
        status: "conflict",
        currentRevision,
        wall: mapRow(row),
      };
    }
    return null;
  };

  const updateById = async (id: string): Promise<SaveWallResult> => {
    const conflict = await checkConflict(id);
    if (conflict) return conflict;

    const { data, error } = await supabase
      .from("walls")
      .update(payload)
      .eq("id", id)
      .eq("owner_id", wall.ownerId!)
      .eq("is_shared", false)
      .select("id, theme_id, canvas_json, updated_at")
      .maybeSingle();

    if (error || !data) return { status: "error" };
    return { status: "ok", wall: mapRow(data) };
  };

  // 1) Client id가 내 개인 벽이면 그 행을 갱신
  if (wall.id) {
    const { data: byId } = await supabase
      .from("walls")
      .select("id, is_shared, owner_id")
      .eq("id", wall.id)
      .maybeSingle();

    if (byId?.is_shared) return { status: "error" };

    if (byId && byId.owner_id === wall.ownerId) {
      return updateById(byId.id);
    }
  }

  // 2) 이미 개인 벽이 있으면(가장 최근) 그 벽을 갱신 — 중복 INSERT 방지
  const { data: existingPersonal } = await supabase
    .from("walls")
    .select("id")
    .eq("owner_id", wall.ownerId)
    .eq("is_shared", false)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingPersonal) {
    return updateById(existingPersonal.id);
  }

  // 3) 첫 개인 벽만 INSERT (가능하면 클라이언트가 준 id 유지)
  const insertRow =
    wall.id && isWallUuid(wall.id) ? { ...payload, id: wall.id } : payload;

  const { data: inserted, error: insertError } = await supabase
    .from("walls")
    .insert(insertRow)
    .select("id, theme_id, canvas_json, updated_at")
    .single();

  if (insertError || !inserted) return { status: "error" };
  return { status: "ok", wall: mapRow(inserted) };
}

function isWallUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

/** 공동 벽 저장 — wall_members 권한 있는 is_shared=true 벽만 수정 */
export async function saveSharedWallToDb(
  wallId: string,
  wall: {
    themeId: string;
    canvasJson: object;
    userId: string;
    baseRevision?: number;
  },
  supabase: SupabaseClient | null = getSupabaseServer(),
): Promise<SaveWallResult> {
  if (!supabase) return { status: "error" };

  const allowed = await canEditWall(supabase, wallId, wall.userId);
  if (!allowed) return { status: "error" };

  const { data: existing } = await supabase
    .from("walls")
    .select("id, is_shared, theme_id, canvas_json, updated_at, preview_path")
    .eq("id", wallId)
    .maybeSingle();

  if (!existing?.is_shared) return { status: "error" };

  if (typeof wall.baseRevision === "number") {
    const currentRevision = sceneRevisionFromJson(existing.canvas_json);
    if (currentRevision !== wall.baseRevision) {
      return {
        status: "conflict",
        currentRevision,
        wall: mapRow(existing),
      };
    }
  }

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

  if (error || !data) return { status: "error" };
  return { status: "ok", wall: mapRow(data) };
}

function mapRow(data: {
  id: string;
  theme_id: string;
  canvas_json: object;
  updated_at: string;
  preview_path?: string | null;
}): PublishedWall {
  return {
    id: data.id,
    themeId: resolveWallThemeId(data.theme_id),
    canvasJson: data.canvas_json,
    updatedAt: data.updated_at,
    previewPath: data.preview_path ?? null,
  };
}
