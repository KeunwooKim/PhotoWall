import { NextResponse, type NextRequest } from "next/server";
import { fetchWallFromDb } from "@/lib/supabase/walls";
import { checkWallAccess } from "@/lib/supabase/wall-access";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const routeClient = createRouteClient(request);
  const supabase = routeClient?.supabase ?? null;

  const wall = await fetchWallFromDb(id, supabase);
  if (!wall) {
    return NextResponse.json({ error: "Wall not found" }, { status: 404 });
  }

  if (supabase) {
    const user = await getRouteUser(supabase, request);
    const access = await checkWallAccess(supabase, id, user?.id ?? null);
    if (!access.allowed) {
      const res = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return routeClient?.applyCookies(res) ?? res;
    }
  }

  const res = NextResponse.json(wall);
  return routeClient?.applyCookies(res) ?? res;
}
