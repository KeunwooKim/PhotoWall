import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { createSharedWall, getSharedWallsForUser } from "@/lib/supabase/shared-walls";
import { featureDisabledResponse, isFeatureEnabled } from "@/lib/feature-flags-server";
import { getUserPlan } from "@/lib/auth/user-plan";
import { getWallQuota } from "@/lib/wall-quotas";
import { restrictedResponse } from "@/lib/auth/account-restrict";
import { checkRateLimitAsync } from "@/lib/rate-limit";

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

  const result = await getSharedWallsForUser(supabase, user.id);
  if (result.error) {
    const status = /rate limit/i.test(result.error) ? 429 : 500;
    return applyCookies(
      NextResponse.json(
        {
          error: status === 429 ? "rate_limited" : "shared_walls_fetch_failed",
          message:
            status === 429
              ? "요청이 많아요. 잠시 후 다시 시도해 주세요"
              : "공동 벽 목록을 불러오지 못했어요",
        },
        { status },
      ),
    );
  }
  return applyCookies(NextResponse.json(result.walls));
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

  const blocked = await restrictedResponse(supabase, user.id);
  if (blocked) return applyCookies(blocked);

  if (!(await checkRateLimitAsync(`shared-create:${user.id}`, 20, 60 * 60 * 1000))) {
    return applyCookies(
      NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 }),
    );
  }

  if (!(await isFeatureEnabled("shared_walls", supabase))) {
    return applyCookies(
      NextResponse.json(featureDisabledResponse("공동 벽"), { status: 503 }),
    );
  }

  const body = (await request.json()) as { title?: string };
  const result = await createSharedWall(supabase, user.id, body.title ?? "우리 인생네컷");

  if (!result.wall) {
    if (result.error === "shared_wall_limit") {
      const plan = await getUserPlan(user.id, supabase);
      const max = getWallQuota(plan).maxOwnedSharedWalls;
      return applyCookies(
        NextResponse.json(
          {
            error: "shared_wall_limit",
            message:
              plan === "free"
                ? `공동 벽을 ${max}개까지 만들 수 있어요. 플러스로 더 만들 수 있어요`
                : `공동 벽을 ${max}개까지 만들 수 있어요`,
            maxOwnedSharedWalls: max,
          },
          { status: 403 },
        ),
      );
    }

    return applyCookies(
      NextResponse.json(
        { error: result.error ?? "Failed to create shared wall" },
        { status: 500 },
      ),
    );
  }

  return applyCookies(NextResponse.json(result.wall));
}
