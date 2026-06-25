import { NextResponse, type NextRequest } from "next/server";
import { fetchFeatureFlagRows } from "@/lib/feature-flags-server";
import { adminDbErrorResponse, requireAdminRoute } from "@/lib/admin/require-admin-route";
import { FEATURE_FLAG_KEYS, type FeatureFlagKey } from "@/lib/feature-flags";

export async function GET(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { admin, applyCookies } = auth.ctx;
  const flags = await fetchFeatureFlagRows(admin);
  return applyCookies(NextResponse.json(flags));
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { admin, applyCookies } = auth.ctx;

  let body: { key?: string; enabled?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return applyCookies(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }));
  }

  if (!body.key || !FEATURE_FLAG_KEYS.includes(body.key as FeatureFlagKey)) {
    return applyCookies(NextResponse.json({ error: "Invalid flag key" }, { status: 400 }));
  }

  if (typeof body.enabled !== "boolean") {
    return applyCookies(NextResponse.json({ error: "enabled required" }, { status: 400 }));
  }

  const { data, error } = await admin
    .from("feature_flags")
    .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
    .eq("key", body.key)
    .select("key, enabled, label, description, updated_at")
    .single();

  if (error) {
    return adminDbErrorResponse(applyCookies, error, "기능 플래그 수정 실패");
  }

  return applyCookies(
    NextResponse.json({
      key: data.key as FeatureFlagKey,
      enabled: data.enabled,
      label: data.label,
      description: data.description,
      updatedAt: data.updated_at,
    }),
  );
}
