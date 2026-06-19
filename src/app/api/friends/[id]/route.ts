import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { getFriends, removeFriendship } from "@/lib/supabase/profiles";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: friendId } = await params;
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const removed = await removeFriendship(supabase, user.id, friendId);
  if (!removed) {
    return applyCookies(
      NextResponse.json({ error: "Failed to remove friend" }, { status: 500 }),
    );
  }

  const friends = await getFriends(supabase, user.id);
  return applyCookies(NextResponse.json(friends));
}
