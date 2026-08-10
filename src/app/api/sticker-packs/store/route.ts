import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { publicStickerAssetUrl } from "@/lib/stickers/ugc-registry";
import type { StickerPackRow } from "@/lib/stickers/ugc-types";

export async function GET(request: NextRequest) {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const { supabase, applyCookies } = routeClient;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const sort = url.searchParams.get("sort") === "popular" ? "popular" : "newest";
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 24) || 24));

  let query = supabase
    .from("sticker_packs")
    .select("id, creator_id, slug, name, description, emoji, cover_path, sticker_count, download_count, published_at, created_at")
    .eq("status", "published");

  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  }

  if (sort === "popular") {
    query = query.order("download_count", { ascending: false }).order("published_at", {
      ascending: false,
    });
  } else {
    query = query.order("published_at", { ascending: false });
  }

  const { data, error } = await query.limit(limit);
  if (error) {
    return applyCookies(
      NextResponse.json({ error: "스토어를 불러오지 못했어요", detail: error.message }, { status: 500 }),
    );
  }

  const packs = ((data ?? []) as StickerPackRow[]).map((pack) => ({
    ...pack,
    coverUrl: pack.cover_path ? publicStickerAssetUrl(pack.cover_path) : null,
  }));

  const user = await getRouteUser(supabase, request);
  let installedIds: string[] = [];
  if (user) {
    const { data: installs } = await supabase
      .from("sticker_pack_installs")
      .select("pack_id")
      .eq("user_id", user.id);
    installedIds = (installs ?? []).map((row) => row.pack_id as string);
  }

  return applyCookies(NextResponse.json({ packs, installedIds }));
}
