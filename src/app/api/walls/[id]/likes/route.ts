import { NextResponse, type NextRequest } from "next/server";
import { getWallLikes, toggleWallLike } from "@/lib/supabase/social";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const visitorId = new URL(request.url).searchParams.get("visitorId") ?? "";

  const routeClient = createRouteClient(request);
  const userId = routeClient
    ? (await getRouteUser(routeClient.supabase, request))?.id ?? null
    : null;

  const likes = await getWallLikes(id, visitorId, userId);
  if (!likes) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  return routeClient?.applyCookies(NextResponse.json(likes)) ?? NextResponse.json(likes);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as { visitorId?: string };

  if (!body.visitorId) {
    return NextResponse.json({ error: "visitorId required" }, { status: 400 });
  }

  const routeClient = createRouteClient(request);
  const userId = routeClient
    ? (await getRouteUser(routeClient.supabase, request))?.id ?? null
    : null;

  const likes = await toggleWallLike(id, body.visitorId, userId);
  if (!likes) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  return routeClient?.applyCookies(NextResponse.json(likes)) ?? NextResponse.json(likes);
}
