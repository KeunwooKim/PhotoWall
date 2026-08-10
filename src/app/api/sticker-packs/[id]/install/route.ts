import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/admin/service-client";
import { requireStickerUser } from "@/lib/stickers/require-sticker-user";
import type { StickerPackRow } from "@/lib/stickers/ugc-types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const auth = await requireStickerUser(request);
  if (!auth.ok) return auth.response;
  const { supabase, userId, applyCookies } = auth.ctx;
  const { id } = await context.params;

  const { data: pack } = await supabase
    .from("sticker_packs")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!pack) {
    return applyCookies(NextResponse.json({ error: "공개된 팩만 설치할 수 있어요" }, { status: 404 }));
  }

  const { data: existing } = await supabase
    .from("sticker_pack_installs")
    .select("pack_id")
    .eq("user_id", userId)
    .eq("pack_id", id)
    .maybeSingle();

  if (existing) {
    return applyCookies(NextResponse.json({ ok: true, alreadyInstalled: true }));
  }

  const { error } = await supabase.from("sticker_pack_installs").insert({
    user_id: userId,
    pack_id: id,
    installed_at: new Date().toISOString(),
  });

  if (error) {
    return applyCookies(
      NextResponse.json({ error: "설치에 실패했어요", detail: error.message }, { status: 500 }),
    );
  }

  // Service role: installers are not pack owners, so RLS blocks download_count updates.
  const admin = createAdminClient();
  const row = pack as StickerPackRow;
  if (admin) {
    await admin
      .from("sticker_packs")
      .update({ download_count: (row.download_count ?? 0) + 1 })
      .eq("id", id)
      .eq("status", "published");
  }

  return applyCookies(NextResponse.json({ ok: true }));
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const auth = await requireStickerUser(request);
  if (!auth.ok) return auth.response;
  const { supabase, userId, applyCookies } = auth.ctx;
  const { id } = await context.params;

  const { error } = await supabase
    .from("sticker_pack_installs")
    .delete()
    .eq("user_id", userId)
    .eq("pack_id", id);

  if (error) {
    return applyCookies(
      NextResponse.json({ error: "설치 해제에 실패했어요", detail: error.message }, { status: 500 }),
    );
  }

  return applyCookies(NextResponse.json({ ok: true }));
}
