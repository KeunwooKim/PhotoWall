import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/admin/require-admin-route";
import { publicStickerAssetUrl } from "@/lib/stickers/ugc-registry";
import type { StickerPackRow } from "@/lib/stickers/ugc-types";

export async function GET(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;
  const { admin, applyCookies } = auth.ctx;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "pending";
  const allowed = new Set(["draft", "pending", "published", "rejected", "taken_down"]);
  const filter = allowed.has(status) ? status : "pending";

  const { data, error } = await admin
    .from("sticker_packs")
    .select("*")
    .eq("status", filter)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    return applyCookies(
      NextResponse.json({ error: "목록 조회 실패", detail: error.message }, { status: 500 }),
    );
  }

  const packs = ((data ?? []) as StickerPackRow[]).map((pack) => ({
    ...pack,
    coverUrl: pack.cover_path ? publicStickerAssetUrl(pack.cover_path) : null,
  }));

  return applyCookies(NextResponse.json({ packs }));
}
