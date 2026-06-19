import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { ensureProfile, updateAllowWallVisits } from "@/lib/supabase/profiles";

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

  const profile = await ensureProfile(supabase, user);
  if (!profile) {
    return applyCookies(
      NextResponse.json({ error: "Failed to load profile" }, { status: 500 }),
    );
  }

  return applyCookies(NextResponse.json(profile));
}

export async function PATCH(request: NextRequest) {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { allowWallVisits?: boolean };

  if (typeof body.allowWallVisits !== "boolean") {
    return applyCookies(
      NextResponse.json({ error: "allowWallVisits boolean required" }, { status: 400 }),
    );
  }

  const updated = await updateAllowWallVisits(supabase, user.id, body.allowWallVisits);
  if (!updated) {
    return applyCookies(
      NextResponse.json({ error: "Failed to update profile" }, { status: 500 }),
    );
  }

  const profile = await ensureProfile(supabase, user);
  if (!profile) {
    return applyCookies(
      NextResponse.json({ error: "Failed to load profile" }, { status: 500 }),
    );
  }

  return applyCookies(NextResponse.json(profile));
}
