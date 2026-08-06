import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { getUserPlan } from "@/lib/auth/user-plan";
import { getWallQuota } from "@/lib/wall-quotas";
import { getUserWallPhotoBytes } from "@/lib/storage/account-usage-server";

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

  const plan = await getUserPlan(user.id, supabase);
  const quota = getWallQuota(plan);
  const usedBytes = await getUserWallPhotoBytes(user.id, supabase);

  return applyCookies(
    NextResponse.json({
      plan,
      usedBytes,
      maxBytes: quota.maxStorageBytes,
      remainingBytes: Math.max(0, quota.maxStorageBytes - usedBytes),
    }),
  );
}
