import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { dismissInboxNotices, listInboxNotices } from "@/lib/supabase/user-inbox";

export async function GET(request: NextRequest) {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);
  if (!user) {
    return applyCookies(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const notices = await listInboxNotices(supabase, user.id);
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
    return applyCookies(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const body = (await request.json()) as { ids?: string[]; all?: boolean };
  await dismissInboxNotices(supabase, user.id, body);
  return applyCookies(NextResponse.json({ ok: true }));
}
