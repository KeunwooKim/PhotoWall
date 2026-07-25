import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute, adminDbErrorResponse } from "@/lib/admin/require-admin-route";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { admin, applyCookies } = auth.ctx;
  const body = (await request.json()) as { restricted?: boolean; reason?: string };

  if (typeof body.restricted !== "boolean") {
    return applyCookies(
      NextResponse.json({ error: "restricted boolean required" }, { status: 400 }),
    );
  }

  const payload = body.restricted
    ? {
        restricted_at: new Date().toISOString(),
        restrict_reason: body.reason?.trim() || "관리자에 의한 제한",
        updated_at: new Date().toISOString(),
      }
    : {
        restricted_at: null,
        restrict_reason: null,
        updated_at: new Date().toISOString(),
      };

  const { data, error } = await admin
    .from("profiles")
    .update(payload)
    .eq("id", id)
    .select("id, restricted_at, restrict_reason")
    .single();

  if (error || !data) {
    return adminDbErrorResponse(applyCookies, error ?? {}, "계정 상태 변경에 실패했어요");
  }

  return applyCookies(
    NextResponse.json({
      id: data.id,
      restrictedAt: data.restricted_at,
      restrictReason: data.restrict_reason,
    }),
  );
}
