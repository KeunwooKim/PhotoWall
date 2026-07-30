import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/admin/require-admin-route";
import { postDiscordMessage } from "@/lib/discord/notify";

/** POST — send a test Discord webhook message (admin only). */
export async function POST(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { applyCookies } = auth.ctx;
  const body = (await request.json().catch(() => ({}))) as { message?: string };
  const custom = body.message?.trim().slice(0, 200);
  const content =
    custom ||
    `🔔 PhotoWall 테스트 알림 · ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`;

  const result = await postDiscordMessage(content);

  if (!result.configured) {
    return applyCookies(
      NextResponse.json(
        {
          ok: false,
          error: "DISCORD_WEBHOOK_URL이 없어요. Vercel/로컬 env에 웹후크 URL을 넣어 주세요",
        },
        { status: 503 },
      ),
    );
  }

  if (!result.ok) {
    return applyCookies(
      NextResponse.json(
        {
          ok: false,
          error: result.error || "Discord 전송 실패",
          status: result.status,
        },
        { status: 502 },
      ),
    );
  }

  return applyCookies(NextResponse.json({ ok: true }));
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const configured = Boolean(process.env.DISCORD_WEBHOOK_URL?.trim());
  return auth.ctx.applyCookies(NextResponse.json({ configured }));
}
