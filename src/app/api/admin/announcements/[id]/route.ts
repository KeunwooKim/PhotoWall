import { NextResponse, type NextRequest } from "next/server";
import { mapAnnouncement } from "@/lib/announcements-server";
import { adminDbErrorResponse, requireAdminRoute } from "@/lib/admin/require-admin-route";
import type { AnnouncementSeverity, AnnouncementTarget } from "@/types/announcement";

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
    message?: string;
    severity?: AnnouncementSeverity;
    target?: AnnouncementTarget;
    active?: boolean;
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
  if (body.message !== undefined) patch.message = body.message.trim();
  if (body.severity !== undefined) patch.severity = body.severity;
  if (body.target !== undefined) patch.target = body.target;
  if (body.active !== undefined) patch.active = body.active;
  if (body.startsAt !== undefined) patch.starts_at = body.startsAt;
  if (body.endsAt !== undefined) patch.ends_at = body.endsAt;

  const { data, error } = await admin
    .from("announcements")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return adminDbErrorResponse(applyCookies, error, "공지 수정 실패");
  }

  return applyCookies(NextResponse.json(mapAnnouncement(data)));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { admin, applyCookies } = auth.ctx;

  const { error } = await admin.from("announcements").delete().eq("id", id);

  if (error) {
    return adminDbErrorResponse(applyCookies, error, "공지 삭제 실패");
  }

  return applyCookies(NextResponse.json({ ok: true }));
}
