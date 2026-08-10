import { NextResponse, type NextRequest } from "next/server";
import { mapEventPost } from "@/lib/event-posts-server";
import { adminDbErrorResponse, requireAdminRoute } from "@/lib/admin/require-admin-route";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { admin, applyCookies } = auth.ctx;

  let body: {
    title?: string;
    body?: string;
    imageUrl?: string | null;
    href?: string | null;
    ctaLabel?: string;
    active?: boolean;
    sortOrder?: number;
    startsAt?: string | null;
    endsAt?: string | null;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return applyCookies(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }));
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) patch.title = body.title.trim();
  if (body.body !== undefined) patch.body = body.body.trim();
  if (body.imageUrl !== undefined) patch.image_url = body.imageUrl?.trim() || null;
  if (body.href !== undefined) patch.href = body.href?.trim() || null;
  if (body.ctaLabel !== undefined) patch.cta_label = body.ctaLabel.trim() || "자세히";
  if (body.active !== undefined) patch.active = body.active;
  if (body.sortOrder !== undefined) patch.sort_order = body.sortOrder;
  if (body.startsAt !== undefined) patch.starts_at = body.startsAt;
  if (body.endsAt !== undefined) patch.ends_at = body.endsAt;

  const { data, error } = await admin
    .from("event_posts")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return adminDbErrorResponse(applyCookies, error, "이벤트 수정 실패");
  }

  return applyCookies(NextResponse.json(mapEventPost(data)));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { admin, applyCookies } = auth.ctx;

  const { error } = await admin.from("event_posts").delete().eq("id", id);

  if (error) {
    return adminDbErrorResponse(applyCookies, error, "이벤트 삭제 실패");
  }

  return applyCookies(NextResponse.json({ ok: true }));
}
