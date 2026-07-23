import type { StickerDefinition, StickerPack } from "./types";

function svg(path: string): string {
  return `/stickers/${path}`;
}

function image(path: string): string {
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
    id: "deco",
    name: "사진 꾸미기",
    emoji: "📌",
    sortOrder: 5,
    stickers: [
      { id: "deco.pin-red", name: "빨간 핀", kind: "image", src: image("deco/pin-red.png"), defaultSize: 44, tags: ["pin"] },
      { id: "deco.pin-gold", name: "골드 핀", kind: "image", src: image("deco/pin-gold.png"), defaultSize: 44, tags: ["pin"] },
      { id: "deco.pin-blue", name: "파란 핀", kind: "image", src: image("deco/pin-blue.png"), defaultSize: 44, tags: ["pin"] },
      {
        id: "deco.corner-ribbon",
        name: "코너 리본",
        kind: "image",
        src: image("deco/corner-ribbon.png"),
        defaultSize: 56,
        tags: ["ribbon"],
      },
      {
        id: "deco.sunglasses",
        name: "선글라스",
        kind: "image",
        src: image("deco/sunglasses.png"),
        defaultWidth: 96,
        defaultHeight: 40,
        tags: ["face"],
      },
      {
        id: "deco.washi-tape",
        name: "마스킹 테이프",
        kind: "image",
        src: image("deco/washi-tape.png"),
        defaultWidth: 72,
        defaultHeight: 28,
        tags: ["tape"],
      },
      {
        id: "deco.blush",
        name: "볼터치",
        kind: "image",
        src: image("deco/blush.png"),
        defaultWidth: 48,
        defaultHeight: 32,
        tags: ["face"],
      },
      {
        id: "deco.crown",
        name: "왕관",
        kind: "image",
        src: image("deco/crown.png"),
        defaultWidth: 56,
        defaultHeight: 42,
        tags: ["face"],
      },
      {
        id: "deco.heart-sticker",
        name: "하트 스티커",
        kind: "image",
        src: image("deco/heart-sticker.png"),
        defaultSize: 40,
        tags: ["face"],
      },
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
      {
        id: "christmas.santa-hat-tilt",
        name: "산타모자(옆)",
        kind: "image",
        src: image("christmas/santa-hat-tilt.png"),
        defaultWidth: 56,
        defaultHeight: 48,
        tags: ["face"],
      },
      {
        id: "christmas.rudolph-nose",
        name: "루돌프 코",
        kind: "image",
        src: image("christmas/rudolph-nose.png"),
        defaultSize: 28,
        tags: ["face"],
      },
      {
        id: "christmas.xmas-glasses",
        name: "크리스마스 안경",
        kind: "image",
        src: image("christmas/xmas-glasses.png"),
        defaultWidth: 96,
        defaultHeight: 40,
        tags: ["face"],
      },
      {
        id: "christmas.holly-corner",
        name: "홀리 코너",
        kind: "image",
        src: image("christmas/holly-corner.png"),
        defaultSize: 56,
        tags: ["ribbon"],
      },
      {
        id: "christmas.bell",
        name: "방울",
        kind: "image",
        src: image("christmas/bell.png"),
        defaultSize: 40,
        tags: ["face"],
      },
      {
        id: "christmas.snow-blush",
        name: "눈꽃 볼터치",
        kind: "image",
        src: image("christmas/snow-blush.png"),
        defaultWidth: 48,
        defaultHeight: 32,
        tags: ["face"],
      },
      {
        id: "christmas.xmas-tape",
        name: "크리스마스 테이프",
        kind: "image",
        src: image("christmas/xmas-tape.png"),
        defaultWidth: 72,
        defaultHeight: 28,
        tags: ["tape"],
      },
      {
        id: "christmas.snow-scatter",
        name: "눈발",
        kind: "image",
        src: image("christmas/snow-scatter.png"),
        defaultSize: 56,
        tags: ["atmosphere"],
      },
      {
        id: "christmas.garland",
        name: "가랜드",
        kind: "image",
        src: image("christmas/garland.png"),
        defaultWidth: 88,
        defaultHeight: 36,
        tags: ["atmosphere"],
      },
      {
        id: "christmas.mistletoe",
        name: "미스트토",
        kind: "image",
        src: image("christmas/mistletoe.png"),
        defaultWidth: 44,
        defaultHeight: 52,
        tags: ["atmosphere"],
      },
      { id: "christmas.santa-hat", name: "산타모자", kind: "svg", src: svg("christmas/santa-hat.svg"), defaultWidth: 56, defaultHeight: 48, tags: ["face"] },
      { id: "christmas.tree", name: "트리", kind: "svg", src: svg("christmas/tree.svg"), defaultSize: 56 },
      { id: "christmas.snowflake", name: "눈송이", kind: "svg", src: svg("christmas/snowflake.svg"), defaultSize: 48 },
      { id: "christmas.gift", name: "선물", kind: "svg", src: svg("christmas/gift.svg"), defaultSize: 52 },
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
