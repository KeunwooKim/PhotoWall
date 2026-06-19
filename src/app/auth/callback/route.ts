import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/auth/get-site-origin";
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
        return NextResponse.redirect(`${siteOrigin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${siteOrigin}/?auth_error=1`);
}
