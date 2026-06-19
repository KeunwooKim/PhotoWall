import { NextResponse, type NextRequest } from "next/server";
import { addWallComment, getWallComments } from "@/lib/supabase/social";
import { getSupabaseServer } from "@/lib/supabase/walls";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { ensureProfile } from "@/lib/supabase/profiles";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!getSupabaseServer()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const comments = await getWallComments(id);
  return NextResponse.json(comments);
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
  let authorName = body.authorName ?? "익명";
  let userId: string | null = null;

  if (routeClient) {
    const user = await getRouteUser(routeClient.supabase, request);
    if (user) {
      userId = user.id;
      const profile = await ensureProfile(routeClient.supabase, user);
      if (profile?.displayName) authorName = profile.displayName;
    }
  }

  const comment = await addWallComment(id, authorName, body.body, userId);
  if (!comment) {
    return NextResponse.json({ error: "Failed to add comment" }, { status: 503 });
  }

  return routeClient?.applyCookies(NextResponse.json(comment)) ?? NextResponse.json(comment);
}
