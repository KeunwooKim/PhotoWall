import { NextResponse, type NextRequest } from "next/server";
import { addWallComment, getWallComments } from "@/lib/supabase/social";
import { getSupabaseServer } from "@/lib/supabase/walls";
import { checkWallAccess } from "@/lib/supabase/wall-access";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { ensureProfile } from "@/lib/supabase/profiles";
import { featureDisabledResponse, isFeatureEnabled } from "@/lib/feature-flags-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const routeClient = createRouteClient(request);
  const supabase = routeClient?.supabase ?? getSupabaseServer();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  if (!(await isFeatureEnabled("comments", supabase))) {
    return NextResponse.json(featureDisabledResponse("댓글"), { status: 503 });
  }

  const user = routeClient ? await getRouteUser(routeClient.supabase, request) : null;
  const access = await checkWallAccess(supabase, id, user?.id ?? null);
  if (!access.allowed) {
    const res = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return routeClient?.applyCookies(res) ?? res;
  }

  const comments = await getWallComments(id);
  const res = NextResponse.json(comments);
  return routeClient?.applyCookies(res) ?? res;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as { authorName?: string; body?: string };

  if (!body.body?.trim()) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  if (!(await isFeatureEnabled("comments", routeClient.supabase))) {
    return NextResponse.json(featureDisabledResponse("댓글"), { status: 503 });
  }

  const user = await getRouteUser(routeClient.supabase, request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let authorName = body.authorName ?? "익명";
  const profile = await ensureProfile(routeClient.supabase, user);
  if (profile?.displayName) authorName = profile.displayName;

  const comment = await addWallComment(routeClient.supabase, id, authorName, body.body, user.id);
  if (!comment) {
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }

  return routeClient?.applyCookies(NextResponse.json(comment)) ?? NextResponse.json(comment);
}
