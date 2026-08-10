import { NextResponse, type NextRequest } from "next/server";
import { loadHomeDashboard } from "@/lib/home/load-home-dashboard";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);

  if (!user) {
    return applyCookies(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const data = await loadHomeDashboard(supabase, user);
  return applyCookies(NextResponse.json(data));
}
