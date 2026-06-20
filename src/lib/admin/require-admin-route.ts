import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { isAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/service-client";

export type AdminRouteContext = {
  user: User;
  /** service role client if configured, otherwise the admin user's session client */
  admin: SupabaseClient;
  hasServiceRole: boolean;
  applyCookies: (response: NextResponse) => NextResponse;
};

export function serviceRoleRequiredResponse(applyCookies: AdminRouteContext["applyCookies"]) {
  return applyCookies(
    NextResponse.json(
      {
        error:
          "이 작업에는 SUPABASE_SERVICE_ROLE_KEY 또는 admin-rls-migration.sql 실행 + app_admins 등록이 필요해요.",
      },
      { status: 503 },
    ),
  );
}

export function adminDbErrorResponse(
  applyCookies: AdminRouteContext["applyCookies"],
  error: { message?: string; code?: string },
  fallback: string,
) {
  const hint =
    error.code === "42501" || error.message?.includes("policy")
      ? " supabase/admin-rls-migration.sql 실행 후 app_admins에 본인 UUID를 등록하세요."
      : "";
  return applyCookies(
    NextResponse.json({ error: `${fallback}${hint}`, detail: error.message }, { status: 500 }),
  );
}

export async function requireAdminRoute(
  request: NextRequest,
): Promise<{ ok: true; ctx: AdminRouteContext } | { ok: false; response: NextResponse }> {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Supabase not configured" }, { status: 503 }),
    };
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);

  if (!user) {
    return {
      ok: false,
      response: applyCookies(NextResponse.json({ error: "Unauthorized" }, { status: 401 })),
    };
  }

  if (!isAdminUser(user)) {
    return {
      ok: false,
      response: applyCookies(NextResponse.json({ error: "Forbidden" }, { status: 403 })),
    };
  }

  const serviceAdmin = createAdminClient();

  return {
    ok: true,
    ctx: {
      user,
      admin: serviceAdmin ?? supabase,
      hasServiceRole: !!serviceAdmin,
      applyCookies,
    },
  };
}
