import { NextResponse, type NextRequest } from "next/server";
import { savePersonalWallToDb } from "@/lib/supabase/walls";
import { resolveWallThemeId } from "@/lib/wall-themes";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { getUserPlan } from "@/lib/auth/user-plan";
import { checkSceneQuota, sceneQuotaMessage } from "@/lib/wall-quotas";
import { restrictedResponse } from "@/lib/auth/account-restrict";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { captureException } from "@/lib/monitoring";

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

    const blocked = await restrictedResponse(supabase, user.id);
    if (blocked) return applyCookies(blocked);

    if (!(await checkRateLimitAsync(`wall-save:${user.id}`, 120, 60 * 1000))) {
      return applyCookies(
        NextResponse.json({ error: "Too many saves. Slow down." }, { status: 429 }),
      );
    }

    const body = (await request.json()) as {
      id?: string;
      themeId: string;
      canvasJson: object;
      baseRevision?: number;
    };

    if (!body.themeId || !body.canvasJson) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const plan = await getUserPlan(user.id, supabase);
    const violation = checkSceneQuota(body.canvasJson, plan);
    if (violation) {
      return applyCookies(
        NextResponse.json(
          { error: violation, message: sceneQuotaMessage(violation, plan) },
          { status: 413 },
        ),
      );
    }

    const themeId = resolveWallThemeId(body.themeId ?? "");

    const result = await savePersonalWallToDb(
      {
        id: body.id,
        themeId,
        canvasJson: body.canvasJson,
        ownerId: user.id,
        baseRevision: body.baseRevision,
      },
      supabase,
    );

    if (result.status === "conflict") {
      return applyCookies(
        NextResponse.json(
          {
            error: "revision_conflict",
            message: "다른 기기에서 벽이 먼저 저장됐어요. 다시 불러왔어요.",
            currentRevision: result.currentRevision,
            wall: result.wall,
          },
          { status: 409 },
        ),
      );
    }

    if (result.status !== "ok") {
      return NextResponse.json({ error: "Failed to save personal wall" }, { status: 500 });
    }

    return applyCookies(NextResponse.json(result.wall));
  } catch (err) {
    captureException(err, { route: "POST /api/walls" });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
