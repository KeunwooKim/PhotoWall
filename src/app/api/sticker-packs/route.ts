import { NextResponse, type NextRequest } from "next/server";
import { requireStickerUser } from "@/lib/stickers/require-sticker-user";
import { slugifyPackName, type StickerPackRow } from "@/lib/stickers/ugc-types";

export async function POST(request: NextRequest) {
  const auth = await requireStickerUser(request);
  if (!auth.ok) return auth.response;
  const { supabase, userId, applyCookies } = auth.ctx;

  let body: { name?: string; description?: string; emoji?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return applyCookies(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }));
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 40) {
    return applyCookies(
      NextResponse.json({ error: "팩 이름은 1–40자로 입력해 주세요" }, { status: 400 }),
    );
  }

  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, 280) : "";
  const emoji =
    typeof body.emoji === "string" && body.emoji.trim()
      ? body.emoji.trim().slice(0, 8)
      : null;

  const slug = slugifyPackName(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
    const { data, error } = await supabase
      .from("sticker_packs")
      .insert({
        creator_id: userId,
        slug: candidate,
        name,
        description,
        emoji,
        status: "draft",
      })
      .select("*")
      .single();

    if (!error && data) {
      return applyCookies(NextResponse.json({ pack: data as StickerPackRow }));
    }

    if (error?.code === "23505") continue;

    return applyCookies(
      NextResponse.json(
        { error: "팩을 만들지 못했어요", detail: error?.message },
        { status: 500 },
      ),
    );
  }

  return applyCookies(
    NextResponse.json({ error: "슬러그가 중복돼요. 이름을 바꿔 주세요" }, { status: 409 }),
  );
}

/** List the current user's packs (any status). */
export async function GET(request: NextRequest) {
  const auth = await requireStickerUser(request);
  if (!auth.ok) return auth.response;
  const { supabase, userId, applyCookies } = auth.ctx;

  const { data, error } = await supabase
    .from("sticker_packs")
    .select("*")
    .eq("creator_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    return applyCookies(
      NextResponse.json({ error: "목록을 불러오지 못했어요", detail: error.message }, { status: 500 }),
    );
  }

  return applyCookies(NextResponse.json({ packs: (data ?? []) as StickerPackRow[] }));
}
