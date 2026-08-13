import { flattenPackStickers, type StickerDefinition } from "./types";
import { getLoadedStickerPack, loadStickerPack } from "./catalog-loaders";

/** Built-in deco stickers reused as photo-corner decorations. */
export const PHOTO_CORNER_STICKER_IDS: readonly string[] = [
  "basic.heart",
  "basic.star",
  "basic.sparkle",
  "basic.bow",
  "basic.flower",
  "basic.pin",
  "basic.tape",
];

const PHOTO_CORNER_ID_SET = new Set(PHOTO_CORNER_STICKER_IDS);

export function isPhotoCornerSticker(sticker: StickerDefinition): boolean {
  return sticker.attach === "photo-corner" || PHOTO_CORNER_ID_SET.has(sticker.id);
}

function withCornerAttach(sticker: StickerDefinition): StickerDefinition {
  if (sticker.attach === "photo-corner") return sticker;
  return { ...sticker, attach: "photo-corner" };
}

export function getPhotoCornerStickers(): StickerDefinition[] {
  const pack = getLoadedStickerPack("basic");
  const fromPack = pack
    ? flattenPackStickers(pack).filter((sticker) => isPhotoCornerSticker(sticker))
    : [];
  if (fromPack.length > 0) {
    return fromPack.map(withCornerAttach);
  }
  void loadStickerPack("basic");
  return [];
}
