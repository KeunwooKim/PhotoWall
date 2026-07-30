import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { resolveSharedWallEditAccess } from "@/lib/supabase/shared-walls";
import { saveSharedWallToDb } from "@/lib/supabase/walls";
import { resolveWallThemeId } from "@/lib/wall-themes";
import { getUserPlan } from "@/lib/auth/user-plan";
import { checkSceneQuota, sceneQuotaMessage } from "@/lib/wall-quotas";
import { restrictedResponse } from "@/lib/auth/account-restrict";
import { checkRateLimitAsync } from "@/lib/rate-limit";

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

  const blocked = await restrictedResponse(supabase, user.id);
  if (blocked) return applyCookies(blocked);

  if (!(await checkRateLimitAsync(`shared-save:${user.id}`, 120, 60 * 1000))) {
    return applyCookies(
      NextResponse.json({ error: "Too many saves. Slow down." }, { status: 429 }),
    );
  }

  const body = (await request.json()) as {
    themeId?: string;
    canvasJson?: object;
    title?: string;
    baseRevision?: number;
  };

  // Title-only update (벽 설정)
  if (typeof body.title === "string" && body.themeId === undefined && body.canvasJson === undefined) {
    const trimmed = body.title.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    }

    const access = await resolveSharedWallEditAccess(supabase, id, user.id);
    if (access.status !== "ok") {
      return applyCookies(
        NextResponse.json({ error: access.status, message: "이름을 바꿀 수 없어요" }, { status: 403 }),
      );
    }

    const { data, error } = await supabase
      .from("walls")
      .update({ title: trimmed.slice(0, 40), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("is_shared", true)
      .select("id, title")
      .maybeSingle();

    if (error || !data) {
      return applyCookies(
        NextResponse.json({ error: "Failed to rename wall" }, { status: 500 }),
      );
    }

    return applyCookies(NextResponse.json({ id: data.id, title: data.title ?? trimmed }));
  }

  if (!body.themeId || !body.canvasJson) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: wallMeta } = await supabase
    .from("walls")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle();

  const plan = await getUserPlan(wallMeta?.owner_id ?? user.id, supabase);
  const violation = checkSceneQuota(body.canvasJson, plan);
  if (violation) {
    return applyCookies(
      NextResponse.json(
        { error: violation, message: sceneQuotaMessage(violation) },
        { status: 413 },
      ),
    );
  }

  const themeId = resolveWallThemeId(body.themeId ?? "");

  const wall = await saveSharedWallToDb(
    id,
    {
      themeId,
      canvasJson: body.canvasJson,
      userId: user.id,
      baseRevision: body.baseRevision,
    },
    supabase,
  );

  if (wall.status === "conflict") {
    return applyCookies(
      NextResponse.json(
        {
          error: "revision_conflict",
          message: "다른 사람이 먼저 저장했어요. 최신 내용으로 다시 불러왔어요.",
          currentRevision: wall.currentRevision,
          wall: wall.wall,
        },
        { status: 409 },
      ),
    );
  }

  if (wall.status !== "ok") {
    return applyCookies(
      NextResponse.json({ error: "Failed to save shared wall" }, { status: 500 }),
    );
  }

  return applyCookies(NextResponse.json(wall.wall));
}
