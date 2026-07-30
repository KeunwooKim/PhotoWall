import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/auth/get-site-origin";
import { isLikelyNewAuthUser, notifyNewUser } from "@/lib/discord/notify";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const siteOrigin = getSiteOrigin(request);

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        // Profiles are usually created by DB trigger before ensureProfile insert,
        // so notify here on first-time signup instead of waiting for an insert.
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user && isLikelyNewAuthUser(user.created_at)) {
            const meta = user.user_metadata ?? {};
            const displayName =
              (meta.full_name as string) ||
              (meta.name as string) ||
              user.email?.split("@")[0] ||
              "친구";
            notifyNewUser({ displayName, userId: user.id });
          }
        } catch {
          /* never block login for ops notify */
        }

        return NextResponse.redirect(`${siteOrigin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${siteOrigin}/?auth_error=1`);
}
