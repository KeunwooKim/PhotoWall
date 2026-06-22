import type { StickerDefinition, StickerPack } from "./types";

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
    id: "christmas",
    name: "크리스마스",
    emoji: "🎄",
    sortOrder: 10,
    availableFrom: "12-01",
    availableTo: "12-31",
    stickers: [
      { id: "christmas.tree", name: "트리", kind: "svg", src: svg("christmas/tree.svg") },
      { id: "christmas.snowflake", name: "눈송이", kind: "svg", src: svg("christmas/snowflake.svg") },
      { id: "christmas.gift", name: "선물", kind: "svg", src: svg("christmas/gift.svg") },
      { id: "christmas.santa-hat", name: "산타모자", kind: "svg", src: svg("christmas/santa-hat.svg") },
      { id: "christmas.tree-emoji", name: "트리", kind: "emoji", src: "🎄", defaultSize: 48 },
      { id: "christmas.snow-emoji", name: "눈", kind: "emoji", src: "❄️", defaultSize: 48 },
      { id: "christmas.gift-emoji", name: "선물", kind: "emoji", src: "🎁", defaultSize: 48 },
    ],
  },
  {
    id: "valentine",
    name: "발렌타인",
    emoji: "💕",
    sortOrder: 11,
    availableFrom: "02-01",
    availableTo: "02-14",
    stickers: [
      {
        id: "valentine.heart-envelope",
        name: "하트 편지",
        kind: "svg",
        src: svg("valentine/heart-envelope.svg"),
      },
      { id: "valentine.chocolate", name: "초콜릿", kind: "svg", src: svg("valentine/chocolate.svg") },
      { id: "valentine.rose", name: "장미", kind: "svg", src: svg("valentine/rose.svg") },
      { id: "valentine.love-letter", name: "러브레터", kind: "svg", src: svg("valentine/love-letter.svg") },
      { id: "valentine.heart-emoji", name: "하트", kind: "emoji", src: "💖", defaultSize: 48 },
      { id: "valentine.kiss-emoji", name: "키스", kind: "emoji", src: "💋", defaultSize: 48 },
      { id: "valentine.cupid-emoji", name: "큐피드", kind: "emoji", src: "💘", defaultSize: 48 },
    ],
  },
];

const STICKER_BY_ID = new Map<string, StickerDefinition>(
  STICKER_PACKS.flatMap((pack) => pack.stickers.map((sticker) => [sticker.id, sticker])),
);

export function getStickerById(id: string): StickerDefinition | undefined {
  return STICKER_BY_ID.get(id);
}

function isInSeasonalWindow(from?: string, to?: string, now = new Date()): boolean {
  if (!from && !to) return true;

  const month = now.getMonth() + 1;
  const day = now.getDate();
  const current = month * 100 + day;

  const parse = (value: string) => {
    const [m, d] = value.split("-").map(Number);
    return m * 100 + d;
  };

  const start = from ? parse(from) : 0;
  const end = to ? parse(to) : 1231;

  if (start <= end) return current >= start && current <= end;
  return current >= start || current <= end;
}

/** Packs visible in the picker — seasonal packs always listed for now. */
export function getStickerPacks(options?: { includeSeasonal?: boolean }): StickerPack[] {
  const includeSeasonal = options?.includeSeasonal ?? true;

  return STICKER_PACKS.filter((pack) => {
    if (!pack.availableFrom && !pack.availableTo) return true;
    if (!includeSeasonal) return false;
    return isInSeasonalWindow(pack.availableFrom, pack.availableTo);
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getStickerPreviewSrc(sticker: StickerDefinition): string {
  if (sticker.kind === "emoji") return sticker.src;
  return sticker.src;
}
