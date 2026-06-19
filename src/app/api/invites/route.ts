import { NextResponse, type NextRequest } from "next/server";
import { createInvite } from "@/lib/supabase/social";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { wallId?: string };

  if (!body.wallId) {
    return NextResponse.json({ error: "wallId required" }, { status: 400 });
  }

  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const user = await getRouteUser(routeClient.supabase, request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invite = await createInvite(routeClient.supabase, body.wallId);
  if (!invite) {
    return NextResponse.json({ error: "Failed to create invite" }, { status: 403 });
  }

  return routeClient.applyCookies(
    NextResponse.json({ code: invite.code, wallId: invite.wallId }),
  );
}
