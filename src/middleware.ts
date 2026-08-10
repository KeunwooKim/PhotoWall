import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // Supabase Site URL이 루트(/)로 설정된 경우 ?code= 를 콜백으로 넘김
  if (url.searchParams.has("code") && url.pathname !== "/auth/callback") {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    return NextResponse.redirect(callbackUrl);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/",
    "/wall/edit",
    "/wall/share",
    "/shared/:path*",
    "/walls",
    "/walls/:path*",
    "/settings",
    "/settings/:path*",
    "/profile",
    "/profile/:path*",
    "/friends",
    "/friends/:path*",
    "/capture",
    "/import",
    "/upgrade",
    "/stickers",
    "/stickers/:path*",
    "/board",
    "/admin/:path*",
    "/dev/:path*",
  ],
};
