import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { restrictedResponse } from "@/lib/auth/account-restrict";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";

export type StickerRouteContext = {
  supabase: SupabaseClient;
  userId: string;
  applyCookies: (response: NextResponse) => NextResponse;
};

export async function requireStickerUser(
  request: NextRequest,
): Promise<{ ok: true; ctx: StickerRouteContext } | { ok: false; response: NextResponse }> {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Supabase not configured" }, { status: 503 }),
    };
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);
  if (!user) {
    return {
      ok: false,
      response: applyCookies(NextResponse.json({ error: "Unauthorized" }, { status: 401 })),
    };
  }

  const blocked = await restrictedResponse(supabase, user.id);
  if (blocked) {
    return { ok: false, response: applyCookies(blocked) };
  }

  return {
    ok: true,
    ctx: { supabase, userId: user.id, applyCookies },
  };
}
