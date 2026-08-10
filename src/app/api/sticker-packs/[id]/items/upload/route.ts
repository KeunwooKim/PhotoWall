import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { requireStickerUser } from "@/lib/stickers/require-sticker-user";
import {
  STICKER_ASSETS_BUCKET,
  STICKER_ITEM_ALLOWED_MIME,
  STICKER_ITEM_MAX_BYTES,
  STICKER_PACK_MAX_ITEMS,
  placementSizeFromNatural,
  type StickerPackItemRow,
  type StickerPackRow,
} from "@/lib/stickers/ugc-types";
import { itemToStickerDefinition } from "@/lib/stickers/ugc-registry";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const auth = await requireStickerUser(request);
  if (!auth.ok) return auth.response;
  const { supabase, userId, applyCookies } = auth.ctx;
  const { id: packId } = await context.params;

  const { data: pack, error: packError } = await supabase
    .from("sticker_packs")
    .select("*")
    .eq("id", packId)
    .maybeSingle();

  if (packError || !pack) {
    return applyCookies(NextResponse.json({ error: "팩을 찾을 수 없어요" }, { status: 404 }));
  }

  const packRow = pack as StickerPackRow;
  if (packRow.creator_id !== userId) {
    return applyCookies(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }
  if (packRow.status !== "draft" && packRow.status !== "rejected") {
    return applyCookies(
      NextResponse.json({ error: "초안 상태에서만 업로드할 수 있어요" }, { status: 400 }),
    );
  }

  const { count } = await supabase
    .from("sticker_pack_items")
    .select("id", { count: "exact", head: true })
    .eq("pack_id", packId);

  if ((count ?? 0) >= STICKER_PACK_MAX_ITEMS) {
    return applyCookies(
      NextResponse.json(
        { error: `스티커는 최대 ${STICKER_PACK_MAX_ITEMS}장까지 올릴 수 있어요` },
        { status: 400 },
      ),
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return applyCookies(NextResponse.json({ error: "Invalid form data" }, { status: 400 }));
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return applyCookies(NextResponse.json({ error: "file required" }, { status: 400 }));
  }
  if (!STICKER_ITEM_ALLOWED_MIME.has(file.type)) {
    return applyCookies(
      NextResponse.json({ error: "png/webp만 업로드할 수 있어요" }, { status: 400 }),
    );
  }
  if (file.size > STICKER_ITEM_MAX_BYTES) {
    return applyCookies(
      NextResponse.json({ error: "이미지는 512KB 이하여야 해요" }, { status: 400 }),
    );
  }

  const nameRaw = form.get("name");
  const name =
    typeof nameRaw === "string" && nameRaw.trim()
      ? nameRaw.trim().slice(0, 40)
      : file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "스티커";

  const buffer = Buffer.from(await file.arrayBuffer());
  let naturalW = 120;
  let naturalH = 120;
  try {
    const meta = await sharp(buffer).metadata();
    naturalW = meta.width ?? 120;
    naturalH = meta.height ?? 120;
  } catch {
    return applyCookies(NextResponse.json({ error: "이미지를 읽지 못했어요" }, { status: 400 }));
  }

  const { width, height } = placementSizeFromNatural(naturalW, naturalH);
  const ext = file.type === "image/webp" ? "webp" : "png";
  const itemId = crypto.randomUUID();
  const storagePath = `${userId}/${packId}/${itemId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(STICKER_ASSETS_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return applyCookies(
      NextResponse.json(
        { error: "업로드 실패", detail: uploadError.message },
        { status: 500 },
      ),
    );
  }

  const sortOrder = count ?? 0;
  const { data: item, error: itemError } = await supabase
    .from("sticker_pack_items")
    .insert({
      id: itemId,
      pack_id: packId,
      sort_order: sortOrder,
      name,
      storage_path: storagePath,
      width,
      height,
    })
    .select("*")
    .single();

  if (itemError || !item) {
    await supabase.storage.from(STICKER_ASSETS_BUCKET).remove([storagePath]);
    return applyCookies(
      NextResponse.json(
        { error: "스티커 저장 실패", detail: itemError?.message },
        { status: 500 },
      ),
    );
  }

  const itemRow = item as StickerPackItemRow;
  const nextCount = sortOrder + 1;
  const coverPath = packRow.cover_path ?? storagePath;
  await supabase
    .from("sticker_packs")
    .update({
      sticker_count: nextCount,
      cover_path: coverPath,
      updated_at: new Date().toISOString(),
      ...(packRow.status === "rejected"
        ? { status: "draft", reject_reason: null }
        : {}),
    })
    .eq("id", packId);

  return applyCookies(
    NextResponse.json({
      item: itemRow,
      sticker: itemToStickerDefinition(packRow, itemRow),
    }),
  );
}
