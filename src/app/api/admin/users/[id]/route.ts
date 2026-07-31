import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute, adminDbErrorResponse } from "@/lib/admin/require-admin-route";
import { parseUserPlan } from "@/lib/auth/user-plan";
import type { UserPlan } from "@/lib/wall-quotas";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { admin, applyCookies } = auth.ctx;
  const body = (await request.json()) as {
    restricted?: boolean;
    reason?: string;
    plan?: UserPlan;
  };

  const hasRestricted = typeof body.restricted === "boolean";
  const hasPlan = body.plan === "free" || body.plan === "premium";

  if (!hasRestricted && !hasPlan) {
    return applyCookies(
      NextResponse.json(
        { error: "restricted boolean or plan (free|premium) required" },
        { status: 400 },
      ),
    );
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (hasRestricted) {
    if (body.restricted) {
      payload.restricted_at = new Date().toISOString();
      payload.restrict_reason = body.reason?.trim() || "관리자에 의한 제한";
    } else {
      payload.restricted_at = null;
      payload.restrict_reason = null;
    }
  }

  if (hasPlan) {
    payload.plan = body.plan;
    payload.plan_updated_at = new Date().toISOString();
  }

  const { data, error } = await admin
    .from("profiles")
    .update(payload)
    .eq("id", id)
    .select("id, restricted_at, restrict_reason, plan")
    .single();

  if (error || !data) {
    return adminDbErrorResponse(applyCookies, error ?? {}, "계정 상태 변경에 실패했어요");
  }

  if (hasRestricted) {
    const { notifyAccountRestricted } = await import("@/lib/discord/notify");
    notifyAccountRestricted({
      userId: data.id,
      restricted: !!data.restricted_at,
      reason: data.restrict_reason,
    });
  }

  return applyCookies(
    NextResponse.json({
      id: data.id,
      restrictedAt: data.restricted_at,
      restrictReason: data.restrict_reason,
      plan: parseUserPlan(data.plan),
    }),
  );
}
