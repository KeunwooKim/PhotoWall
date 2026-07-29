import type { StickerDefinition, StickerPack } from "./types";
import { flattenPackStickers } from "./types";
import { MUDO_CATEGORIES } from "./mudo-catalog.generated";

function svg(path: string): string {
  return `/stickers/${path}`;
}

export const STICKER_PACKS: StickerPack[] = [
  {
    id: "basic",
    name: "기본",
    emoji: "✨",
    sortOrder: 0,
    stickers: [
      { id: "basic.heart", name: "하트", kind: "svg", src: svg("basic/heart.svg") },
      { id: "basic.star", name: "별", kind: "svg", src: svg("basic/star.svg") },
      { id: "basic.bow", name: "리본", kind: "svg", src: svg("basic/bow.svg") },
      { id: "basic.camera", name: "카메라", kind: "svg", src: svg("basic/camera.svg") },
      { id: "basic.sparkle", name: "반짝", kind: "svg", src: svg("basic/sparkle.svg") },
      { id: "basic.sparkles-emoji", name: "반짝이", kind: "emoji", src: "✨", defaultSize: 48 },
      { id: "basic.heart-emoji", name: "하트", kind: "emoji", src: "💕", defaultSize: 48 },
      { id: "basic.star-emoji", name: "별", kind: "emoji", src: "⭐", defaultSize: 48 },
      { id: "basic.flower", name: "꽃", kind: "emoji", src: "🌸", defaultSize: 48 },
      { id: "basic.camera-emoji", name: "카메라", kind: "emoji", src: "📸", defaultSize: 48 },
      { id: "basic.ribbon", name: "리본", kind: "emoji", src: "🎀", defaultSize: 48 },
    ],
  },
  {
    id: "mudo",
    name: "무한도전",
    emoji: "📺",
    sortOrder: 20,
    stickers: [],
    categories: MUDO_CATEGORIES,
    attribution: {
      label: "candy_drop (네이버 블로그)",
      href: "https://m.blog.naver.com/PostList.naver?blogId=candy_drop&tab=1",
      note: "블로그에서 정리한 스티커를 사용했습니다.",
    },
  },
];

const STICKER_BY_ID = new Map<string, StickerDefinition>(
  STICKER_PACKS.flatMap((pack) =>
    flattenPackStickers(pack).map((sticker) => [sticker.id, sticker]),
  ),
);

export function getStickerById(id: string): StickerDefinition | undefined {
  return STICKER_BY_ID.get(id);
}

/** Packs visible in the picker — seasonal packs listed year-round for now. */
export function getStickerPacks(options?: { includeSeasonal?: boolean }): StickerPack[] {
  const includeSeasonal = options?.includeSeasonal ?? true;

  return STICKER_PACKS.filter((pack) => {
    if (!pack.availableFrom && !pack.availableTo) return true;
    return includeSeasonal;
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getStickerPreviewSrc(sticker: StickerDefinition): string {
  if (sticker.kind === "emoji") return sticker.src;
  return sticker.src;
}
