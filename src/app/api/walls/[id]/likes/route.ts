import { NextResponse, type NextRequest } from "next/server";
import { getWallLikes, toggleWallLike } from "@/lib/supabase/social";
import { checkWallAccess } from "@/lib/supabase/wall-access";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { featureDisabledResponse, isFeatureEnabled } from "@/lib/feature-flags-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const visitorId = new URL(request.url).searchParams.get("visitorId") ?? "";

  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  if (!(await isFeatureEnabled("likes", routeClient.supabase))) {
    return NextResponse.json(featureDisabledResponse("좋아요"), { status: 503 });
  }

  const userId = (await getRouteUser(routeClient.supabase, request))?.id ?? null;
  const access = await checkWallAccess(routeClient.supabase, id, userId);
  if (!access.allowed) {
    return routeClient.applyCookies(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

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

  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  if (!(await isFeatureEnabled("likes", routeClient.supabase))) {
    return NextResponse.json(featureDisabledResponse("좋아요"), { status: 503 });
  }

  const user = await getRouteUser(routeClient.supabase, request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const likes = await toggleWallLike(routeClient.supabase, id, user.id);
  if (!likes) {
    return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
  }

  return routeClient?.applyCookies(NextResponse.json(likes)) ?? NextResponse.json(likes);
}
