import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { acceptWallInvite, declineWallInvite } from "@/lib/supabase/shared-walls";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { action?: "accept" | "decline" };
  if (body.action !== "accept" && body.action !== "decline") {
    return applyCookies(
      NextResponse.json({ error: "action must be accept or decline" }, { status: 400 }),
    );
  }

  if (body.action === "decline") {
    const declined = await declineWallInvite(supabase, id, user.id);
    if (!declined) {
      return applyCookies(NextResponse.json({ error: "Failed to decline" }, { status: 404 }));
    }
    return applyCookies(NextResponse.json({ ok: true }));
  }

  const result = await acceptWallInvite(supabase, id, user.id);
  if (!result.wallId) {
    return applyCookies(
      NextResponse.json({ error: result.error ?? "Failed to accept" }, { status: 409 }),
    );
  }

  return applyCookies(NextResponse.json({ wallId: result.wallId }));
}
