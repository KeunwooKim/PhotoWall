import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/admin/require-admin-route";
import type { StickerPackRow } from "@/lib/stickers/ugc-types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;
  const { admin, applyCookies } = auth.ctx;
  const { id } = await context.params;

  let body: { action?: string; reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return applyCookies(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }));
  }

  const action = body.action;
  if (action !== "approve" && action !== "reject" && action !== "take_down") {
    return applyCookies(
      NextResponse.json({ error: "action must be approve|reject|take_down" }, { status: 400 }),
    );
  }

  const { data: pack } = await admin
    .from("sticker_packs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!pack) {
    return applyCookies(NextResponse.json({ error: "팩을 찾을 수 없어요" }, { status: 404 }));
  }

  const now = new Date().toISOString();
  let patch: Record<string, unknown>;

  if (action === "approve") {
    if (pack.status !== "pending") {
      return applyCookies(
        NextResponse.json({ error: "대기 중인 팩만 승인할 수 있어요" }, { status: 400 }),
      );
    }
    patch = {
      status: "published",
      reject_reason: null,
      published_at: now,
      updated_at: now,
    };
  } else if (action === "reject") {
    if (pack.status !== "pending") {
      return applyCookies(
        NextResponse.json({ error: "대기 중인 팩만 거절할 수 있어요" }, { status: 400 }),
      );
    }
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim().slice(0, 280)
        : "심사 기준에 맞지 않아요";
    patch = {
      status: "rejected",
      reject_reason: reason,
      updated_at: now,
    };
  } else {
    patch = {
      status: "taken_down",
      reject_reason:
        typeof body.reason === "string" && body.reason.trim()
          ? body.reason.trim().slice(0, 280)
          : "관리자에 의해 비공개 처리됨",
      updated_at: now,
    };
  }

  const { data: updated, error } = await admin
    .from("sticker_packs")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !updated) {
    return applyCookies(
      NextResponse.json({ error: "처리 실패", detail: error?.message }, { status: 500 }),
    );
  }

  return applyCookies(NextResponse.json({ pack: updated as StickerPackRow }));
}
