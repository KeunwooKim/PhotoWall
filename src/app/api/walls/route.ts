import { NextResponse, type NextRequest } from "next/server";
import { savePersonalWallToDb } from "@/lib/supabase/walls";
import { resolveWallThemeId } from "@/lib/wall-themes";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  try {
    const routeClient = createRouteClient(request);
    if (!routeClient) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const { supabase, applyCookies } = routeClient;
    const user = await getRouteUser(supabase, request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      id?: string;
      themeId: string;
      canvasJson: object;
    };

    if (!body.themeId || !body.canvasJson) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const themeId = resolveWallThemeId(body.themeId ?? "");

    const wall = await savePersonalWallToDb(
      {
        id: body.id,
        themeId,
        canvasJson: body.canvasJson,
        ownerId: user.id,
      },
      supabase,
    );

    if (!wall) {
      return NextResponse.json({ error: "Failed to save personal wall" }, { status: 500 });
    }

    return applyCookies(NextResponse.json(wall));
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
