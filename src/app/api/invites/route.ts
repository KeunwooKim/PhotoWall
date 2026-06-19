import { NextResponse } from "next/server";
import { createInvite } from "@/lib/supabase/social";

export async function POST(request: Request) {
  const body = (await request.json()) as { wallId?: string };

  if (!body.wallId) {
    return NextResponse.json({ error: "wallId required" }, { status: 400 });
  }

  const invite = await createInvite(body.wallId);
  if (!invite) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  return NextResponse.json({ code: invite.code, wallId: invite.wallId });
}
