import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { createSharedWall, getSharedWallsForUser } from "@/lib/supabase/shared-walls";
import { featureDisabledResponse, isFeatureEnabled } from "@/lib/feature-flags-server";

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

  const walls = await getSharedWallsForUser(supabase, user.id);
  return applyCookies(NextResponse.json(walls));
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

  if (!(await isFeatureEnabled("shared_walls", supabase))) {
    return applyCookies(
      NextResponse.json(featureDisabledResponse("공동 벽"), { status: 503 }),
    );
  }

  const body = (await request.json()) as { title?: string };
  const result = await createSharedWall(supabase, user.id, body.title ?? "우리 인생네컷");

  if (!result.wall) {
    return applyCookies(
      NextResponse.json(
        { error: result.error ?? "Failed to create shared wall" },
        { status: 500 },
      ),
    );
  }

  return applyCookies(NextResponse.json(result.wall));
}
