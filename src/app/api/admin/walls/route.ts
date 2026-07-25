import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/admin/require-admin-route";
import { countWallSceneObjects, isEmptyWallCanvas } from "@/lib/admin/wall-canvas-inspect";

type WallRow = {
  id: string;
  theme_id: string;
  owner_id: string | null;
  title: string | null;
  is_shared: boolean;
  is_hidden?: boolean;
  created_at: string;
  updated_at: string;
  canvas_json?: unknown;
  preview_path?: string | null;
};

function mapWall(row: WallRow) {
  return {
    id: row.id,
    themeId: row.theme_id,
    ownerId: row.owner_id,
    title: row.title,
    isShared: row.is_shared,
    isHidden: row.is_hidden ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    previewPath: row.preview_path ?? null,
    objectCount:
      row.canvas_json !== undefined ? countWallSceneObjects(row.canvas_json) : undefined,
  };
}

function applyListFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filter: string | null,
  q: string | undefined,
) {
  if (filter === "orphan") {
    query = query.is("owner_id", null);
  } else if (filter === "hidden") {
    query = query.eq("is_hidden", true);
  } else if (filter === "shared") {
    query = query.eq("is_shared", true);
  }

  if (q) {
    const uuidPattern = /^[0-9a-f-]{36}$/i;
    if (uuidPattern.test(q)) {
      query = query.eq("id", q);
    } else {
      query = query.ilike("title", `%${q}%`);
    }
  }

  return query;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { admin, applyCookies } = auth.ctx;
  const q = request.nextUrl.searchParams.get("q")?.trim() || undefined;
  const filter = request.nextUrl.searchParams.get("filter");
  const limit = filter === "empty" ? 200 : 50;

  const selectWithCanvas =
    "id, theme_id, owner_id, title, is_shared, is_hidden, created_at, updated_at, canvas_json, preview_path";
  const selectNoPreview =
    "id, theme_id, owner_id, title, is_shared, is_hidden, created_at, updated_at, canvas_json";
  const selectBasic =
    "id, theme_id, owner_id, title, is_shared, is_hidden, created_at, updated_at";
  const selectLegacy =
    "id, theme_id, owner_id, title, is_shared, created_at, updated_at, canvas_json";

  let query = applyListFilters(
    admin.from("walls").select(selectWithCanvas).order("updated_at", { ascending: false }).limit(limit),
    filter,
    q,
  );

  let result = await query;
  let rows = (result.data ?? []) as WallRow[];
  let error = result.error;

  if (error?.message?.includes("preview_path")) {
    query = applyListFilters(
      admin.from("walls").select(selectNoPreview).order("updated_at", { ascending: false }).limit(limit),
      filter,
      q,
    );
    result = await query;
    rows = (result.data ?? []) as WallRow[];
    error = result.error;
  }

  if (error?.message?.includes("is_hidden")) {
    if (filter === "hidden") {
      return applyCookies(NextResponse.json([]));
    }
    let legacy = admin
      .from("walls")
      .select(selectLegacy)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (filter === "orphan") legacy = legacy.is("owner_id", null);
    else if (filter === "shared") legacy = legacy.eq("is_shared", true);
    if (q) {
      const uuidPattern = /^[0-9a-f-]{36}$/i;
      if (uuidPattern.test(q)) legacy = legacy.eq("id", q);
      else legacy = legacy.ilike("title", `%${q}%`);
    }
    const fallback = await legacy;
    if (fallback.error) {
      return applyCookies(
        NextResponse.json(
          { error: fallback.error.message || "Failed to load walls" },
          { status: 500 },
        ),
      );
    }
    rows = (fallback.data ?? []) as WallRow[];
    error = null;
  }

  if (error?.message?.includes("canvas_json")) {
    query = applyListFilters(
      admin.from("walls").select(selectBasic).order("updated_at", { ascending: false }).limit(limit),
      filter,
      q,
    );
    result = await query;
    rows = (result.data ?? []) as WallRow[];
    error = result.error;
  }

  if (error) {
    return applyCookies(
      NextResponse.json({ error: error.message || "Failed to load walls" }, { status: 500 }),
    );
  }

  if (filter === "empty") {
    rows = rows.filter((row) => isEmptyWallCanvas(row.canvas_json));
  }

  return applyCookies(NextResponse.json(rows.map(mapWall)));
}
