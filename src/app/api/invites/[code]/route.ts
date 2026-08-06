import { NextResponse, type NextRequest } from "next/server";
import { getInviteByCode } from "@/lib/supabase/social";
import { checkRateLimitAsync, getRequestIp } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const ip = getRequestIp(request);
  if (!(await checkRateLimitAsync(`invite-lookup:${ip}`, 20, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { code } = await params;
  const invite = await getInviteByCode(code);

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  return NextResponse.json(invite);
}
