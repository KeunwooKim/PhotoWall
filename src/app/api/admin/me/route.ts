import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { isAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/service-client";

export async function GET(request: NextRequest) {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ isAdmin: false, hasServiceRole: false }, { status: 503 });
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);

  return applyCookies(
    NextResponse.json({
      isAdmin: isAdminUser(user),
      hasServiceRole: !!createAdminClient(),
    }),
  );
}
