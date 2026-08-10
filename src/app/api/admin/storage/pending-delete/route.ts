import { NextResponse, type NextRequest } from "next/server";
import {
  requireAdminRoute,
  serviceRoleRequiredResponse,
} from "@/lib/admin/require-admin-route";
import {
  countPendingDeletes,
  processDuePendingDeletes,
} from "@/lib/storage/pending-delete";

/** GET — pending GC queue counts */
export async function GET(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;
  const { admin, applyCookies, hasServiceRole } = auth.ctx;
  if (!hasServiceRole) return serviceRoleRequiredResponse(applyCookies);

  const counts = await countPendingDeletes(admin);
  if (!counts) {
    return applyCookies(
      NextResponse.json(
        { error: "storage_pending_delete 테이블이 없어요. migration을 실행하세요." },
        { status: 503 },
      ),
    );
  }
  return applyCookies(NextResponse.json(counts));
}

/** POST — process due rows now */
export async function POST(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;
  const { admin, applyCookies, hasServiceRole } = auth.ctx;
  if (!hasServiceRole) return serviceRoleRequiredResponse(applyCookies);

  try {
    const result = await processDuePendingDeletes(admin, 500);
    return applyCookies(NextResponse.json({ ok: true, ...result }));
  } catch (err) {
    return applyCookies(
      NextResponse.json(
        { error: err instanceof Error ? err.message : "처리 실패" },
        { status: 500 },
      ),
    );
  }
}
