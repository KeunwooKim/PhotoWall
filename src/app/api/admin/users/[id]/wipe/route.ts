import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/admin/require-admin-route";
import { rejectForeignOrigin } from "@/lib/auth/get-site-origin";
import { wipeUserContent } from "@/lib/auth/delete-account";
import { notifyAccountRestricted } from "@/lib/discord/notify";

/** POST — wipe owned walls/storage/social rows and restrict the account (keeps auth login). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const foreign = rejectForeignOrigin(request);
  if (foreign) return foreign;

  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { applyCookies } = auth.ctx;

  const confirm = request.headers.get("x-confirm-wipe");
  if (confirm !== "WIPE") {
    return applyCookies(
      NextResponse.json(
        { error: "Send header X-Confirm-Wipe: WIPE to confirm" },
        { status: 400 },
      ),
    );
  }

  const result = await wipeUserContent(id);
  if (!result.ok) {
    return applyCookies(NextResponse.json({ error: result.error }, { status: result.status }));
  }

  notifyAccountRestricted({
    userId: id,
    restricted: true,
    reason: "관리자에 의한 콘텐츠 삭제",
  });

  return applyCookies(NextResponse.json({ ok: true }));
}
