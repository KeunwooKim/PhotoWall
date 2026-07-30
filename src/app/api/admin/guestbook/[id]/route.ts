import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute, adminDbErrorResponse } from "@/lib/admin/require-admin-route";

/**
 * Deletes the guestbook DB row only.
 * Embedded canvas guestbook photos are not linked by id, so they may remain on the wall
 * until the wall is edited/hidden — prefer wall hide for visual spam.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { admin, applyCookies } = auth.ctx;

  const { error } = await admin.from("wall_guestbook").delete().eq("id", id);

  if (error) {
    return adminDbErrorResponse(applyCookies, error, "방명록 삭제에 실패했어요");
  }

  return applyCookies(NextResponse.json({ ok: true }));
}
