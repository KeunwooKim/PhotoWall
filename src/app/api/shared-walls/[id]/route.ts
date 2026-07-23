import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { resolveSharedWallEditAccess } from "@/lib/supabase/shared-walls";
import { saveSharedWallToDb } from "@/lib/supabase/walls";
import { resolveWallThemeId } from "@/lib/wall-themes";

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

  const access = await resolveSharedWallEditAccess(supabase, id, user.id);
  if (access.status === "viewer_only") {
    return applyCookies(
      NextResponse.json({ error: "viewer_only", message: "읽기 전용 멤버는 뷰어로 이동해요" }, { status: 403 }),
    );
  }
  if (access.status === "not_member") {
    return applyCookies(
      NextResponse.json({ error: "not_member", message: "이 공동 벽의 멤버가 아니에요" }, { status: 403 }),
    );
  }
  if (access.status === "not_found") {
    return applyCookies(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  return applyCookies(NextResponse.json(access.wall));
}

export async function PATCH(
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

  const body = (await request.json()) as { themeId?: string; canvasJson?: object };
  if (!body.themeId || !body.canvasJson) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const themeId = resolveWallThemeId(body.themeId ?? "");

  const wall = await saveSharedWallToDb(
    id,
    { themeId, canvasJson: body.canvasJson, userId: user.id },
    supabase,
  );

  if (!wall) {
    return applyCookies(
      NextResponse.json({ error: "Failed to save shared wall" }, { status: 500 }),
    );
  }

  return applyCookies(NextResponse.json(wall));
}
