import { NextResponse, type NextRequest } from "next/server";
import {
  requireAdminRoute,
  serviceRoleRequiredResponse,
} from "@/lib/admin/require-admin-route";
import {
  removeStoragePaths,
  scanOrphanWallPhotos,
} from "@/lib/storage/orphan-sweep";

/** GET — dry-run scan of orphan wall-photos. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;
  const { admin, applyCookies, hasServiceRole } = auth.ctx;
  if (!hasServiceRole) return serviceRoleRequiredResponse(applyCookies);

  try {
    const result = await scanOrphanWallPhotos(admin);
    return applyCookies(NextResponse.json(result));
  } catch (err) {
    return applyCookies(
      NextResponse.json(
        { error: err instanceof Error ? err.message : "스캔 실패" },
        { status: 500 },
      ),
    );
  }
}

/** DELETE — purge orphans. Body: { confirm: "PURGE", limit?: number } */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;
  const { admin, applyCookies, hasServiceRole } = auth.ctx;
  if (!hasServiceRole) return serviceRoleRequiredResponse(applyCookies);

  let body: { confirm?: string; limit?: number } = {};
  try {
    body = (await request.json()) as { confirm?: string; limit?: number };
  } catch {
    /* empty */
  }

  if (body.confirm !== "PURGE") {
    return applyCookies(
      NextResponse.json({ error: 'confirm: "PURGE" 가 필요해요' }, { status: 400 }),
    );
  }

  try {
    const scan = await scanOrphanWallPhotos(admin);
    const limit = Math.min(Math.max(body.limit ?? 500, 1), 2000);
    const toDelete = scan.orphans.slice(0, limit).map((o) => o.path);
    const removed = await removeStoragePaths(admin, toDelete);
    return applyCookies(
      NextResponse.json({
        removed,
        orphanCount: scan.orphanCount,
        totalFiles: scan.totalFiles,
      }),
    );
  } catch (err) {
    return applyCookies(
      NextResponse.json(
        { error: err instanceof Error ? err.message : "삭제 실패" },
        { status: 500 },
      ),
    );
  }
}
