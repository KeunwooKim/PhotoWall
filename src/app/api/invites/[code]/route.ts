import { NextResponse } from "next/server";
import { getInviteByCode } from "@/lib/supabase/social";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const invite = await getInviteByCode(code);

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  return NextResponse.json(invite);
}
