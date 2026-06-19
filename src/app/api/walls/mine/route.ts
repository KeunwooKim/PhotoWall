import { NextResponse, type NextRequest } from "next/server";
import { fetchPersonalWallForOwner } from "@/lib/supabase/walls";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wall = await fetchPersonalWallForOwner(user.id, supabase);
  if (!wall) {
    return applyCookies(NextResponse.json(null));
  }

  return applyCookies(NextResponse.json(wall));
}
