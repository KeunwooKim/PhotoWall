import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute, adminDbErrorResponse } from "@/lib/admin/require-admin-route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { admin, applyCookies } = auth.ctx;

  let wallRes = await admin
    .from("walls")
    .select("id, theme_id, owner_id, title, is_shared, is_hidden, created_at, updated_at")
    .eq("id", id)
    .single();

  if (wallRes.error?.message?.includes("is_hidden")) {
    wallRes = await admin
      .from("walls")
      .select("id, theme_id, owner_id, title, is_shared, created_at, updated_at")
      .eq("id", id)
      .single();
  }

  const [commentsRes, guestbookRes] = await Promise.all([
    admin
      .from("wall_comments")
      .select("id, author_name, body, created_at")
      .eq("wall_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("wall_guestbook")
      .select("id, author_name, created_at")
      .eq("wall_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (wallRes.error || !wallRes.data) {
    return applyCookies(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  const row = wallRes.data as {
    id: string;
    theme_id: string;
    owner_id: string | null;
    title: string | null;
    is_shared: boolean;
    is_hidden?: boolean;
    created_at: string;
    updated_at: string;
  };

  return applyCookies(
    NextResponse.json({
      wall: {
        id: row.id,
        themeId: row.theme_id,
        ownerId: row.owner_id,
        title: row.title,
        isShared: row.is_shared,
        isHidden: row.is_hidden ?? false,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      comments: commentsRes.data ?? [],
      guestbook: guestbookRes.data ?? [],
    }),
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { admin, applyCookies } = auth.ctx;

  const body = (await request.json()) as { isHidden?: boolean };

  if (typeof body.isHidden !== "boolean") {
    return applyCookies(NextResponse.json({ error: "isHidden boolean required" }, { status: 400 }));
  }

  const { data, error } = await admin
    .from("walls")
    .update({ is_hidden: body.isHidden, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, is_hidden")
    .single();

  if (error || !data) {
    return adminDbErrorResponse(applyCookies, error ?? {}, "벽 상태 변경에 실패했어요");
  }

  return applyCookies(NextResponse.json({ id: data.id, isHidden: data.is_hidden }));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { admin, applyCookies } = auth.ctx;

  const { error } = await admin.from("walls").delete().eq("id", id);

  if (error) {
    return adminDbErrorResponse(applyCookies, error, "벽 삭제에 실패했어요");
  }

  return applyCookies(NextResponse.json({ ok: true }));
}
