import { NextResponse, type NextRequest } from "next/server";
import { requireStickerUser } from "@/lib/stickers/require-sticker-user";
import { itemToStickerDefinition } from "@/lib/stickers/ugc-registry";
import type { StickerPackItemRow, StickerPackRow } from "@/lib/stickers/ugc-types";

export async function GET(request: NextRequest) {
  const auth = await requireStickerUser(request);
  if (!auth.ok) return auth.response;
  const { supabase, userId, applyCookies } = auth.ctx;

  const { data: installs, error: installError } = await supabase
    .from("sticker_pack_installs")
    .select("pack_id, installed_at")
    .eq("user_id", userId)
    .order("installed_at", { ascending: false });

  if (installError) {
    return applyCookies(
      NextResponse.json(
        { error: "라이브러리를 불러오지 못했어요", detail: installError.message },
        { status: 500 },
      ),
    );
  }

  const packIds = (installs ?? []).map((row) => row.pack_id as string);
  if (packIds.length === 0) {
    return applyCookies(NextResponse.json({ packs: [] }));
  }

  const { data: packs, error: packError } = await supabase
    .from("sticker_packs")
    .select("*")
    .in("id", packIds)
    .eq("status", "published");

  if (packError) {
    return applyCookies(
      NextResponse.json({ error: "팩을 불러오지 못했어요", detail: packError.message }, { status: 500 }),
    );
  }

  const { data: items, error: itemError } = await supabase
    .from("sticker_pack_items")
    .select("*")
    .in("pack_id", packIds)
    .order("sort_order", { ascending: true });

  if (itemError) {
    return applyCookies(
      NextResponse.json(
        { error: "스티커를 불러오지 못했어요", detail: itemError.message },
        { status: 500 },
      ),
    );
  }

  const itemsByPack = new Map<string, StickerPackItemRow[]>();
  for (const item of (items ?? []) as StickerPackItemRow[]) {
    const list = itemsByPack.get(item.pack_id) ?? [];
    list.push(item);
    itemsByPack.set(item.pack_id, list);
  }

  const order = new Map(packIds.map((id, index) => [id, index]));
  const packRows = ((packs ?? []) as StickerPackRow[]).sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );

  const payload = packRows.map((pack) => {
    const packItems = itemsByPack.get(pack.id) ?? [];
    return {
      pack,
      items: packItems,
      stickers: packItems.map((item) => itemToStickerDefinition(pack, item)),
    };
  });

  return applyCookies(NextResponse.json({ packs: payload }));
}
