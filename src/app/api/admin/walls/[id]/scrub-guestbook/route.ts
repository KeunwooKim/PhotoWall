import { NextResponse, type NextRequest } from "next/server";
import {
  requireAdminRoute,
  serviceRoleRequiredResponse,
} from "@/lib/admin/require-admin-route";
import { scrubWallGuestbook } from "@/lib/guestbook";

/** POST — scrub guestbook embeds + delete all guestbook rows for a wall. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id: wallId } = await params;
  const { admin, applyCookies, hasServiceRole } = auth.ctx;
  if (!hasServiceRole) return serviceRoleRequiredResponse(applyCookies);

  let includeUnmarkedDataUrls = false;
  try {
    const body = (await request.json()) as { includeUnmarkedDataUrls?: boolean };
    includeUnmarkedDataUrls = !!body.includeUnmarkedDataUrls;
  } catch {
    /* empty */
  }

  try {
    const result = await scrubWallGuestbook(admin, wallId, {
      includeUnmarkedDataUrls,
      deleteRows: true,
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
