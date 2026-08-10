import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { isAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/service-client";
import { getRateLimitBackend } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ isAdmin: false }, { status: 503 });
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);
  const isAdmin = isAdminUser(user);

  // Do not advertise service-role presence to anonymous / non-admin callers.
  if (!isAdmin) {
    return applyCookies(NextResponse.json({ isAdmin: false }));
  }

  return applyCookies(
    NextResponse.json({
      isAdmin: true,
      hasServiceRole: !!createAdminClient(),
      rateLimitBackend: getRateLimitBackend(),
    }),
  );
}
