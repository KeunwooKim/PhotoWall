import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { isAdminUser } from "@/lib/admin/auth";
import { requireStickerUser } from "@/lib/stickers/require-sticker-user";
import { itemToStickerDefinition, publicStickerAssetUrl } from "@/lib/stickers/ugc-registry";
import type { StickerPackItemRow, StickerPackRow } from "@/lib/stickers/ugc-types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const { id } = await context.params;
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);

  const { data: pack, error } = await supabase
    .from("sticker_packs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !pack) {
    return applyCookies(NextResponse.json({ error: "팩을 찾을 수 없어요" }, { status: 404 }));
  }

  const row = pack as StickerPackRow;
  const isOwner = user?.id === row.creator_id;
  const isAdmin = isAdminUser(user);
  if (row.status !== "published" && !isOwner && !isAdmin) {
    return applyCookies(NextResponse.json({ error: "팩을 찾을 수 없어요" }, { status: 404 }));
  }

  const { data: items } = await supabase
    .from("sticker_pack_items")
    .select("*")
    .eq("pack_id", id)
    .order("sort_order", { ascending: true });

  const itemRows = (items ?? []) as StickerPackItemRow[];
  let installed = false;
  if (user && row.status === "published") {
    const { data: install } = await supabase
      .from("sticker_pack_installs")
      .select("pack_id")
      .eq("user_id", user.id)
      .eq("pack_id", id)
      .maybeSingle();
    installed = !!install;
  }

  return applyCookies(
    NextResponse.json({
      pack: row,
      items: itemRows,
      stickers: itemRows.map((item) => itemToStickerDefinition(row, item)),
      coverUrl: row.cover_path ? publicStickerAssetUrl(row.cover_path) : null,
      installed,
      isOwner,
    }),
  );
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const auth = await requireStickerUser(request);
  if (!auth.ok) return auth.response;
  const { supabase, userId, applyCookies } = auth.ctx;
  const { id } = await context.params;

  const { data: pack, error: packError } = await supabase
    .from("sticker_packs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (packError || !pack) {
    return applyCookies(NextResponse.json({ error: "팩을 찾을 수 없어요" }, { status: 404 }));
  }

  const row = pack as StickerPackRow;
  if (row.creator_id !== userId) {
    return applyCookies(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }
  if (row.status !== "draft" && row.status !== "rejected") {
    return applyCookies(
      NextResponse.json({ error: "심사 중이거나 공개된 팩은 수정할 수 없어요" }, { status: 400 }),
    );
  }

  let body: { name?: string; description?: string; emoji?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return applyCookies(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }));
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (name.length < 1 || name.length > 40) {
      return applyCookies(
        NextResponse.json({ error: "팩 이름은 1–40자로 입력해 주세요" }, { status: 400 }),
      );
    }
    patch.name = name;
  }
  if (typeof body.description === "string") {
    patch.description = body.description.trim().slice(0, 280);
  }
  if (body.emoji === null) patch.emoji = null;
  else if (typeof body.emoji === "string") patch.emoji = body.emoji.trim().slice(0, 8) || null;
  if (row.status === "rejected") {
    patch.status = "draft";
    patch.reject_reason = null;
  }

  const { data: updated, error } = await supabase
    .from("sticker_packs")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !updated) {
    return applyCookies(
      NextResponse.json({ error: "수정에 실패했어요", detail: error?.message }, { status: 500 }),
    );
  }

  return applyCookies(NextResponse.json({ pack: updated as StickerPackRow }));
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const auth = await requireStickerUser(request);
  if (!auth.ok) return auth.response;
  const { supabase, userId, applyCookies } = auth.ctx;
  const { id } = await context.params;

  const { data: pack } = await supabase
    .from("sticker_packs")
    .select("id, creator_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!pack || pack.creator_id !== userId) {
    return applyCookies(NextResponse.json({ error: "팩을 찾을 수 없어요" }, { status: 404 }));
  }
  if (pack.status !== "draft" && pack.status !== "rejected") {
    return applyCookies(
      NextResponse.json({ error: "초안/거절된 팩만 삭제할 수 있어요" }, { status: 400 }),
    );
  }

  const { error } = await supabase.from("sticker_packs").delete().eq("id", id);
  if (error) {
    return applyCookies(
      NextResponse.json({ error: "삭제에 실패했어요", detail: error.message }, { status: 500 }),
    );
  }

  return applyCookies(NextResponse.json({ ok: true }));
}
