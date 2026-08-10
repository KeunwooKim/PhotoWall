import { NextResponse, type NextRequest } from "next/server";
import { requireStickerUser } from "@/lib/stickers/require-sticker-user";
import {
  STICKER_PACK_MAX_ITEMS,
  STICKER_PACK_MIN_ITEMS,
  type StickerPackRow,
} from "@/lib/stickers/ugc-types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const auth = await requireStickerUser(request);
  if (!auth.ok) return auth.response;
  const { supabase, userId, applyCookies } = auth.ctx;
  const { id } = await context.params;

  const { data: pack, error } = await supabase
    .from("sticker_packs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !pack) {
    return applyCookies(NextResponse.json({ error: "팩을 찾을 수 없어요" }, { status: 404 }));
  }

  const row = pack as StickerPackRow;
  if (row.creator_id !== userId) {
    return applyCookies(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }
  if (row.status !== "draft" && row.status !== "rejected") {
    return applyCookies(
      NextResponse.json({ error: "이미 제출되었거나 공개된 팩이에요" }, { status: 400 }),
    );
  }

  const { count } = await supabase
    .from("sticker_pack_items")
    .select("id", { count: "exact", head: true })
    .eq("pack_id", id);

  const n = count ?? 0;
  if (n < STICKER_PACK_MIN_ITEMS || n > STICKER_PACK_MAX_ITEMS) {
    return applyCookies(
      NextResponse.json(
        {
          error: `스티커는 ${STICKER_PACK_MIN_ITEMS}–${STICKER_PACK_MAX_ITEMS}장이어야 해요 (현재 ${n}장)`,
        },
        { status: 400 },
      ),
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("sticker_packs")
    .update({
      status: "pending",
      reject_reason: null,
      sticker_count: n,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return applyCookies(
      NextResponse.json(
        { error: "제출에 실패했어요", detail: updateError?.message },
        { status: 500 },
      ),
    );
  }

  return applyCookies(NextResponse.json({ pack: updated as StickerPackRow }));
}
