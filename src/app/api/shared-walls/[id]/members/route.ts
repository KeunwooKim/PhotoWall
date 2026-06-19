import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import {
  getSharedWallMembers,
  inviteFriendToWall,
} from "@/lib/supabase/shared-walls";

export async function GET(
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

  const members = await getSharedWallMembers(supabase, id, user.id);
  if (members.length === 0) {
    return applyCookies(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  return applyCookies(NextResponse.json(members));
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

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { friendId?: string };
  if (!body.friendId) {
    return NextResponse.json({ error: "friendId required" }, { status: 400 });
  }

  const result = await inviteFriendToWall(supabase, id, user.id, body.friendId);
  if (!result.ok) {
    const status =
      result.error === "already_member" || result.error === "already_invited" ? 409 : 403;
    return applyCookies(
      NextResponse.json({ error: result.error ?? "Failed to invite friend" }, { status }),
    );
  }

  return applyCookies(NextResponse.json({ invited: true }));
}
