import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/admin/require-admin-route";

type WallRow = {
  id: string;
  theme_id: string;
  owner_id: string | null;
  title: string | null;
  is_shared: boolean;
  is_hidden?: boolean;
  created_at: string;
  updated_at: string;
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
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { admin, applyCookies } = auth.ctx;
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const filter = request.nextUrl.searchParams.get("filter");

  let query = admin
    .from("walls")
    .select("id, theme_id, owner_id, title, is_shared, is_hidden, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);

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

  const { data, error } = await query;

  // admin-inquiries-migration.sql 미실행 시 is_hidden 컬럼 없음
  if (error?.message?.includes("is_hidden")) {
    let fallbackQuery = admin
      .from("walls")
      .select("id, theme_id, owner_id, title, is_shared, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (filter === "orphan") fallbackQuery = fallbackQuery.is("owner_id", null);
    else if (filter === "shared") fallbackQuery = fallbackQuery.eq("is_shared", true);
    else if (filter === "hidden") {
      return applyCookies(NextResponse.json([]));
    }

    if (q) {
      const uuidPattern = /^[0-9a-f-]{36}$/i;
      if (uuidPattern.test(q)) fallbackQuery = fallbackQuery.eq("id", q);
      else fallbackQuery = fallbackQuery.ilike("title", `%${q}%`);
    }

    const fallback = await fallbackQuery;
    return applyCookies(NextResponse.json((fallback.data ?? []).map(mapWall)));
  }

  if (error) {
    return applyCookies(
      NextResponse.json({ error: error.message || "Failed to load walls" }, { status: 500 }),
    );
  }

  return applyCookies(NextResponse.json((data ?? []).map(mapWall)));
}
