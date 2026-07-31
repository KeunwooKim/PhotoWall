import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import {
  dismissWallActivityNotices,
  listVisibleWallActivityNotices,
} from "@/lib/supabase/wall-activity-notices";

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

  const notices = await listVisibleWallActivityNotices(supabase, user.id);
  return applyCookies(NextResponse.json(notices));
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

  const body = (await request.json().catch(() => ({}))) as {
    ids?: unknown;
    all?: unknown;
  };

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string")
    : undefined;

  if (!body.all && (!ids || ids.length === 0)) {
    return applyCookies(
      NextResponse.json({ error: "Provide ids or all: true" }, { status: 400 }),
    );
  }

  const ok = await dismissWallActivityNotices(
    supabase,
    user.id,
    body.all ? undefined : ids,
  );
  if (!ok) {
    return applyCookies(
      NextResponse.json({ error: "Failed to dismiss notices" }, { status: 500 }),
    );
  }

  return applyCookies(NextResponse.json({ ok: true }));
}
