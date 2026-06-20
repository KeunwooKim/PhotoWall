import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute, adminDbErrorResponse } from "@/lib/admin/require-admin-route";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { admin, applyCookies } = auth.ctx;

  const { error } = await admin.from("wall_comments").delete().eq("id", id);

  if (error) {
    return adminDbErrorResponse(applyCookies, error, "댓글 삭제에 실패했어요");
  }

  return applyCookies(NextResponse.json({ ok: true }));
}
