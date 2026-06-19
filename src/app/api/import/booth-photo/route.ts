import { NextResponse, type NextRequest } from "next/server";
import { importPhotosFromBoothUrl } from "@/lib/booth-import/fetch-booth-images";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json(
      { ok: false, error: "server_error", message: "서버 설정이 필요해요" },
      { status: 503 },
    );
  }

  const user = await getRouteUser(routeClient.supabase, request);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", message: "로그인 후 이용할 수 있어요" },
      { status: 401 },
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? user.id;
  if (!checkRateLimit(`booth-import:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요" },
      { status: 429 },
    );
  }

  let body: { url?: string };
  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_url", message: "요청 형식이 올바르지 않아요" },
      { status: 400 },
    );
  }

  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json(
      { ok: false, error: "invalid_url", message: "QR 링크가 필요해요" },
      { status: 400 },
    );
  }

  const result = await importPhotosFromBoothUrl(body.url);

  if (!result.ok) {
    const status =
      result.error === "invalid_url" || result.error === "domain_not_allowed" ? 400 : 422;
    return NextResponse.json(result, { status });
  }

  return routeClient.applyCookies(NextResponse.json(result));
}
