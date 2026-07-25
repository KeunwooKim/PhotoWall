import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import {
  getSharedWallMembers,
  inviteFriendToWall,
  removeSharedWallMember,
} from "@/lib/supabase/shared-walls";
import { restrictedResponse } from "@/lib/auth/account-restrict";

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

  const blocked = await restrictedResponse(supabase, user.id);
  if (blocked) return applyCookies(blocked);

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

export async function DELETE(
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

  const body = (await request.json().catch(() => ({}))) as { userId?: string };
  if (!body.userId) {
    return applyCookies(NextResponse.json({ error: "userId required" }, { status: 400 }));
  }

  const result = await removeSharedWallMember(supabase, id, user.id, body.userId);
  if (!result.ok) {
    const status =
      result.error === "forbidden"
        ? 403
        : result.error === "not_member"
          ? 404
          : result.error === "cannot_remove_owner"
            ? 400
            : 400;
    return applyCookies(
      NextResponse.json({ error: result.error ?? "Failed to remove member" }, { status }),
    );
  }

  // Leaving: actor may no longer be a member — return empty list
  if (body.userId === user.id) {
    return applyCookies(NextResponse.json([]));
  }

  const members = await getSharedWallMembers(supabase, id, user.id);
  return applyCookies(NextResponse.json(members));
}
