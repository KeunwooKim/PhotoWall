import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import {
  addFriendship,
  ensureProfile,
  getFriends,
  getProfileByFriendCode,
} from "@/lib/supabase/profiles";

export async function GET(request: NextRequest) {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureProfile(supabase, user);
  const friends = await getFriends(supabase, user.id);

  return applyCookies(NextResponse.json(friends));
}

export async function POST(request: NextRequest) {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { friendCode?: string };
  const friendCode = body.friendCode?.trim().toUpperCase();

  if (!friendCode) {
    return NextResponse.json({ error: "friendCode required" }, { status: 400 });
  }

  const myProfile = await ensureProfile(supabase, user);
  if (!myProfile) {
    return applyCookies(
      NextResponse.json({ error: "Failed to load profile" }, { status: 500 }),
    );
  }

  if (myProfile.friendCode === friendCode) {
    return applyCookies(
      NextResponse.json({ error: "Cannot add yourself" }, { status: 400 }),
    );
  }

  const friendProfile = await getProfileByFriendCode(supabase, friendCode);
  if (!friendProfile) {
    return applyCookies(
      NextResponse.json({ error: "Friend code not found" }, { status: 404 }),
    );
  }

  const added = await addFriendship(supabase, user.id, friendProfile.id);
  if (!added) {
    return applyCookies(
      NextResponse.json({ error: "Already friends or failed to add" }, { status: 409 }),
    );
  }

  const friends = await getFriends(supabase, user.id);
  return applyCookies(NextResponse.json(friends));
}
