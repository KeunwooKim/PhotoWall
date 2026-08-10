import { NextResponse, type NextRequest } from "next/server";
import {
  requireAdminRoute,
  adminDbErrorResponse,
  serviceRoleRequiredResponse,
} from "@/lib/admin/require-admin-route";
import { scrubWallGuestbook } from "@/lib/guestbook";

/**
 * Deletes the guestbook DB row only by default.
 * Query scrubCanvas=1 also removes marked guestbook photos (and optionally data: URLs) from the wall.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { admin, applyCookies, hasServiceRole } = auth.ctx;
  const scrubCanvas = request.nextUrl.searchParams.get("scrubCanvas") === "1";
  const includeDataUrls = request.nextUrl.searchParams.get("includeDataUrls") === "1";

  if (scrubCanvas) {
    if (!hasServiceRole) return serviceRoleRequiredResponse(applyCookies);

    const { data: row } = await admin
      .from("wall_guestbook")
      .select("id, wall_id")
      .eq("id", id)
      .maybeSingle();

    if (!row?.wall_id) {
      return applyCookies(NextResponse.json({ error: "Not found" }, { status: 404 }));
    }

    try {
      // Delete this row, then scrub marked guestbook photos on the wall
      await admin.from("wall_guestbook").delete().eq("id", id);
      const result = await scrubWallGuestbook(admin, row.wall_id as string, {
        includeUnmarkedDataUrls: includeDataUrls,
        deleteRows: false,
      });
      return applyCookies(NextResponse.json({ ok: true, ...result }));
    } catch (err) {
      return applyCookies(
        NextResponse.json(
          { error: err instanceof Error ? err.message : "스크럽 실패" },
          { status: 500 },
        ),
      );
    }
  }

  const { error } = await admin.from("wall_guestbook").delete().eq("id", id);

  if (error) {
    return adminDbErrorResponse(applyCookies, error, "방명록 삭제에 실패했어요");
  }

  return applyCookies(NextResponse.json({ ok: true }));
}
