import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { fetchSharedWallForEdit } from "@/lib/supabase/shared-walls";
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

  const wall = await fetchSharedWallForEdit(supabase, id, user.id);
  if (!wall) {
    return applyCookies(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  return applyCookies(NextResponse.json(wall));
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
